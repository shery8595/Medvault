/**
 * MedVault relayer (Ethereum Sepolia + Zama fhEVM v0.9).
 *
 * POST /relay/apply-stage     — stage FHE eligibility (Semaphore verified)
 * POST /relay/apply-finalize  — Noir proof finalize (client decrypts locally)
 * POST /relay/cancel-stage    — Cancel staged anonymous apply (authorized relayer)
 * POST /relay/completion-proof — KMS proof for user-submitted completeWithdraw / completeUnstake
 *
 * Watcher: auto-completes WithdrawToRequested (claim payouts); caches proofs for withdraw/unstake.
 */
import express from "express";
import { ethers } from "ethers";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createZamaClient, ETHEREUM_SEPOLIA_CHAIN_ID, publicDecryptProof } from "./zama-client.mjs";
import {
    cacheStageHandle,
    getRelayerEligible,
    invalidateEligibilityCaches,
    resolveStagedFinalCt,
    assertRelayerVisibilityAcknowledged,
} from "./eligibility-decrypt.mjs";
import { safeError, safeLog } from "./redaction.mjs";
import { startV09Watcher } from "./watcher.mjs";
import { createWithdrawCompleter } from "./withdraw-completion.mjs";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVER_JS_SHA256 = createHash("sha256")
    .update(readFileSync(join(__dirname, "server.js")))
    .digest("hex");

const require = createRequire(import.meta.url);
const { pinBufferToIpfs } = require("./ipfs.cjs");

dotenv.config();

const app = express();
app.set("trust proxy", 1);
app.use(express.json());

function resolveCorsOrigins() {
  const raw = process.env.FRONTEND_URL?.trim();
  const isProd = process.env.NODE_ENV === "production";
  if (!raw) {
    if (isProd) {
      throw new Error("FRONTEND_URL is required in production (CORS fail-closed)");
    }
    return "*";
  }
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

/** In-memory ops counters (reset on process restart). */
const relayerMetrics = {
    stageCount: 0,
    finalizeAttempts: 0,
    finalizeRejectedNotEligible: 0,
    finalizeSuccess: 0,
};

/** trialId:nullifier → pre-signed vault register auth (from patient apply). */
const pendingRegisterAuthStore = new Map();
/** trialId:nullifier:milestoneIndex → pre-signed milestone completion auth. */
const pendingMilestoneAuthStore = new Map();

/** applicant (lowercase) → encrypted sponsor application manifest (AES key server-side only). */
const sponsorApplicationStore = new Map();

const SPONSOR_REGISTRY_ADDRESS =
    process.env.SPONSOR_REGISTRY_ADDRESS?.trim() || "0xCBD45e3fC20C646CCE77F386aA60d256A78dAa23";

const SPONSOR_REGISTRY_ABI = [
    "function owner() view returns (address)",
    "function addSponsor(address _sponsor, string _name) external",
    "function requests(address) view returns (bytes32 encryptedInstitutionId, uint8 status, uint256 requestedAt, bool hasEncryptedData)",
];

const SPONSOR_TEST_AUTO_APPROVE_ENABLED = process.env.SPONSOR_TEST_AUTO_APPROVE_ENABLED === "true";
const SPONSOR_REGISTRY_OWNER_PRIVATE_KEY = process.env.SPONSOR_REGISTRY_OWNER_PRIVATE_KEY?.trim();

function getSponsorRegistryOwnerWallet() {
    if (!SPONSOR_REGISTRY_OWNER_PRIVATE_KEY) return null;
    try {
        return new ethers.Wallet(SPONSOR_REGISTRY_OWNER_PRIVATE_KEY, provider);
    } catch {
        return null;
    }
}

async function sponsorTestAutoApproveReady() {
    const diag = await getSponsorTestAutoApproveDiagnostics();
    return diag.enabled;
}

/** Safe status for GET /relay/sponsor-test-auto-approve (no secrets). */
async function getSponsorTestAutoApproveDiagnostics() {
    const rawFlag = process.env.SPONSOR_TEST_AUTO_APPROVE_ENABLED?.trim() ?? "";
    const flagEnabled = SPONSOR_TEST_AUTO_APPROVE_ENABLED;
    const ownerKeyConfigured = Boolean(SPONSOR_REGISTRY_OWNER_PRIVATE_KEY);
    const ownerWallet = getSponsorRegistryOwnerWallet();
    const ownerKeyValid = Boolean(ownerWallet);
    let registryOwner = null;
    let ownerKeyMatchesRegistry = false;
    try {
        registryOwner = await sponsorRegistry.owner();
        if (ownerWallet && registryOwner) {
            ownerKeyMatchesRegistry =
                ownerWallet.address.toLowerCase() === registryOwner.toLowerCase();
        }
    } catch {
        registryOwner = null;
    }
    const enabled = flagEnabled && ownerKeyValid && ownerKeyMatchesRegistry;
    let reason = null;
    if (!enabled) {
        if (!rawFlag) reason = "missing_SPONSOR_TEST_AUTO_APPROVE_ENABLED";
        else if (rawFlag !== "true") reason = "SPONSOR_TEST_AUTO_APPROVE_ENABLED_must_be_exactly_true";
        else if (!ownerKeyConfigured) reason = "missing_SPONSOR_REGISTRY_OWNER_PRIVATE_KEY";
        else if (!ownerKeyValid) reason = "invalid_SPONSOR_REGISTRY_OWNER_PRIVATE_KEY";
        else if (!ownerKeyMatchesRegistry) reason = "owner_key_does_not_match_SponsorRegistry_owner";
        else reason = "unknown";
    }
    return {
        enabled,
        reason,
        checks: {
            flagEnabled,
            flagRaw: rawFlag || null,
            ownerKeyConfigured,
            ownerKeyValid,
            ownerKeyMatchesRegistry,
            configuredOwnerAddress: ownerWallet?.address ?? null,
            registryOwner,
            sponsorRegistryAddress: SPONSOR_REGISTRY_ADDRESS,
        },
    };
}

const sponsorRegistry = new ethers.Contract(
    SPONSOR_REGISTRY_ADDRESS,
    SPONSOR_REGISTRY_ABI,
    provider
);

async function assertRegistryOwnerWallet(walletHeader) {
    const requester = typeof walletHeader === "string" ? walletHeader.trim() : "";
    if (!requester || !ethers.isAddress(requester)) {
        const err = new Error("Missing or invalid X-Wallet-Address header");
        err.statusCode = 401;
        throw err;
    }
    const owner = await sponsorRegistry.owner();
    if (owner.toLowerCase() !== requester.toLowerCase()) {
        const err = new Error("Only SponsorRegistry owner may access sponsor applications");
        err.statusCode = 403;
        throw err;
    }
    return ethers.getAddress(requester);
}

function pendingRegisterAuthKey(trialId, nullifier) {
    return `${BigInt(trialId).toString()}:${BigInt(nullifier).toString()}`;
}

function pendingMilestoneAuthKey(trialId, nullifier, milestoneIndex) {
    return `${pendingRegisterAuthKey(trialId, nullifier)}:${BigInt(milestoneIndex).toString()}`;
}

const REGISTRY_ABI = [
    "function stageAnonymousApply(uint256 trialId, tuple(uint256 merkleTreeDepth, uint256 merkleTreeRoot, uint256 nullifier, uint256 message, uint256 scope, uint256[8] points) proof, uint256 commitment, address permitRecipient, uint256 deadline, bytes permitSignature) external",
    "function finalizeAnonymousApplyWithProof(uint256 trialId, tuple(uint256 merkleTreeDepth, uint256 merkleTreeRoot, uint256 nullifier, uint256 message, uint256 scope, uint256[8] points) proof, uint256 commitment, address permitRecipient, address consentWallet, uint256 deadline, bytes permitSignature, bytes consentWalletSignature, bytes noirProof, bytes32[] publicInputs) external",
    "function cancelAnonymousApplyStage(uint256 trialId, tuple(uint256 merkleTreeDepth, uint256 merkleTreeRoot, uint256 nullifier, uint256 message, uint256 scope, uint256[8] points) proof, uint256 commitment, address permitRecipient, uint256 deadline, bytes permitSignature, bytes cancelSignature) external",
    "function registerPatientViaRelayer(address patientWallet, uint256 identityCommitment, address viewPermitRecipient, bytes32 profileCommitment, bytes32 profileSaltCommitment, bytes ageHandle, bytes genderHandle, bytes weightHandle, bytes heightHandle, bytes diabetesHandle, bytes hbHandle, bytes smokerHandle, bytes hypertensionHandle, bytes inputProof, uint256 nonce, uint256 deadline, bytes signature) external",
    "function computeHealthDataHash(bytes32 ageHandle, bytes32 genderHandle, bytes32 weightHandle, bytes32 heightHandle, bytes32 diabetesHandle, bytes32 hbHandle, bytes32 smokerHandle, bytes32 hypertensionHandle, bytes inputProof) external pure returns (bytes32)",
    "function hasAppliedToTrial(uint256 trialId, uint256 nullifierHash) external view returns (bool)",
    "function patientGroupId() external view returns (uint256)",
    "function eligibilityEngine() external view returns (address)",
    "function semaphore() external view returns (address)",
    "function authorizedRelayers(address relayer) external view returns (bool)",
    "event AnonymousApplyStaged(uint256 indexed trialId, uint256 indexed nullifierHash, bytes32 indexed blindedRef, bytes32 finalCt)",
];

const ELIGIBILITY_ENGINE_ABI = [
    "event AnonymousEligibilityStaged(uint256 indexed nullifier, uint256 indexed trialId, bytes32 finalCt)",
];

const SEMAPHORE_ABI = [
    "function verifyProof(uint256 groupId, tuple(uint256 merkleTreeDepth, uint256 merkleTreeRoot, uint256 nullifier, uint256 message, uint256 scope, uint256[8] points) proof) external view returns (bool)",
];

const VAULT_ABI = [
    "function claimParticipantRewardsFor(uint256 _trialId, uint256 _nullifier, address _permitHolder, address _destination, uint256 _units, bytes32 _encryptedAmountCommitment, bytes encryptedUnits, bytes inputProof, uint256 _nonce, uint256 _deadline, bytes _signature, uint256 _withdrawToNonce, uint256 _withdrawToDeadline, bytes _withdrawToSignature) external",
    "function registerAnonymousParticipantFor(uint256 _trialId, uint256 _nullifier, address _permitHolder, uint256 _nonce, uint256 _deadline, bytes _signature) external",
];

const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, relayerWallet);
const registryIface = new ethers.Interface(REGISTRY_ABI);
const engineIface = new ethers.Interface(ELIGIBILITY_ENGINE_ABI);
const semaphore = new ethers.Contract(SEMAPHORE_ADDRESS, SEMAPHORE_ABI, provider);

let zamaSdk = null;
/** @type {string | null} */
let eligibilityEngineAddress = ELIGIBILITY_ENGINE_ADDRESS ?? null;
/** @type {ReturnType<typeof startV09Watcher> | null} */
let watcher = null;

/** Relayer-paid completeWithdrawTo — not tied to watcher instance shape. */
const completeWithdrawToOnChain = createWithdrawCompleter(relayerWallet, CONFIDENTIAL_ETH_ADDRESS);

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
    return `${base} | revert (${byteLen} bytes)`;
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
    eligibilityEngineAddress = eligibilityEngine;

    zamaSdk = await createZamaClient(relayerWallet, RPC_URL, ZAMA_RELAYER_URL);

    safeLog("Relayer wallet:", relayerWallet.address);
    safeLog("Registry:", REGISTRY_ADDRESS);
    safeLog("Semaphore:", SEMAPHORE_ADDRESS);
    safeLog("EligibilityEngine:", eligibilityEngineAddress);
    safeLog("Chain:", network.chainId.toString());
    safeLog("server.js sha256:", SERVER_JS_SHA256);
    if (CONFIDENTIAL_ETH_ADDRESS) safeLog("ConfidentialETH:", CONFIDENTIAL_ETH_ADDRESS);
    if (STAKING_MANAGER_ADDRESS) safeLog("StakingManager:", STAKING_MANAGER_ADDRESS);
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
        ethers.keccak256(
            ethers.solidityPacked(
                ["uint256", "address"],
                [BigInt(commitment), permitRecipientAddr]
            )
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
    safeLog("STAGE trialId:", req.body?.trialId);

    try {
        const { deadline, permitSignature } = req.body;
        if (deadline == null || !permitSignature) {
            return res.status(400).json({ error: "Missing deadline or permitSignature" });
        }

        const v = await validateConsentAndSemaphoreProof(req.body, "stage");
        if (v.error) return res.status(v.status).json({ error: v.error });

        const deadlineBI = toBigInt(deadline, "deadline");

        try {
            await registry.stageAnonymousApply.staticCall(
                v.trialIdBI,
                v.proofForContract,
                v.commitmentBI,
                v.permitRecipientAddr,
                deadlineBI,
                permitSignature
            );
            safeLog("stage staticCall passed");
        } catch (staticErr) {
            const reason = formatContractRevert(staticErr);
            safeError("Stage static call revert:", reason);
            return res.status(400).json({ error: "Contract would revert: " + reason });
        }

        const estimatedGas = await registry.stageAnonymousApply.estimateGas(
            v.trialIdBI,
            v.proofForContract,
            v.commitmentBI,
            v.permitRecipientAddr,
            deadlineBI,
            permitSignature
        );
        const gasLimit = (estimatedGas * 130n) / 100n;

        const tx = await registry.stageAnonymousApply(
            v.trialIdBI,
            v.proofForContract,
            v.commitmentBI,
            v.permitRecipientAddr,
            deadlineBI,
            permitSignature,
            { gasLimit }
        );

        const receipt = await tx.wait();
        safeLog("Stage TX confirmed:", receipt.hash);

        const finalCt = parseFinalCtFromStageReceipt(receipt);
        const block = await provider.getBlock(receipt.blockNumber);
        cacheStageHandle(
            v.proofForContract.nullifier,
            v.trialIdBI,
            finalCt,
            Number(block.timestamp) * 1000
        );

        relayerMetrics.stageCount += 1;
        res.json({ success: true, txHash: receipt.hash });
    } catch (err) {
        const reason = extractErrorMessage(err);
        safeError("Stage relay error:", reason);
        res.status(500).json({ error: reason });
    }
}

async function relayFinalize(req, res) {
    safeLog("FINALIZE trialId:", req.body?.trialId);
    relayerMetrics.finalizeAttempts += 1;

    try {
        const { noirProof, publicInputs, eligible, consentWallet, deadline, permitSignature, consentWalletSignature, acknowledgeRelayerVisibility } =
            req.body;
        if (!noirProof || !Array.isArray(publicInputs)) {
            return res.status(400).json({
                error: "Missing noirProof or publicInputs (client must decrypt + prove locally)",
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

        const v = await validateConsentAndSemaphoreProof(req.body, "finalize");
        if (v.error) return res.status(v.status).json({ error: v.error });

        const relayerIsPermitHolder =
            v.permitRecipientAddr.toLowerCase() === relayerWallet.address.toLowerCase();

        let relayerEligible = typeof eligible === "boolean" ? eligible : true;

        // P0.2: independent re-decrypt only when relayer is the staged permit holder.
        if (relayerIsPermitHolder) {
            try {
                assertRelayerVisibilityAcknowledged({
                    relayerIsPermitHolder: true,
                    acknowledged: acknowledgeRelayerVisibility === true,
                });
            } catch (ackErr) {
                return res.status(400).json({
                    error: ackErr.message ?? "Relayer-assisted decrypt requires acknowledgeRelayerVisibility=true",
                    code: ackErr.code ?? "RELAYER_VISIBILITY_NOT_ACKNOWLEDGED",
                });
            }

            let staged;
            try {
                staged = resolveStagedFinalCt({
                    nullifier: v.proofForContract.nullifier,
                    trialId: v.trialIdBI,
                    publicInputs,
                });
            } catch (resolveErr) {
                const code = resolveErr?.code ?? "STAGING_NOT_FOUND";
                return res.status(400).json({
                    error: resolveErr.message ?? "Staged eligibility not found",
                    code,
                });
            }

            try {
                relayerEligible = await getRelayerEligible({
                    sdk: zamaSdk,
                    eligibilityEngineAddress,
                    nullifier: v.proofForContract.nullifier,
                    trialId: v.trialIdBI,
                    finalCt: staged.finalCt,
                    stagedAtMs: staged.stagedAtMs,
                });
            } catch (decryptErr) {
                const code = decryptErr?.code ?? "DECRYPT_FAILED";
                if (code === "STAGING_EXPIRED") {
                    return res.status(400).json({
                        error: "Staging expired — re-stage eligibility before finalize",
                        code,
                    });
                }
                safeError("Relayer eligibility decrypt failed:", extractErrorMessage(decryptErr));
                return res.status(400).json({
                    error: "Relayer could not verify staged eligibility ciphertext",
                    code,
                });
            }

            if (!relayerEligible) {
                relayerMetrics.finalizeRejectedNotEligible += 1;
                return res.status(400).json({
                    error: NOT_ELIGIBLE_MSG,
                    code: "NOT_ELIGIBLE",
                    eligible: false,
                });
            }
        } else if (eligible === false) {
            relayerMetrics.finalizeRejectedNotEligible += 1;
            return res.status(400).json({
                error: NOT_ELIGIBLE_MSG,
                code: "NOT_ELIGIBLE",
                eligible: false,
            });
        }

        const finalizeArgs = [
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
        ];

        try {
            await registry.finalizeAnonymousApplyWithProof.staticCall(...finalizeArgs);
            safeLog("finalize staticCall passed");
        } catch (staticErr) {
            const reason = formatContractRevert(staticErr);
            safeError("Finalize static call revert:", reason);
            return res.status(400).json({ error: "Contract would revert: " + reason });
        }

        const estimatedGas = await registry.finalizeAnonymousApplyWithProof.estimateGas(...finalizeArgs);
        const gasLimit = (estimatedGas * 130n) / 100n;

        const tx = await registry.finalizeAnonymousApplyWithProof(...finalizeArgs, { gasLimit });

        const receipt = await tx.wait();
        safeLog("Finalize TX confirmed:", receipt.hash);
        relayerMetrics.finalizeSuccess += 1;

        res.json({ success: true, txHash: receipt.hash, eligible: relayerEligible });
    } catch (err) {
        const reason = extractErrorMessage(err);
        safeError("Finalize relay error:", reason);
        res.status(500).json({ error: reason });
    }
}

function verifyCompletionProofAuth({ kind, user, handle, stageTxHash, callerSignature }) {
    if (!callerSignature || typeof callerSignature !== "string") {
        throw new Error("Missing callerSignature");
    }
    if (!user || !ethers.isAddress(user)) {
        throw new Error("user must be a valid address");
    }
    const userAddr = ethers.getAddress(user);
    const digest = ethers.solidityPackedKeccak256(
        ["string", "address", "bytes32", "string"],
        [kind, userAddr, handle ?? ethers.ZeroHash, stageTxHash ?? ""]
    );
    const recovered = ethers.verifyMessage(ethers.getBytes(digest), callerSignature);
    if (ethers.getAddress(recovered) !== userAddr) {
        throw new Error("Invalid completion-proof caller signature");
    }
}

async function relayCompletionProof(req, res) {
    try {
        if (!watcher) {
            return res.status(503).json({ error: "Watcher not initialized" });
        }
        const { kind, user, handle, stageTxHash, callerSignature } = req.body;
        if (!kind || !["withdraw", "unstake", "withdrawTo"].includes(kind)) {
            return res.status(400).json({ error: "kind must be withdraw | unstake | withdrawTo" });
        }

        verifyCompletionProofAuth({ kind, user, handle, stageTxHash, callerSignature });

        const result = await watcher.lookupCompletionProof({ kind, user, handle, stageTxHash });
        let completeTxHash;
        let completeError;
        if (kind === "withdrawTo") {
            if (!completeWithdrawToOnChain) {
                completeError = "ConfidentialETH not configured on relayer";
            } else {
                try {
                    completeTxHash = await completeWithdrawToOnChain(
                        user,
                        result.cleartexts,
                        result.proof,
                    );
                    safeLog("completion-proof auto-completeWithdrawTo:", completeTxHash);
                } catch (completeErr) {
                    const reason = extractErrorMessage(completeErr);
                    if (!/nothing pending|already/i.test(reason)) {
                        completeError = reason;
                        safeError("completion-proof auto-complete failed:", reason);
                    }
                }
            }
        }
        res.json({
            success: true,
            eligible: result.eligible,
            cleartexts: result.cleartexts,
            decryptionProof: result.proof,
            completeTxHash: completeTxHash ?? null,
            completeError: completeError ?? null,
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
            "transferableHandle",
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
            transferableHandle: req.body.transferableHandle,
        });

        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: extractErrorMessage(err) });
    }
}

async function relayCancelStage(req, res) {
    safeLog("CANCEL trialId:", req.body?.trialId);

    try {
        const { deadline, permitSignature, cancelSignature } = req.body;
        if (deadline == null || !permitSignature || !cancelSignature) {
            return res.status(400).json({ error: "Missing deadline, permitSignature, or cancelSignature" });
        }

        const v = await validateConsentAndSemaphoreProof(req.body, "cancel");
        if (v.error) return res.status(v.status).json({ error: v.error });

        const deadlineBI = toBigInt(deadline, "deadline");

        const tx = await registry.cancelAnonymousApplyStage(
            v.trialIdBI,
            v.proofForContract,
            v.commitmentBI,
            v.permitRecipientAddr,
            deadlineBI,
            permitSignature,
            cancelSignature
        );
        const receipt = await tx.wait();
        invalidateEligibilityCaches(v.proofForContract.nullifier, v.trialIdBI);
        safeLog("Cancel TX confirmed:", receipt.hash);
        res.json({ success: true, txHash: receipt.hash });
    } catch (err) {
        const reason = formatContractRevert(err);
        safeError("Cancel relay error:", reason);
        res.status(500).json({ error: reason });
    }
}

async function relayRegister(req, res) {
    try {
        const {
            patientWallet,
            identityCommitment,
            viewPermitRecipient,
            profileCommitment,
            profileSaltCommitment,
            encryptedFields,
            inputProof,
            healthDataHash,
            nonce,
            deadline,
            signature,
        } = req.body;

        if (
            !patientWallet ||
            !identityCommitment ||
            !viewPermitRecipient ||
            !profileCommitment ||
            !profileSaltCommitment ||
            !encryptedFields ||
            !inputProof ||
            !healthDataHash ||
            nonce === undefined ||
            deadline === undefined ||
            !signature
        ) {
            return res.status(400).json({ error: "Missing registration fields (profileSaltCommitment, healthDataHash, deadline required)" });
        }
        if (!ethers.isAddress(patientWallet) || !ethers.isAddress(viewPermitRecipient)) {
            return res.status(400).json({ error: "Invalid address" });
        }

        const computedHash = await registry.computeHealthDataHash(
            encryptedFields.age,
            encryptedFields.gender,
            encryptedFields.weight,
            encryptedFields.height,
            encryptedFields.hasDiabetes,
            encryptedFields.hbLevel,
            encryptedFields.isSmoker,
            encryptedFields.hasHypertension,
            inputProof
        );
        if (computedHash !== healthDataHash) {
            return res.status(400).json({ error: "healthDataHash mismatch: encrypted vitals bundle is inconsistent" });
        }

        await registry.registerPatientViaRelayer.staticCall(
            ethers.getAddress(patientWallet),
            BigInt(identityCommitment),
            ethers.getAddress(viewPermitRecipient),
            profileCommitment,
            profileSaltCommitment,
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
            BigInt(deadline),
            signature
        );

        const tx = await registry.registerPatientViaRelayer(
            ethers.getAddress(patientWallet),
            BigInt(identityCommitment),
            ethers.getAddress(viewPermitRecipient),
            profileCommitment,
            profileSaltCommitment,
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
            BigInt(deadline),
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
            encryptedAmountCommitment,
            encryptedUnitsHandle,
            inputProof,
            nonce,
            deadline,
            signature,
            withdrawToNonce,
            withdrawToDeadline,
            withdrawToSignature,
        } = req.body;
        if (
            trialId === undefined ||
            nullifier === undefined ||
            !permitHolder ||
            !destination ||
            units === undefined ||
            !encryptedAmountCommitment ||
            !encryptedUnitsHandle ||
            !inputProof ||
            nonce === undefined ||
            deadline === undefined ||
            !signature ||
            withdrawToNonce === undefined ||
            withdrawToDeadline === undefined ||
            !withdrawToSignature
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
            encryptedAmountCommitment,
            encryptedUnitsHandle,
            inputProof,
            BigInt(nonce),
            BigInt(deadline),
            signature,
            BigInt(withdrawToNonce),
            BigInt(withdrawToDeadline),
            withdrawToSignature
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

async function relayStoreRegisterAuth(req, res) {
    try {
        const { trialId, nullifier, permitHolder, nonce, deadline, signature, vaultAddress } = req.body ?? {};
        if (
            trialId === undefined ||
            nullifier === undefined ||
            !permitHolder ||
            nonce === undefined ||
            deadline === undefined ||
            !signature
        ) {
            return res.status(400).json({ error: "Missing store-register-auth fields" });
        }
        const key = pendingRegisterAuthKey(trialId, nullifier);
        pendingRegisterAuthStore.set(key, {
            trialId: BigInt(trialId).toString(),
            nullifier: BigInt(nullifier).toString(),
            permitHolder: ethers.getAddress(permitHolder),
            nonce: BigInt(nonce).toString(),
            deadline: BigInt(deadline).toString(),
            signature,
            vaultAddress: vaultAddress ? ethers.getAddress(vaultAddress) : SPONSOR_INCENTIVE_VAULT_ADDRESS,
            storedAt: Date.now(),
        });
        res.json({ success: true });
    } catch (err) {
        console.error("relay/store-register-auth failed:", safeError(err));
        res.status(500).json({ error: safeError(err) });
    }
}

async function relayGetPendingRegisterAuth(req, res) {
    try {
        const { trialId, nullifier } = req.query ?? {};
        if (trialId === undefined || nullifier === undefined) {
            return res.status(400).json({ error: "Missing trialId or nullifier" });
        }
        const entry = pendingRegisterAuthStore.get(pendingRegisterAuthKey(trialId, nullifier));
        if (!entry) {
            return res.status(404).json({ error: "Pending register auth not found" });
        }
        res.json({ success: true, auth: entry });
    } catch (err) {
        console.error("relay/pending-register-auth failed:", safeError(err));
        res.status(500).json({ error: safeError(err) });
    }
}

async function relayStoreMilestoneAuth(req, res) {
    try {
        const {
            trialId,
            nullifier,
            patient,
            milestoneIndex,
            nonce,
            deadline,
            signature,
            milestoneManagerAddress,
        } = req.body ?? {};
        if (
            trialId === undefined ||
            nullifier === undefined ||
            !patient ||
            milestoneIndex === undefined ||
            nonce === undefined ||
            deadline === undefined ||
            !signature
        ) {
            return res.status(400).json({ error: "Missing store-milestone-auth fields" });
        }
        const key = pendingMilestoneAuthKey(trialId, nullifier, milestoneIndex);
        pendingMilestoneAuthStore.set(key, {
            trialId: BigInt(trialId).toString(),
            nullifier: BigInt(nullifier).toString(),
            patient: ethers.getAddress(patient),
            milestoneIndex: BigInt(milestoneIndex).toString(),
            nonce: BigInt(nonce).toString(),
            deadline: BigInt(deadline).toString(),
            signature,
            milestoneManagerAddress: milestoneManagerAddress ?? "",
            storedAt: Date.now(),
        });
        res.json({ success: true });
    } catch (err) {
        console.error("relay/store-milestone-auth failed:", safeError(err));
        res.status(500).json({ error: safeError(err) });
    }
}

async function relayGetPendingMilestoneAuth(req, res) {
    try {
        const { trialId, nullifier, milestoneIndex } = req.query ?? {};
        if (trialId === undefined || nullifier === undefined || milestoneIndex === undefined) {
            return res.status(400).json({ error: "Missing trialId, nullifier, or milestoneIndex" });
        }
        const entry = pendingMilestoneAuthStore.get(
            pendingMilestoneAuthKey(trialId, nullifier, milestoneIndex)
        );
        if (!entry) {
            return res.status(404).json({ error: "Pending milestone auth not found" });
        }
        res.json({ success: true, auth: entry });
    } catch (err) {
        console.error("relay/pending-milestone-auth failed:", safeError(err));
        res.status(500).json({ error: safeError(err) });
    }
}

async function relayStoreSponsorApplication(req, res) {
    try {
        const {
            applicant,
            orgName,
            docCid,
            filename,
            contentType,
            sizeBytes,
            aesKeyB64,
            requestTxHash,
            submittedAt,
        } = req.body ?? {};
        if (!applicant || !orgName || !docCid || !filename || !aesKeyB64) {
            return res.status(400).json({ error: "Missing sponsor application fields" });
        }
        const addr = ethers.getAddress(applicant);
        sponsorApplicationStore.set(addr.toLowerCase(), {
            applicant: addr,
            orgName: String(orgName).slice(0, 200),
            docCid: String(docCid),
            filename: String(filename).slice(0, 255),
            contentType: String(contentType || "application/octet-stream"),
            sizeBytes: Number(sizeBytes) || 0,
            aesKeyB64: String(aesKeyB64),
            requestTxHash: requestTxHash ? String(requestTxHash) : undefined,
            submittedAt: Number(submittedAt) || Date.now(),
        });
        res.json({ success: true });
    } catch (err) {
        console.error("relay/sponsor-application failed:", safeError(err));
        res.status(500).json({ error: safeError(err) });
    }
}

async function relayListSponsorApplications(req, res) {
    try {
        await assertRegistryOwnerWallet(req.headers["x-wallet-address"]);
        const applications = [...sponsorApplicationStore.values()].map(
            ({ aesKeyB64: _key, ...rest }) => rest
        );
        res.json({ success: true, applications });
    } catch (err) {
        const code = err.statusCode || 500;
        if (code >= 500) console.error("relay/sponsor-applications failed:", safeError(err));
        res.status(code).json({ error: safeError(err) });
    }
}

async function relayGetSponsorApplication(req, res) {
    try {
        await assertRegistryOwnerWallet(req.headers["x-wallet-address"]);
        const applicant = ethers.getAddress(req.params.address);
        const entry = sponsorApplicationStore.get(applicant.toLowerCase());
        if (!entry) {
            return res.status(404).json({ error: "Sponsor application not found" });
        }
        res.json({ success: true, application: entry });
    } catch (err) {
        const code = err.statusCode || 500;
        if (code >= 500) console.error("relay/sponsor-application GET failed:", safeError(err));
        res.status(code).json({ error: safeError(err) });
    }
}

async function relaySponsorTestAutoApproveStatus(_req, res) {
    try {
        const diag = await getSponsorTestAutoApproveDiagnostics();
        res.json(diag);
    } catch (err) {
        console.error("relay/sponsor-test-auto-approve status failed:", safeError(err));
        res.json({ enabled: false, reason: "status_check_failed" });
    }
}

async function relaySponsorTestAutoApprove(req, res) {
    try {
        if (!(await sponsorTestAutoApproveReady())) {
            return res.status(404).json({ error: "Sponsor test auto-approve is not enabled" });
        }
        const { applicant, orgName } = req.body ?? {};
        if (!applicant) {
            return res.status(400).json({ error: "Missing applicant address" });
        }
        const addr = ethers.getAddress(applicant);
        const stored = sponsorApplicationStore.get(addr.toLowerCase());
        const name = (orgName || stored?.orgName || "").trim();
        if (!name) {
            return res.status(400).json({
                error: "Missing orgName — submit a registration request with organization name first",
            });
        }

        const ownerWallet = getSponsorRegistryOwnerWallet();
        const registry = new ethers.Contract(
            SPONSOR_REGISTRY_ADDRESS,
            SPONSOR_REGISTRY_ABI,
            ownerWallet
        );
        const request = await registry.requests(addr);
        const status = Number(request.status);
        if (status !== 1) {
            return res.status(400).json({
                error:
                    status === 2
                        ? "Sponsor is already approved"
                        : "Submit an on-chain registration request before using test auto-approve",
            });
        }

        const tx = await registry.addSponsor(addr, name);
        const receipt = await tx.wait();
        sponsorApplicationStore.delete(addr.toLowerCase());
        res.json({ success: true, txHash: receipt.hash, sponsor: addr, orgName: name });
    } catch (err) {
        console.error("relay/sponsor-test-auto-approve failed:", formatContractRevert(err));
        res.status(500).json({ error: formatContractRevert(err) });
    }
}

app.get("/health", async (_, res) => {
    let relayerAuthorized = null;
    try {
        relayerAuthorized = await registry.authorizedRelayers(relayerWallet.address);
    } catch {
        relayerAuthorized = null;
    }
    res.json({
        status: "ok",
        registry: REGISTRY_ADDRESS,
        semaphore: SEMAPHORE_ADDRESS,
        eligibilityEngine: eligibilityEngineAddress,
        relayerWallet: relayerWallet.address,
        relayerAuthorized,
        chainId: ETHEREUM_SEPOLIA_CHAIN_ID,
        serverJsSha256: SERVER_JS_SHA256,
    });
});

app.get("/transparency", async (_, res) => {
    let relayerAuthorized = null;
    try {
        relayerAuthorized = await registry.authorizedRelayers(relayerWallet.address);
    } catch {
        relayerAuthorized = null;
    }
    res.json({
        relayerWallet: relayerWallet.address,
        relayerAuthorized,
        relayerGovernance: "P3.1 authorizedRelayers + 6-hour timelock (scheduleRelayerAuth / applyRelayerAuth)",
        finalizeGate: "HIGH-1: finalizeAnonymousApplyWithProof requires onlyAuthorizedRelayer; payout forgery blocked by FHE.select (P2)",
        defaultDecryptPath: "Patient-decrypt (browser) — recommended default; relayer never sees the eligibility bit",
        p02DecryptPath: "Optional defense-in-depth: when permitRecipient == relayerWallet, relayer independently re-decrypts (improves server-side verification, but the relayer learns the eligibility bit). Not used by the production UI. Requires acknowledgeRelayerVisibility=true.",
        ephemeralDecryptPath: "When permitRecipient is patient ephemeral, relayer submits gaslessly after client Noir proof (no relayer re-decrypt)",
        committeeMode: "P3.1-dual-independent",
        thresholdTarget: "2-of-2 (spec only — see docs/P3_3_THRESHOLD_ATTESTATION.md)",
        thresholdCommittee: "P3.3 on-chain quorum deferred until institutional pilot",
        metrics: { ...relayerMetrics },
        pinnedContracts: {
            registry: REGISTRY_ADDRESS,
            semaphore: SEMAPHORE_ADDRESS,
            eligibilityEngine: eligibilityEngineAddress,
            confidentialEth: CONFIDENTIAL_ETH_ADDRESS ?? null,
            stakingManager: STAKING_MANAGER_ADDRESS ?? null,
            sponsorIncentiveVault: SPONSOR_INCENTIVE_VAULT_ADDRESS ?? null,
        },
        chainId: ETHEREUM_SEPOLIA_CHAIN_ID,
        rpcUrlHost: (() => {
            try {
                return new URL(RPC_URL).host;
            } catch {
                return "configured";
            }
        })(),
        zamaRelayerConfigured: Boolean(ZAMA_RELAYER_URL),
        serverJsSha256: SERVER_JS_SHA256,
        loggingPolicy: {
            logged: ["route kind", "trialId", "tx hashes", "revert reasons (redacted)"],
            notLogged: [
                "patient vitals or health fields",
                "full ciphertext handles",
                "IPFS payloads",
                "Noir witness plaintext",
                "email/phone/SSN patterns",
            ],
        },
        publicMetadataReminder:
            "trialId and nullifier are public on-chain regardless of relayer logging policy",
        eligibilityDecrypt: {
            interimMitigation: "P0.2 defense-in-depth",
            structuralFix: "P2 FHE.select payout gating (shipped)",
            stagingTtlDays: 7,
            ignoresClientEligible: true,
        },
    });
});

async function relayPinDocument(req, res) {
    try {
        const pinSecret = process.env.RELAYER_PIN_SECRET?.trim();
        if (pinSecret) {
            const auth = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
            if (auth !== pinSecret) {
                return res.status(401).json({ error: "Unauthorized pin relay" });
            }
        }
        const { dataBase64, json, name } = req.body ?? {};
        let bytes;
        if (typeof dataBase64 === "string" && dataBase64.length > 0) {
            bytes = Buffer.from(dataBase64, "base64");
        } else if (json !== undefined) {
            bytes = Buffer.from(JSON.stringify(json), "utf8");
        } else {
            return res.status(400).json({ error: "Provide dataBase64 or json payload" });
        }
        const cid = await pinBufferToIpfs(bytes, typeof name === "string" ? name : "medvault-document");
        return res.json({ success: true, cid, IpfsHash: cid });
    } catch (err) {
        console.error("pin-document error:", err);
        return res.status(500).json({ error: err?.message || "Pin failed" });
    }
}

app.post("/relay/pin-document", limiter, relayPinDocument);
app.post("/relay/apply-stage", limiter, relayStage);
app.post("/relay/apply-finalize", limiter, relayFinalize);
app.post("/relay/cancel-stage", limiter, relayCancelStage);
app.post("/relay/register", limiter, relayRegister);
app.post("/relay/claim", limiter, relayClaim);
app.post("/relay/register-anon", limiter, relayRegisterAnon);
app.post("/relay/store-register-auth", limiter, relayStoreRegisterAuth);
app.get("/relay/pending-register-auth", limiter, relayGetPendingRegisterAuth);
app.post("/relay/store-milestone-auth", limiter, relayStoreMilestoneAuth);
app.get("/relay/pending-milestone-auth", limiter, relayGetPendingMilestoneAuth);
app.post("/relay/sponsor-application", limiter, relayStoreSponsorApplication);
app.get("/relay/sponsor-applications", limiter, relayListSponsorApplications);
app.get("/relay/sponsor-application/:address", limiter, relayGetSponsorApplication);
app.get("/relay/sponsor-test-auto-approve", limiter, relaySponsorTestAutoApproveStatus);
app.post("/relay/sponsor-test-auto-approve", limiter, relaySponsorTestAutoApprove);
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
        if (CONFIDENTIAL_ETH_ADDRESS) {
            watcher = startV09Watcher({
                provider,
                relayerWallet,
                zamaSdk,
                confidentialEthAddress: CONFIDENTIAL_ETH_ADDRESS,
                stakingManagerAddress: STAKING_MANAGER_ADDRESS,
                pollMs: Number(process.env.WATCHER_POLL_MS || 15_000),
            });
            if (WATCHER_ENABLED) {
                await watcher.start();
            } else {
                console.log(
                    "Watcher polling disabled (WATCHER_ENABLED=false) — on-demand /relay/completion-proof only"
                );
            }
        } else {
            console.warn("CONFIDENTIAL_ETH_ADDRESS unset — withdraw-to completion disabled");
        }

        app.listen(PORT, () => console.log(`MedVault relayer listening on port ${PORT}`));
    })
    .catch((err) => {
        console.error("Startup checks failed:", extractErrorMessage(err));
        process.exit(1);
    });
