import { expect } from "chai";
import { poseidon3 } from "poseidon-lite";
import { readFileSync } from "fs";
import { join } from "path";
import { semaphoreScopeField } from "../../test-support/semaphore";
import { computeProfileCommitment } from "../../test-support/profileCommitment";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import {
    buildEligibilityPublicInputs,
    CRITERIA_SCHEMA_HASH,
    BN254_FIELD_ORDER,
} from "../../test-support/noirProof";

function fieldToBytes32(value: bigint): `0x${string}` {
    return (`0x${value.toString(16).padStart(64, "0")}`) as `0x${string}`;
}

describe("Crypto: UltraHonk pipeline", function () {
    this.timeout(300_000);

    it("CRYPTO-HONK-01: HonkVerifier accepts evm-no-zk proof from Noir artifact", async function () {
        const circuit = JSON.parse(
            readFileSync(join(process.cwd(), "src/lib/circuits/eligibility_proof.json"), "utf8")
        );

        const hre = await import("hardhat");
        const { ethers } = hre.default ?? hre;
        const { Barretenberg, UltraHonkBackend } = await import("@aztec/bb.js");
        const { Noir } = await import("@noir-lang/noir_js");

        const secret = 12345678901234567890n;
        const commitment = 555n;
        const scope = 1n;
        const scopeInternal = semaphoreScopeField(scope);
        const eligibleField = 1n;
        const { poseidon2 } = await import("poseidon-lite");
        const nullifier = poseidon2([scopeInternal, secret]);
        const profileCommitment = computeProfileCommitment(commitment, ELIGIBLE_PROFILE);
        const resultHash = poseidon3([eligibleField, scope, secret]);

        const criteria = {
            minAge: 18,
            maxAge: 65,
            requiresDiabetes: false,
            minHb: 120,
            genderRequirement: 0,
            minHeight: 0,
            maxWeight: 0,
            requiresNonSmoker: false,
            requiresNormalBP: false,
        };

        const noirInputs: Record<string, string | boolean | number> = {
            secret: secret.toString(),
            scope_internal: scopeInternal.toString(),
            commitment: commitment.toString(),
            age: ELIGIBLE_PROFILE.age,
            gender: ELIGIBLE_PROFILE.gender,
            weight: ELIGIBLE_PROFILE.weight,
            height: ELIGIBLE_PROFILE.height,
            has_diabetes: ELIGIBLE_PROFILE.hasDiabetes,
            hb_level: ELIGIBLE_PROFILE.hbLevel,
            is_smoker: ELIGIBLE_PROFILE.isSmoker,
            has_hypertension: ELIGIBLE_PROFILE.hasHypertension,
            staged_fhe_handle: "999",
            decrypted_eligible: "1",
            criteria_binding_hash: "0",
            scope: scope.toString(),
            nullifier: nullifier.toString(),
            profile_commitment: profileCommitment.toString(),
            result_hash: resultHash.toString(),
            eligible: "1",
            fhe_stage_handle_hash: "999",
            criteria_schema_hash: (BigInt(CRITERIA_SCHEMA_HASH) % BN254_FIELD_ORDER).toString(),
            min_age: criteria.minAge,
            max_age: criteria.maxAge,
            requires_diabetes: "0",
            min_hb: criteria.minHb,
            gender_requirement: criteria.genderRequirement,
            min_height: criteria.minHeight,
            max_weight: criteria.maxWeight,
            requires_non_smoker: "0",
            requires_normal_bp: "0",
            criteria_mode: 0,
        };

        const proveOpts = { verifierTarget: "evm-no-zk" as const };
        const api = await Barretenberg.new({ threads: 1 });
        const backend = new UltraHonkBackend(circuit.bytecode, api);
        const noir = new Noir(circuit);
        const { witness } = await noir.execute(noirInputs);
        const { proof, publicInputs: rawPublicInputs } = await backend.generateProof(witness, proveOpts);

        expect(proof.length).to.be.greaterThan(6_000);
        expect(rawPublicInputs).to.have.length(17);

        const proofBytes = (`0x${Buffer.from(proof).toString("hex")}`) as `0x${string}`;
        const publicInputs = buildEligibilityPublicInputs(
            scope,
            BigInt(noirInputs.nullifier as string),
            profileCommitment,
            resultHash,
            true,
            999n,
            criteria
        );

        const HonkVerifier = await ethers.getContractFactory("HonkVerifier");
        const verifier = await HonkVerifier.deploy();
        await verifier.waitForDeployment();

        const ok = await verifier.verify.staticCall(proofBytes, publicInputs);
        expect(ok).to.equal(true);

        await api.destroy();
    });
});
