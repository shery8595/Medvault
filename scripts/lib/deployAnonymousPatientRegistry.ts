import { ethers } from "hardhat";
import type { Contract } from "ethers";

/** Deploy production AnonymousPatientRegistry (no Poseidon library). */
export async function deployAnonymousPatientRegistry(): Promise<Contract> {
    const factory = await ethers.getContractFactory("AnonymousPatientRegistry");
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    return contract;
}

/** Deploy Hardhat test harness with linked PoseidonT4 (unlimited size on local network). */
export async function deployAnonymousPatientRegistryTestHarness(): Promise<Contract> {
    const Poseidon = await ethers.getContractFactory(
        "poseidon-solidity/PoseidonT4.sol:PoseidonT4"
    );
    const poseidonLib = await Poseidon.deploy();
    await poseidonLib.waitForDeployment();
    const poseidonAddress = await poseidonLib.getAddress();

    const factory = await ethers.getContractFactory("AnonymousPatientRegistryTestHarness", {
        libraries: {
            PoseidonT4: poseidonAddress,
        },
    });
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    return contract;
}
