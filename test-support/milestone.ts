import { ethers } from "hardhat";
import type { Signer } from "ethers";

export async function signMilestoneCompletion(
    signer: Signer,
    milestoneManagerAddress: string,
    params: {
        trialId: bigint;
        patient: string;
        milestoneIndex: bigint;
        nonce: bigint;
        deadline: bigint;
    }
): Promise<string> {
    const network = await ethers.provider.getNetwork();
    const domain = {
        name: "MedVault TrialMilestoneManager",
        version: "1",
        chainId: network.chainId,
        verifyingContract: milestoneManagerAddress,
    };
    const types = {
        MilestoneCompletion: [
            { name: "trialId", type: "uint256" },
            { name: "patient", type: "address" },
            { name: "milestoneIndex", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
        ],
    };
    return signer.signTypedData(domain, types, params);
}

export async function defaultMilestoneDeadline(): Promise<bigint> {
    const latest = await ethers.provider.getBlock("latest");
    return BigInt(latest!.timestamp + 3600);
}

export async function completeMilestoneSigned(
    milestoneManager: { getAddress: () => Promise<string>; milestoneCompletionNonce: (a: string) => Promise<bigint>; connect: (s: unknown) => { completeMilestone: (...args: unknown[]) => Promise<unknown> } },
    sponsor: Signer,
    patient: Signer,
    trialId: bigint,
    milestoneIndex: bigint
) {
    const patientAddress = await patient.getAddress();
    const mmAddr = await milestoneManager.getAddress();
    const nonce = await milestoneManager.milestoneCompletionNonce(patientAddress);
    const deadline = await defaultMilestoneDeadline();
    const patientSignature = await signMilestoneCompletion(patient, mmAddr, {
        trialId,
        patient: patientAddress,
        milestoneIndex,
        nonce,
        deadline,
    });
    return milestoneManager
        .connect(sponsor)
        .completeMilestone(trialId, patientAddress, milestoneIndex, deadline, patientSignature);
}
