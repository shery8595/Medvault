/**
 * MedVault relayer (Ethereum Sepolia + Zama fhEVM v0.9).
 *
 * POST /relay/apply-stage     — stage FHE eligibility (Semaphore verified)
 * POST /relay/apply-finalize  — Noir proof finalize (client decrypts locally)
 * POST /relay/completion-proof — KMS proof for user-submitted completeWithdraw / completeUnstake
 *
 * Watcher: auto-completes WithdrawToRequested (claim payouts); caches proofs for withdraw/unstake.
 */
import express from "express";
import { ethers } from "ethers";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { createZamaClient, ETHEREUM_SEPOLIA_CHAIN_ID, publicDecryptProof } from "./zama-client.mjs";
import { startV09Watcher } from "./watcher.mjs";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
app.use(express.json());

function resolveCorsOrigins() {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) return "*";
  const origins = raw.split(",").map((o) => o.trim()).filter(Boolean);
  if (origins.length <= 1) return origins[0] ?? "*";
  return origins;
}

app.use(
  cors({
    origin: resolveCorsOrigins(),
  })
);

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: "Too many requests, slow down" },
});

if (!process.env.RELAYER_PRIVATE_KEY) {
    throw new Error("Missing RELAYER_PRIVATE_KEY in environment");
}

const RPC_URL =
    process.env.RPC_URL ||
    process.env.SEPOLIA_RPC_URL ||
    process.env.ETHEREUM_SEPOLIA_RPC_URL ||
    "https://ethereum-sepolia-rpc.publicnode.com";

const ZAMA_RELAYER_URL = process.env.ZAMA_RELAYER_URL?.trim() || undefined;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const relayerWallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);

const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS;
const SEMAPHORE_ADDRESS = process.env.SEMAPHORE_ADDRESS;
const CONFIDENTIAL_ETH_ADDRESS = process.env.CONFIDENTIAL_ETH_ADDRESS;
const STAKING_MANAGER_ADDRESS = process.env.STAKING_MANAGER_ADDRESS;
const ELIGIBILITY_ENGINE_ADDRESS = process.env.ELIGIBILITY_ENGINE_ADDRESS;
const SPONSOR_INCENTIVE_VAULT_ADDRESS = process.env.SPONSOR_INCENTIVE_VAULT_ADDRESS;

if (!REGISTRY_ADDRESS || !SEMAPHORE_ADDRESS) {
    throw new Error("Missing REGISTRY_ADDRESS or SEMAPHORE_ADDRESS in environment");
}

const NOT_ELIGIBLE_MSG =
    "Not eligible for this trial. Complete local decrypt showed ineligible result.";

const REGISTRY_ABI = [
    "function stageAnonymousApply(uint256 trialId, tuple(uint256 merkleTreeDepth, uint256 merkleTreeRoot, uint256 nullifier, uint256 message, uint256 scope, uint256[8] points) proof, uint256 commitment, address permitRecipient) external",
    "function finalizeAnonymousApplyWithProof(uint256 trialId, tuple(uint256 merkleTreeDepth, uint256 merkleTreeRoot, uint256 nullifier, uint256 message, uint256 scope, uint256[8] points) proof, uint256 commitment, address permitRecipient, address consentWallet, uint256 deadline, bytes permitSignature, bytes consentWalletSignature, bytes noirProof, bytes32[] publicInputs, bool eligible) external",
    "function cancelAnonymousApplyStage(uint256 trialId, tuple(uint256 merkleTreeDepth, uint256 merkleTreeRoot, uint256 nullifier, uint256 message, uint256 scope, uint256[8] points) proof, uint256 commitment, address permitRecipient) external",
    "function registerPatientViaRelayer(address patientWallet, uint256 identityCommitment, address viewPermitRecipient, bytes32 profileCommitment, bytes ageHandle, bytes genderHandle, bytes weightHandle, bytes heightHandle, bytes diabetesHandle, bytes hbHandle, bytes smokerHandle, bytes hypertensionHandle, bytes inputProof, uint256 nonce, bytes signature) external",
    "function hasAppliedToTrial(uint256 trialId, uint256 nullifierHash) external view returns (bool)",
    "function patientGroupId() external view returns (uint256)",
    "function eligibilityEngine() external view returns (address)",
    "function semaphore() external view returns (address)",
    "event AnonymousApplyStaged(uint256 indexed trialId, uint256 indexed nullifierHash, bytes32 indexed blindedRef, bytes32 finalCt)",
];

const ELIGIBILITY_ENGINE_ABI = [
    "event AnonymousEligibilityStaged(uint256 indexed nullifier, uint256 indexed trialId, bytes32 finalCt)",
];

const SEMAPHORE_ABI = [
    "function verifyProof(uint256 groupId, tuple(uint256 merkleTreeDepth, uint256 merkleTreeRoot, uint256 nullifier, uint256 message, uint256 scope, uint256[8] points) proof) external view returns (bool)",
];

const VAULT_ABI = [
    "function claimParticipantRewardsFor(uint256 _trialId, uint256 _nullifier, address _permitHolder, address _destination, uint256 _units, bytes encryptedUnits, bytes inputProof, uint256 _nonce, uint256 _deadline, bytes _signature) external",
    "function registerAnonymousParticipantFor(uint256 _trialId, uint256 _nullifier, address _permitHolder, uint256 _nonce, uint256 _deadline, bytes _signature) external",
];

const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, relayerWallet);
const registryIface = new ethers.Interface(REGISTRY_ABI);
const engineIface = new ethers.Interface(ELIGIBILITY_ENGINE_ABI);
const semaphore = new ethers.Contract(SEMAPHORE_ADDRESS, SEMAPHORE_ABI, provider);

let zamaSdk = null;
/** @type {ReturnType<typeof startV09Watcher> | null} */
let watcher = null;

function toBigInt(value, fieldName) {
    try {
        return BigInt(value);
    } catch {
        throw new Error(`Invalid ${fieldName}`);
    }
}

function extractErrorMessage(err) {
    if (!err) return "Unknown error";
    return err.shortMessage ?? err.reason ?? err.message ?? String(err);
}

function findRevertData(err, depth = 0) {
    if (!err || depth > 10) return null;
    if (typeof err.data === "string" && err.data.startsWith("0x") && err.data.length > 10) {
        return err.data;
    }
    const fromNested = findRevertData(err.error, depth + 1) || findRevertData(err.cause, depth + 1);
    if (fromNested) return fromNested;
    if (typeof err.info?.error?.data === "string" && err.info.error.data.startsWith("0x")) {
        return err.info.error.data;
    }
    return null;
}

const ERROR_STRING_IFACE = new ethers.Interface(["error Error(string)"]);

function formatContractRevert(err) {
    const base = extractErrorMessage(err);
    const data = findRevertData(err);
    if (!data) return base;
    try {
        const parsed = ERROR_STRING_IFACE.parseError(data);
        if (parsed && parsed.name === "Error") {
            return `${base} | Solidity Error(string): ${parsed.args[0]}`;
        }
    } catch {
        /* not Error(string) */
    }
    const byteLen = Math.floor((data.length - 2) / 2);
    return `${base} | revertData=${data.slice(0, 14)}… (${byteLen} bytes)`;
}

function parseProofFromBody(rawProof) {
    return {
        merkleTreeDepth: toBigInt(rawProof.merkleTreeDepth, "proof.merkleTreeDepth"),
        merkleTreeRoot: toBigInt(rawProof.merkleTreeRoot, "proof.merkleTreeRoot"),
        nullifier: toBigInt(rawProof.nullifier, "proof.nullifier"),
        message: toBigInt(rawProof.message, "proof.message"),
        scope: toBigInt(rawProof.scope, "proof.scope"),
        points: rawProof.points.map((p, idx) => toBigInt(p, `proof.points[${idx}]`)),
    };
}

function parseFinalCtFromStageReceipt(receipt) {
    const registryTarget = REGISTRY_ADDRESS.toLowerCase();
    const engineTarget = ELIGIBILITY_ENGINE_ADDRESS?.toLowerCase();

    for (const log of receipt.logs) {
        const addr = log.address?.toLowerCase();
        if (!addr) continue;
        if (addr === registryTarget) {
            try {
                const parsed = registryIface.parseLog(log);
                if (parsed?.name === "AnonymousApplyStaged") {
                    return parsed.args.finalCt;
                }
            } catch {
                /* ignore */
            }
        }
        if (engineTarget && addr === engineTarget) {
            try {
                const parsed = engineIface.parseLog(log);
                if (parsed?.name === "AnonymousEligibilityStaged") {
                    return parsed.args.finalCt;
                }
            } catch {
                /* ignore */
            }
        }
    }
    throw new Error("AnonymousApplyStaged / AnonymousEligibilityStaged finalCt not found in stage receipt");
}

async function runStartupChecks() {
    if (!ethers.isAddress(REGISTRY_ADDRESS) || !ethers.isAddress(SEMAPHORE_ADDRESS)) {
        throw new Error("REGISTRY_ADDRESS or SEMAPHORE_ADDRESS is not a valid address");
    }

    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(ETHEREUM_SEPOLIA_CHAIN_ID)) {
        throw new Error(
            `Unexpected chainId ${network.chainId.toString()} (expected ${ETHEREUM_SEPOLIA_CHAIN_ID})`
        );
    }

    const configuredSemaphore = await registry.semaphore();
    if (configuredSemaphore.toLowerCase() !== SEMAPHORE_ADDRESS.toLowerCase()) {
        throw new Error("SEMAPHORE_ADDRESS does not match registry.semaphore()");
    }

    const eligibilityEngine = await registry.eligibilityEngine();
    if (eligibilityEngine === ethers.ZeroAddress) {
        throw new Error("registry.eligibilityEngine() is zero address");
    }

    zamaSdk = await createZamaClient(relayerWallet, RPC_URL, ZAMA_RELAYER_URL);

    console.log(`Relayer wallet: ${relayerWallet.address}`);
    console.log(`Registry:       ${REGISTRY_ADDRESS}`);
    console.log(`Semaphore:      ${SEMAPHORE_ADDRESS}`);
    console.log(`Chain:          ${network.chainId}`);
    if (CONFIDENTIAL_ETH_ADDRESS) console.log(`ConfidentialETH: ${CONFIDENTIAL_ETH_ADDRESS}`);
    if (STAKING_MANAGER_ADDRESS) console.log(`StakingManager:  ${STAKING_MANAGER_ADDRESS}`);
}

async function validateConsentAndSemaphoreProof(reqBody, preflightLabel) {
    const { trialId, proof: rawProof, commitment, permitRecipient } = reqBody;

    if (!trialId || !rawProof || !commitment || !permitRecipient) {
        return { error: "Missing required fields", status: 400 };
    }
    if (!ethers.isAddress(permitRecipient)) {
        return { error: "permitRecipient must be a valid address", status: 400 };
    }
    const permitRecipientAddr = ethers.getAddress(permitRecipient);

    const groupId = await registry.patientGroupId();

    let proofForContract;
    try {
        proofForContract = parseProofFromBody(rawProof);
    } catch (e) {
        return { error: "Malformed proof fields: " + e.message, status: 400 };
    }

    const expectedMessage = BigInt(
        ethers.solidityPackedKeccak256(
            ["uint256", "uint256", "address", "string"],
            [BigInt(commitment), BigInt(trialId), permitRecipientAddr, "CONSENT"]
        )
    ).toString();

    const proofMessage = BigInt(rawProof.message).toString();

    if (expectedMessage !== proofMessage) {
        return { error: "Proof message does not encode consent for this trial", status: 400 };
    }

    try {
        const isValidProof = await semaphore.verifyProof(groupId, proofForContract);
        if (!isValidProof) {
            return {
                error:
                    "Semaphore proof invalid (expired root, unknown root, nullifier reused, or malformed proof)",
                status: 400,
            };
        }
    } catch (proofErr) {
        const reason = extractErrorMessage(proofErr);
        console.error(`❌ Semaphore verifyProof failed (${preflightLabel}):`, reason);
        return { error: "Semaphore proof verification failed: " + reason, status: 400 };
    }

    const alreadyApplied = await registry.hasAppliedToTrial(BigInt(trialId), BigInt(rawProof.nullifier));

    if (alreadyApplied) {
        return { error: "Already applied to this trial", status: 400 };
    }

    return {
        ok: true,
        trialIdBI: toBigInt(trialId, "trialId"),
        commitmentBI: toBigInt(commitment, "commitment"),
        permitRecipientAddr,
        proofForContract,
    };
}

async function relayStage(req, res) {
    console.log("─────────────────────────────────────────");
    console.log("STAGE trialId:", req.body?.trialId);

    try {
        const v = await validateConsentAndSemaphoreProof(req.body, "stage");
        if (v.error) return res.status(v.status).json({ error: v.error });

        try {
            await registry.stageAnonymousApply.staticCall(
                v.trialIdBI,
                v.proofForContract,
                v.commitmentBI,
                v.permitRecipientAddr
            );
            console.log("✅ stage staticCall passed");
        } catch (staticErr) {
            const reason = formatContractRevert(staticErr);
            console.error("❌ Stage static call revert:", reason);
            return res.status(400).json({ error: "Contract would revert: " + reason });
        }

        const estimatedGas = await registry.stageAnonymousApply.estimateGas(
            v.trialIdBI,
            v.proofForContract,
            v.commitmentBI,
            v.permitRecipientAddr
        );
        const gasLimit = (estimatedGas * 130n) / 100n;

        const tx = await registry.stageAnonymousApply(
            v.trialIdBI,
            v.proofForContract,
            v.commitmentBI,
            v.permitRecipientAddr,
            { gasLimit }
        );

        const receipt = await tx.wait();
        console.log(`✅ Stage TX confirmed: ${receipt.hash}`);

        res.json({ success: true, txHash: receipt.hash });
    } catch (err) {
        const reason = extractErrorMessage(err);
        console.error("❌ Stage relay error:", reason);
        res.status(500).json({ error: reason });
    }
}

async function relayFinalize(req, res) {
    console.log("─────────────────────────────────────────");
    console.log("FINALIZE trialId:", req.body?.trialId);

    try {
        const { noirProof, publicInputs, eligible, consentWallet, deadline, permitSignature, consentWalletSignature } =
            req.body;
        if (!noirProof || !Array.isArray(publicInputs) || typeof eligible !== "boolean") {
            return res.status(400).json({
                error: "Missing noirProof, publicInputs, or eligible (client must decrypt + prove locally)",
            });
        }
        if (!consentWallet || deadline == null || !permitSignature || !consentWalletSignature) {
            return res.status(400).json({
                error: "Missing consentWallet, deadline, permitSignature, or consentWalletSignature",
            });
        }
        if (!ethers.isAddress(consentWallet)) {
            return res.status(400).json({ error: "consentWallet must be a valid address" });
        }
        if (!eligible) {
            return res.status(400).json({
                error: NOT_ELIGIBLE_MSG,
                code: "NOT_ELIGIBLE",
            });
        }

        const v = await validateConsentAndSemaphoreProof(req.body, "finalize");
        if (v.error) return res.status(v.status).json({ error: v.error });

        try {
            await registry.finalizeAnonymousApplyWithProof.staticCall(
                v.trialIdBI,
                v.proofForContract,
                v.commitmentBI,
                v.permitRecipientAddr,
                ethers.getAddress(consentWallet),
                toBigInt(deadline, "deadline"),
                permitSignature,
                consentWalletSignature,
                noirProof,
                publicInputs,
                eligible
            );
            console.log("✅ finalize staticCall passed");
        } catch (staticErr) {
            const reason = formatContractRevert(staticErr);
            console.error("❌ Finalize static call revert:", reason);
            return res.status(400).json({ error: "Contract would revert: " + reason });
        }

        const estimatedGas = await registry.finalizeAnonymousApplyWithProof.estimateGas(
            v.trialIdBI,
            v.proofForContract,
            v.commitmentBI,
            v.permitRecipientAddr,
            ethers.getAddress(consentWallet),
            toBigInt(deadline, "deadline"),
            permitSignature,
            consentWalletSignature,
            noirProof,
            publicInputs,
            eligible
        );
        const gasLimit = (estimatedGas * 130n) / 100n;

        const tx = await registry.finalizeAnonymousApplyWithProof(
            v.trialIdBI,
            v.proofForContract,
            v.commitmentBI,
            v.permitRecipientAddr,
            ethers.getAddress(consentWallet),
            toBigInt(deadline, "deadline"),
            permitSignature,
            consentWalletSignature,
            noirProof,
            publicInputs,
            eligible,
            { gasLimit }
        );

        const receipt = await tx.wait();
        console.log(`✅ Finalize TX confirmed: ${receipt.hash}`);

        res.json({ success: true, txHash: receipt.hash, eligible: true });
    } catch (err) {
        const reason = extractErrorMessage(err);
        console.error("❌ Finalize relay error:", reason);
        res.status(500).json({ error: reason });
    }
}

async function relayCompletionProof(req, res) {
    try {
        if (!watcher) {
            return res.status(503).json({ error: "Watcher not initialized" });
        }
        const { kind, user, handle, stageTxHash } = req.body;
        if (!kind || !["withdraw", "unstake", "withdrawTo"].includes(kind)) {
            return res.status(400).json({ error: "kind must be withdraw | unstake | withdrawTo" });
        }

        const result = await watcher.lookupCompletionProof({ kind, user, handle, stageTxHash });
        res.json({
            success: true,
            eligible: result.eligible,
            cleartexts: result.cleartexts,
            decryptionProof: result.proof,
        });
    } catch (err) {
        res.status(400).json({ error: extractErrorMessage(err) });
    }
}

async function relayPublicExit(req, res) {
    try {
        if (!watcher) {
            return res.status(503).json({ error: "Watcher not initialized" });
        }
        const required = [
            "owner",
            "stealthRecipient",
            "exitMode",
            "nonce",
            "deadline",
            "signature",
            "sufficientHandle",
        ];
        for (const key of required) {
            if (req.body[key] === undefined || req.body[key] === null || req.body[key] === "") {
                return res.status(400).json({ error: `Missing ${key}` });
            }
        }

        const result = await watcher.submitPublicExit({
            owner: req.body.owner,
            stealthRecipient: req.body.stealthRecipient,
            exitMode: Number(req.body.exitMode),
            nonce: BigInt(req.body.nonce),
            deadline: BigInt(req.body.deadline),
            signature: req.body.signature,
            sufficientHandle: req.body.sufficientHandle,
        });

        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: extractErrorMessage(err) });
    }
}

async function relayRegister(req, res) {
    try {
        const {
            patientWallet,
            identityCommitment,
            viewPermitRecipient,
            profileCommitment,
            encryptedFields,
            inputProof,
            nonce,
            signature,
        } = req.body;

        if (
            !patientWallet ||
            !identityCommitment ||
            !viewPermitRecipient ||
            !profileCommitment ||
            !encryptedFields ||
            !inputProof ||
            nonce === undefined ||
            !signature
        ) {
            return res.status(400).json({ error: "Missing registration fields" });
        }
        if (!ethers.isAddress(patientWallet) || !ethers.isAddress(viewPermitRecipient)) {
            return res.status(400).json({ error: "Invalid address" });
        }

        const tx = await registry.registerPatientViaRelayer(
            ethers.getAddress(patientWallet),
            BigInt(identityCommitment),
            ethers.getAddress(viewPermitRecipient),
            profileCommitment,
            encryptedFields.age,
            encryptedFields.gender,
            encryptedFields.weight,
            encryptedFields.height,
            encryptedFields.hasDiabetes,
            encryptedFields.hbLevel,
            encryptedFields.isSmoker,
            encryptedFields.hasHypertension,
            inputProof,
            BigInt(nonce),
            signature
        );
        const receipt = await tx.wait();
        res.json({ success: true, txHash: receipt.hash });
    } catch (err) {
        console.error("relay/register failed:", formatContractRevert(err));
        res.status(500).json({ error: formatContractRevert(err) });
    }
}

async function relayClaim(req, res) {
    try {
        const vaultAddress = req.body.vaultAddress || SPONSOR_INCENTIVE_VAULT_ADDRESS;
        if (!vaultAddress) {
            return res.status(400).json({ error: "Missing SPONSOR_INCENTIVE_VAULT_ADDRESS" });
        }
        const {
            trialId,
            nullifier,
            permitHolder,
            destination,
            units,
            encryptedUnitsHandle,
            inputProof,
            nonce,
            deadline,
            signature,
        } = req.body;
        if (
            trialId === undefined ||
            nullifier === undefined ||
            !permitHolder ||
            !destination ||
            units === undefined ||
            !encryptedUnitsHandle ||
            !inputProof ||
            nonce === undefined ||
            deadline === undefined ||
            !signature
        ) {
            return res.status(400).json({ error: "Missing claim relay fields" });
        }
        const vault = new ethers.Contract(ethers.getAddress(vaultAddress), VAULT_ABI, relayerWallet);
        const tx = await vault.claimParticipantRewardsFor(
            BigInt(trialId),
            BigInt(nullifier),
            ethers.getAddress(permitHolder),
            ethers.getAddress(destination),
            BigInt(units),
            encryptedUnitsHandle,
            inputProof,
            BigInt(nonce),
            BigInt(deadline),
            signature
        );
        const receipt = await tx.wait();
        res.json({ success: true, txHash: receipt.hash });
    } catch (err) {
        console.error("relay/claim failed:", formatContractRevert(err));
        res.status(500).json({ error: formatContractRevert(err) });
    }
}

async function relayRegisterAnon(req, res) {
    try {
        const vaultAddress = req.body.vaultAddress || SPONSOR_INCENTIVE_VAULT_ADDRESS;
        if (!vaultAddress) {
            return res.status(400).json({ error: "Missing SPONSOR_INCENTIVE_VAULT_ADDRESS" });
        }
        const { trialId, nullifier, permitHolder, nonce, deadline, signature } = req.body;
        if (
            trialId === undefined ||
            nullifier === undefined ||
            !permitHolder ||
            nonce === undefined ||
            deadline === undefined ||
            !signature
        ) {
            return res.status(400).json({ error: "Missing register-anon relay fields" });
        }
        const vault = new ethers.Contract(ethers.getAddress(vaultAddress), VAULT_ABI, relayerWallet);
        const tx = await vault.registerAnonymousParticipantFor(
            BigInt(trialId),
            BigInt(nullifier),
            ethers.getAddress(permitHolder),
            BigInt(nonce),
            BigInt(deadline),
            signature
        );
        const receipt = await tx.wait();
        res.json({ success: true, txHash: receipt.hash });
    } catch (err) {
        console.error("relay/register-anon failed:", formatContractRevert(err));
        res.status(500).json({ error: formatContractRevert(err) });
    }
}

app.get("/health", (_, res) =>
    res.json({
        status: "ok",
        registry: REGISTRY_ADDRESS,
        chainId: ETHEREUM_SEPOLIA_CHAIN_ID,
    })
);

app.post("/relay/apply-stage", limiter, relayStage);
app.post("/relay/apply-finalize", limiter, relayFinalize);
app.post("/relay/register", limiter, relayRegister);
app.post("/relay/claim", limiter, relayClaim);
app.post("/relay/register-anon", limiter, relayRegisterAnon);
app.post("/relay/completion-proof", limiter, relayCompletionProof);
app.post("/relay/public-exit", limiter, relayPublicExit);

app.post("/relay/apply", limiter, (_, res) => {
    res.status(410).json({
        error:
            "Deprecated: use POST /relay/apply-stage then POST /relay/apply-finalize (Noir proof gate).",
    });
});

const PORT = process.env.PORT || 3000;
const WATCHER_ENABLED = process.env.WATCHER_ENABLED !== "false";

runStartupChecks()
    .then(async () => {
        if (WATCHER_ENABLED) {
            watcher = startV09Watcher({
                provider,
                relayerWallet,
                zamaSdk,
                confidentialEthAddress: CONFIDENTIAL_ETH_ADDRESS,
                stakingManagerAddress: STAKING_MANAGER_ADDRESS,
                pollMs: Number(process.env.WATCHER_POLL_MS || 15_000),
            });
            await watcher.start();
        } else {
            console.log("Watcher disabled (WATCHER_ENABLED=false)");
        }

        app.listen(PORT, () => console.log(`MedVault relayer listening on port ${PORT}`));
    })
    .catch((err) => {
        console.error("Startup checks failed:", extractErrorMessage(err));
        process.exit(1);
    });
