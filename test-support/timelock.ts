import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { Contract, Signer } from "ethers";

const TIMELOCK_SKIP_SECS = 6 * 3600 + 1;

export async function advanceTimelock(): Promise<void> {
    await time.increase(TIMELOCK_SKIP_SECS);
}

export async function scheduleAndApply(
    schedule: () => Promise<unknown>,
    apply: () => Promise<unknown>
): Promise<void> {
    await schedule();
    await advanceTimelock();
    await apply();
}

export async function authorizeCethContract(
    cETH: Contract,
    owner: Signer,
    contract: string,
    authorize = true
): Promise<void> {
    await scheduleAndApply(
        () => cETH.connect(owner).scheduleContractAuth(contract, authorize),
        () => cETH.connect(owner).applyContractAuth(contract)
    );
}

/** P3.1: Authorize a relayer on MedVaultRegistry via timelock (hardhat auto-advances). */
export async function authorizeRelayer(
    registry: Contract,
    owner: Signer,
    relayer: string,
    authorize = true
): Promise<void> {
    await scheduleAndApply(
        () => registry.connect(owner).scheduleRelayerAuth(relayer, authorize),
        () => registry.connect(owner).applyRelayerAuth(relayer)
    );
}
