#!/usr/bin/env node
/**
 * MedVault FHE lifecycle demo — video-ready terminal walkthrough on Ethereum Sepolia.
 *
 * Usage:
 *   npm run demo:fhe              # verbose demo
 *   npm run demo:fhe -- --smoke   # CI smoke (terse)
 *
 * Environment:
 *   SEPOLIA_RPC_URL          — JSON-RPC (required for on-chain steps)
 *   DEMO_PRIVATE_KEY         — wallet with Sepolia ETH (or SEPOLIA_DEMO_PRIVATE_KEY)
 *   DEMO_RUN_TXS=1           — optional: run on-chain txs (register + stage apply)
 *
 * Without RPC/key: exits 0 with skip message (CI-friendly).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";
import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import { generateProof } from "@semaphore-protocol/proof";
import { poseidon2 } from "poseidon-lite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SMOKE = process.argv.includes("--smoke");
const RUN_TXS = process.env.DEMO_RUN_TXS === "1" || process.env.DEMO_RUN_TXS === "true";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BLUE = "\x1b[34m";

const ETHERSCAN = "https://sepolia.etherscan.io";

const PROFILE = {
  age: 30,
  gender: true,
  weight: 70,
  height: 175,
  hasDiabetes: false,
  hbLevel: 140,
  isSmoker: false,
  hasHypertension: false,
};

const CRITERIA = {
  minAge: 18,
  maxAge: 65,
  requiresDiabetes: false,
  minHb: 100,
  genderRequirement: 0,
  minHeight: 0,
  maxWeight: 65535,
  requiresNonSmoker: false,
  requiresNormalBP: false,
};

function log(msg) {
  if (!SMOKE) console.log(msg);
}

function step(n, title) {
  const line = `${CYAN}${BOLD}Step ${n}:${RESET} ${title}`;
  console.log(SMOKE ? `[${n}] ${title}` : line);
}

function ok(msg) {
  console.log(`${GREEN}✓${RESET} ${msg}`);
}

function warn(msg) {
  console.log(`${YELLOW}!${RESET} ${msg}`);
}

function fail(msg) {
  console.error(`${RED}✗${RESET} ${msg}`);
  process.exit(1);
}

function txLink(hash) {
  return `${ETHERSCAN}/tx/${hash}`;
}

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function loadAbi(name) {
  const j = loadJson(`packages/medvault-core/data/abis/${name}.json`);
  return j.abi ?? j;
}

function semaphoreScopeField(scope) {
  return BigInt(ethers.keccak256(ethers.zeroPadValue(ethers.toBeHex(scope), 32))) >> 8n;
}

function deriveNullifier(identity, trialId) {
  return poseidon2([semaphoreScopeField(BigInt(trialId)), identity.secretScalar]);
}

async function fetchGroup(registry, provider) {
  const latest = await provider.getBlockNumber();
  const start = Math.max(0, latest - 2_000_000);
  const filter = registry.filters.PatientRegistered();
  const events = await registry.queryFilter(filter, start, latest);
  const commitments = [...new Set(events.map((e) => BigInt(e.args.commitment)))];
  const verified = [];
  for (const c of commitments) {
    if (await registry.isRegisteredMember(c)) verified.push(c);
  }
  return new Group(verified);
}

async function encryptProfile(fhevm, aprAddr, mvrAddr) {
  const input = fhevm.createEncryptedInput(aprAddr, mvrAddr);
  input.add8(PROFILE.age);
  input.addBool(PROFILE.gender);
  input.add16(PROFILE.weight);
  input.add8(PROFILE.height);
  input.addBool(PROFILE.hasDiabetes);
  input.add16(PROFILE.hbLevel);
  input.addBool(PROFILE.isSmoker);
  input.addBool(PROFILE.hasHypertension);
  return input.encrypt();
}

async function encryptCriteria(fhevm, tmAddr, sponsorAddr) {
  const input = fhevm.createEncryptedInput(tmAddr, sponsorAddr);
  input.add8(CRITERIA.minAge);
  input.add8(CRITERIA.maxAge);
  input.addBool(CRITERIA.requiresDiabetes);
  input.add16(CRITERIA.minHb);
  input.add8(CRITERIA.genderRequirement);
  input.add8(CRITERIA.minHeight);
  input.add16(CRITERIA.maxWeight);
  input.addBool(CRITERIA.requiresNonSmoker);
  input.addBool(CRITERIA.requiresNormalBP);
  return input.encrypt();
}

function parseEvent(receipt, iface, name, arg) {
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === name) return parsed.args[arg];
    } catch {
      /* skip */
    }
  }
  return undefined;
}

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.VITE_SEPOLIA_RPC_URL || "";
  const pk =
    process.env.DEMO_PRIVATE_KEY ||
    process.env.SEPOLIA_DEMO_PRIVATE_KEY ||
    process.env.PRIVATE_KEY ||
    "";

  if (!rpcUrl) {
    warn("SEPOLIA_RPC_URL not set — skipping demo (exit 0)");
    process.exit(0);
  }

  if (!SMOKE) {
    console.log(`\n${BOLD}${BLUE}MedVault FHE Lifecycle Demo${RESET}`);
    console.log(`${DIM}Ethereum Sepolia · Zama fhEVM${RESET}\n`);
  }

  const addresses = loadJson("packages/medvault-core/data/addresses.json").sepolia;
  const tmAbi = loadAbi("TrialManager");
  const mvrAbi = loadAbi("MedVaultRegistry");
  const eeAbi = loadAbi("EligibilityEngine");
  const srAbi = loadAbi("SponsorRegistry");

  step(1, "Connect Sepolia provider");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  if (network.chainId !== 11155111n) {
    fail(`Expected Sepolia (11155111), got chain ${network.chainId}`);
  }
  ok(`Connected — chainId ${network.chainId}`);

  step(2, "Verify deployed contracts");
  const targets = [
    ["EligibilityEngine", addresses.EligibilityEngine],
    ["TrialManager", addresses.TrialManager],
    ["MedVaultRegistry", addresses.MedVaultRegistry],
    ["AnonymousPatientRegistry", addresses.AnonymousPatientRegistry],
  ];
  for (const [label, addr] of targets) {
    const code = await provider.getCode(addr);
    if (!code || code === "0x") fail(`${label} has no bytecode at ${addr}`);
    ok(`${label} deployed at ${addr}`);
  }

  step(3, "Initialize Zama FHE relayer SDK");
  const fhevm = await createInstance({ ...SepoliaConfig, network: rpcUrl });
  ok("FHE relayer SDK connected");

  step(4, "Encrypt patient profile (off-chain FHE)");
  const { handles: profileHandles, inputProof: profileProof } = await encryptProfile(
    fhevm,
    addresses.AnonymousPatientRegistry,
    addresses.MedVaultRegistry
  );
  ok(`Patient profile encrypted — ${profileHandles.length} handles`);

  step(5, "Encrypt sponsor criteria (off-chain FHE)");
  const sponsorAddr = pk ? new ethers.Wallet(pk, provider).address : ethers.ZeroAddress;
  const { handles: criteriaHandles, inputProof: criteriaProof } = await encryptCriteria(
    fhevm,
    addresses.TrialManager,
    sponsorAddr
  );
  ok(`Sponsor criteria encrypted — ${criteriaHandles.length} handles`);

  if (!pk) {
    warn("DEMO_PRIVATE_KEY not set — skipping on-chain txs (health + encrypt OK, exit 0)");
    process.exit(0);
  }

  const wallet = new ethers.Wallet(pk, provider);
  const trialManager = new ethers.Contract(addresses.TrialManager, tmAbi, wallet);
  const registry = new ethers.Contract(addresses.MedVaultRegistry, mvrAbi, wallet);
  const sponsorRegistry = new ethers.Contract(addresses.SponsorRegistry, srAbi, provider);

  const trialCounter = await trialManager.trialCounter();
  log(`${DIM}trialCounter: ${trialCounter}${RESET}`);

  if (!RUN_TXS) {
    ok("DEMO_RUN_TXS not set — health + encrypt checks passed (exit 0)");
    process.exit(0);
  }

  step(6, "Create trial with encrypted criteria (on-chain tx)");
  const isSponsor = await sponsorRegistry.isSponsor(wallet.address).catch(() => false);
  if (!isSponsor) {
    warn(`Wallet ${wallet.address} is not a verified sponsor — skipping trial creation`);
  } else {
    const trialName = `Demo-FHE-${Date.now()}`;
    const tx = await trialManager.createTrialWithEncryptedCriteria(
      trialName,
      "Phase 2",
      "Sepolia",
      "0.1 ETH",
      criteriaHandles[0],
      criteriaHandles[1],
      criteriaHandles[2],
      criteriaHandles[3],
      criteriaHandles[4],
      criteriaHandles[5],
      criteriaHandles[6],
      criteriaHandles[7],
      criteriaHandles[8],
      criteriaProof,
      7 * 86400
    );
    const receipt = await tx.wait();
    ok(`Trial created — ${txLink(receipt.hash)}`);
  }

  step(7, "Register patient + stage anonymous apply");
  const identity = new Identity();
  const commitment = identity.commitment;
  const profileCommitment = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint8", "bool", "uint16", "uint8", "bool", "uint16", "bool", "bool"],
      [
        commitment,
        PROFILE.age,
        PROFILE.gender,
        PROFILE.weight,
        PROFILE.height,
        PROFILE.hasDiabetes,
        PROFILE.hbLevel,
        PROFILE.isSmoker,
        PROFILE.hasHypertension,
      ]
    )
  );

  const regTx = await registry.registerPatient(
    commitment,
    wallet.address,
    profileCommitment,
    profileHandles[0],
    profileHandles[1],
    profileHandles[2],
    profileHandles[3],
    profileHandles[4],
    profileHandles[5],
    profileHandles[6],
    profileHandles[7],
    profileProof
  );
  const regReceipt = await regTx.wait();
  ok(`Patient registered — ${txLink(regReceipt.hash)}`);

  const newTrialId = (await trialManager.trialCounter()) - 1n;
  const trialId = isSponsor ? newTrialId : (trialCounter > 0n ? trialCounter - 1n : 0n);
  const nullifier = deriveNullifier(identity, trialId);

  const group = await fetchGroup(registry, provider);
  const proof = await generateProof(identity, group, identity.commitment, BigInt(trialId));

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const domain = {
    name: "MedVaultRegistry",
    version: "1",
    chainId: 11155111,
    verifyingContract: addresses.MedVaultRegistry,
  };
  const permitSig = await wallet.signTypedData(domain, {
    AnonymousApply: [
      { name: "trialId", type: "uint256" },
      { name: "commitment", type: "uint256" },
      { name: "nullifier", type: "uint256" },
      { name: "permitRecipient", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
  }, {
    trialId,
    commitment,
    nullifier,
    permitRecipient: wallet.address,
    deadline,
  });

  const stageTx = await registry.stageAnonymousApply(
    trialId,
    {
      merkleTreeDepth: proof.merkleTreeDepth,
      merkleTreeRoot: proof.merkleTreeRoot,
      nullifier: proof.nullifier,
      message: proof.message,
      scope: proof.scope,
      points: proof.points,
    },
    commitment,
    wallet.address,
    deadline,
    permitSig
  );
  const stageReceipt = await stageTx.wait();
  const finalCt = parseEvent(stageReceipt, registry.interface, "AnonymousApplyStaged", "finalCt");
  ok(`Eligibility staged — finalCt handle ${finalCt} — ${txLink(stageReceipt.hash)}`);

  step(8, "Decrypt eligibility result (local FHE)");
  try {
    const handleHex = ethers.hexlify(finalCt);
    await fhevm.generateKeypair();
    const eip712 = fhevm.createEIP712(
      addresses.EligibilityEngine,
      await wallet.getAddress()
    );
    const start = Math.floor(Date.now() / 1000);
    const durationDays = 7;
    const signature = await wallet.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      eip712.message
    );
    const result = await fhevm.userDecrypt(
      [{ handle: handleHex, contractAddress: addresses.EligibilityEngine }],
      signature.replace("0x", ""),
      await wallet.getAddress(),
      start,
      durationDays
    );
    const eligible = Object.values(result)[0];
    ok(`Decrypted eligibility: ${eligible}`);
  } catch (err) {
    warn(`Decrypt step skipped or failed: ${err instanceof Error ? err.message : err}`);
  }

  if (!SMOKE) {
    console.log(`\n${GREEN}${BOLD}Demo complete.${RESET} Live app: https://med-vault.xyz\n`);
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
