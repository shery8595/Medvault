import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMedVaultStack, seedPatientClear } from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { Identity } from "@semaphore-protocol/identity";

const BATCH_SIZES = [5, 10, 15, 20, 25];

describe("Unit: High-concurrency patient registrations", function () {
    this.timeout(600_000);

    for (const batch of BATCH_SIZES) {
        it(`HCR-${batch}: sequential ${batch} clear registrations preserve count`, async function () {
            const stack = await deployMedVaultStack();
            const start = await stack.anonymousPatientRegistry.getPatientCount();
            const commitments: bigint[] = [];

            for (let i = 0; i < batch; i++) {
                const id = new Identity();
                commitments.push(id.commitment);
                const profile = {
                    ...ELIGIBLE_PROFILE,
                    age: 20 + (i % 40),
                    weight: 55 + (i % 50),
                };
                await seedPatientClear(stack, id.commitment, stack.patient.address, profile);
            }

            const end = await stack.anonymousPatientRegistry.getPatientCount();
            expect(end - start).to.equal(BigInt(batch));

            for (const c of commitments) {
                expect(await stack.anonymousPatientRegistry.checkRegistration(c)).to.equal(true);
            }
        });
    }

    it("HCR-GAS: registration gas stays bounded across 30 patients", async function () {
        const stack = await deployMedVaultStack();
        const registryAddr = await stack.medVaultRegistry.getAddress();
        const registrySigner = await ethers.getImpersonatedSigner(registryAddr);
        await ethers.provider.send("hardhat_setBalance", [registryAddr, "0x1000000000000000000"]);
        const gasSamples: bigint[] = [];
        for (let i = 0; i < 30; i++) {
            const id = new Identity();
            const tx = await stack.anonymousPatientRegistry.connect(registrySigner).registerPatientClear(
                id.commitment,
                stack.patient.address,
                ELIGIBLE_PROFILE.age,
                ELIGIBLE_PROFILE.gender,
                ELIGIBLE_PROFILE.weight,
                ELIGIBLE_PROFILE.height,
                ELIGIBLE_PROFILE.hasDiabetes,
                ELIGIBLE_PROFILE.hbLevel,
                ELIGIBLE_PROFILE.isSmoker,
                ELIGIBLE_PROFILE.hasHypertension
            );
            const rec = await tx.wait();
            gasSamples.push(rec!.gasUsed);
        }
        const max = gasSamples.reduce((a, b) => (a > b ? a : b), 0n);
        const min = gasSamples.reduce((a, b) => (a < b ? a : b), gasSamples[0]!);
        expect(max - min).to.be.lt(500_000n);
    });
});
