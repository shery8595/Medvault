import hre from "hardhat";

const HARDHAT_CHAIN_ID = 31337;

/**
 * Reset Hardhat to a clean local mock network (chainId 31337).
 * Use after any test that called `hardhat_reset` with `forking` so fhEVM mock state is restored.
 * Do not call `initializeCLIApi` here — that is for live Sepolia/mainnet only and breaks the mock.
 */
export async function resetHardhatFheMockNetwork(): Promise<void> {
    await hre.network.provider.request({
        method: "hardhat_reset",
        params: [{}],
    });
    const net = await hre.ethers.provider.getNetwork();
    if (net.chainId !== BigInt(HARDHAT_CHAIN_ID)) {
        throw new Error(`hardhat_reset did not restore chainId ${HARDHAT_CHAIN_ID} (got ${net.chainId})`);
    }
}
