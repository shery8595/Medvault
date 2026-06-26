import { ethers } from "ethers";
import addresses from "./addresses.json";
import AnonymousPatientRegistryAbi from "./abis/AnonymousPatientRegistry.json";
import TrialManagerAbi from "./abis/TrialManager.json";
import ConsentManagerAbi from "./abis/ConsentManager.json";
import EligibilityEngineAbi from "./abis/EligibilityEngine.json";
import ConfidentialETHAbi from "./abis/ConfidentialETH.json";
import SponsorIncentiveVaultAbi from "./abis/SponsorIncentiveVault.json";
import DataAccessLogAbi from "./abis/DataAccessLog.json";
import TrialMilestoneManagerAbi from "./abis/TrialMilestoneManager.json";
import SponsorRegistryAbi from "./abis/SponsorRegistry.json";
import MedVaultAutomationAbi from "./abis/MedVaultAutomation.json";
import StakingManagerAbi from "./abis/StakingManager.json";
import MedVaultRegistryAbi from "./abis/MedVaultRegistry.json";
import EncryptedScoreLeaderboardAbi from "./abis/EncryptedScoreLeaderboard.json";
import HonkVerifierAbi from "./abis/HonkVerifier.json";
import { ETHEREUM_SEPOLIA_CHAIN_ID } from "../zamaChain";

type ReclaimInfra = {
    reclaim: string;
    reclaimSemaphore: string;
    semaphoreVerifier: string;
};

/** Arbitrum One (42161) — Reclaim verifier + Semaphore/verifier from Reclaim address book. */
export function getArbitrumOneReclaimInfra(): (ReclaimInfra & { chainId: 42161n }) | null {
    const a = (addresses as Record<string, unknown>).arbitrum as
        | { Reclaim?: string; Semaphore?: string; SemaphoreVerifier?: string }
        | undefined;
    if (!a?.Reclaim) return null;
    return {
        chainId: 42161n,
        reclaim: a.Reclaim,
        reclaimSemaphore: a.Semaphore!,
        semaphoreVerifier: a.SemaphoreVerifier!,
    };
}

/** Ethereum Sepolia (11155111) — Reclaim verifier + Reclaim Semaphore table. */
export function getEthereumSepoliaReclaimInfra(): (ReclaimInfra & { chainId: 11155111n }) | null {
    const a = (addresses as Record<string, unknown>).sepolia as
        | { Reclaim?: string; ReclaimSemaphore?: string; SemaphoreVerifier?: string }
        | undefined;
    if (!a?.Reclaim) return null;
    if (!a.ReclaimSemaphore || !a.SemaphoreVerifier) return null;
    return {
        chainId: 11155111n,
        reclaim: a.Reclaim,
        reclaimSemaphore: a.ReclaimSemaphore,
        semaphoreVerifier: a.SemaphoreVerifier,
    };
}

export type MedVaultNetworkKey = "sepolia" | "hardhat";

type ContractName =
    | "AnonymousPatientRegistry"
    | "TrialManager"
    | "ConsentManager"
    | "EligibilityEngine"
    | "ConfidentialETH"
    | "SponsorIncentiveVault"
    | "DataAccessLog"
    | "TrialMilestoneManager"
    | "SponsorRegistry"
    | "MedVaultAutomation"
    | "StakingManager"
    | "MedVaultRegistry"
    | "EncryptedScoreLeaderboard"
    | "HonkVerifier";

export const getContractAddresses = (network: MedVaultNetworkKey = "sepolia") => {
    return (addresses as Record<string, Record<string, string>>)[network];
};

export const resolveNetworkKey = (chainId?: bigint | number): MedVaultNetworkKey => {
    if (chainId === undefined) return "sepolia";
    const normalized = typeof chainId === "number" ? BigInt(chainId) : chainId;
    if (normalized === ETHEREUM_SEPOLIA_CHAIN_ID) return "sepolia";
    if (normalized === 31337n) return "hardhat";
    return "sepolia";
};

export const getContractAddressForChain = (contractName: ContractName, chainId?: bigint | number) => {
    const network = resolveNetworkKey(chainId);
    const primary = (addresses as Record<string, Record<string, string>>)[network]?.[contractName];
    if (primary) return primary;
    return (addresses as Record<string, Record<string, string>>).sepolia?.[contractName];
};

const getAbi = (abiData: { abi?: unknown } | unknown[]) => {
    return Array.isArray(abiData) ? abiData : (abiData as { abi: unknown }).abi;
};

const abiMap: Record<ContractName, unknown> = {
    AnonymousPatientRegistry: AnonymousPatientRegistryAbi,
    TrialManager: TrialManagerAbi,
    ConsentManager: ConsentManagerAbi,
    EligibilityEngine: EligibilityEngineAbi,
    ConfidentialETH: ConfidentialETHAbi,
    SponsorIncentiveVault: SponsorIncentiveVaultAbi,
    DataAccessLog: DataAccessLogAbi,
    TrialMilestoneManager: TrialMilestoneManagerAbi,
    SponsorRegistry: SponsorRegistryAbi,
    MedVaultAutomation: MedVaultAutomationAbi,
    StakingManager: StakingManagerAbi,
    MedVaultRegistry: MedVaultRegistryAbi,
    EncryptedScoreLeaderboard: EncryptedScoreLeaderboardAbi,
    HonkVerifier: HonkVerifierAbi,
};

export const getContract = (
    contractName: ContractName,
    signerOrProvider: ethers.Signer | ethers.Provider,
    networkOrChainId?: MedVaultNetworkKey | bigint | number
) => {
    const network =
        networkOrChainId === undefined
            ? "sepolia"
            : typeof networkOrChainId === "string"
              ? networkOrChainId
              : resolveNetworkKey(networkOrChainId);
    const networkAddresses = getContractAddresses(network === "hardhat" ? "hardhat" : "sepolia");
    if (!networkAddresses) {
        throw new Error(`No addresses found for network: ${network}`);
    }
    const address = networkAddresses[contractName];
    if (!address) {
        throw new Error(`Address for ${contractName} not found on network: ${network}`);
    }

    const abi = getAbi(abiMap[contractName]);
    return new ethers.Contract(address, abi as ethers.InterfaceAbi, signerOrProvider);
};

export async function resolveChainIdFrom(
    signerOrProvider: ethers.Signer | ethers.Provider
): Promise<bigint | undefined> {
    try {
        if ("provider" in signerOrProvider && signerOrProvider.provider) {
            const network = await signerOrProvider.provider.getNetwork();
            return network.chainId;
        }
        const network = await (signerOrProvider as ethers.Provider).getNetwork();
        return network.chainId;
    } catch {
        return undefined;
    }
}

export async function getContractAsync(
    contractName: ContractName,
    signerOrProvider: ethers.Signer | ethers.Provider
) {
    const chainId = await resolveChainIdFrom(signerOrProvider);
    return getContract(contractName, signerOrProvider, chainId);
}

export const getAnonymousPatientRegistry = (
    signer: ethers.Signer | ethers.Provider,
    chainId?: bigint | number
) => getContract("AnonymousPatientRegistry", signer, chainId);
export const getTrialManager = (signer: ethers.Signer | ethers.Provider, chainId?: bigint | number) =>
    getContract("TrialManager", signer, chainId);
export const getConsentManager = (signer: ethers.Signer | ethers.Provider, chainId?: bigint | number) =>
    getContract("ConsentManager", signer, chainId);
export const getEligibilityEngine = (signer: ethers.Signer | ethers.Provider, chainId?: bigint | number) =>
    getContract("EligibilityEngine", signer, chainId);
export const getConfidentialETH = (signer: ethers.Signer | ethers.Provider, chainId?: bigint | number) =>
    getContract("ConfidentialETH", signer, chainId);
export const getSponsorIncentiveVault = (signer: ethers.Signer | ethers.Provider, chainId?: bigint | number) =>
    getContract("SponsorIncentiveVault", signer, chainId);
export const getDataAccessLog = (signer: ethers.Signer | ethers.Provider, chainId?: bigint | number) =>
    getContract("DataAccessLog", signer, chainId);
export const getTrialMilestoneManager = (signer: ethers.Signer | ethers.Provider, chainId?: bigint | number) =>
    getContract("TrialMilestoneManager", signer, chainId);
export const getSponsorRegistry = (signer: ethers.Signer | ethers.Provider, chainId?: bigint | number) =>
    getContract("SponsorRegistry", signer, chainId);
export const getMedVaultAutomation = (signer: ethers.Signer | ethers.Provider, chainId?: bigint | number) =>
    getContract("MedVaultAutomation", signer, chainId);
export const getStakingManager = (signer: ethers.Signer | ethers.Provider, chainId?: bigint | number) =>
    getContract("StakingManager", signer, chainId);
export const getMedVaultRegistry = (signer: ethers.Signer | ethers.Provider, chainId?: bigint | number) =>
    getContract("MedVaultRegistry", signer, chainId);
export const getEncryptedScoreLeaderboard = (
    signer: ethers.Signer | ethers.Provider,
    chainId?: bigint | number
) => getContract("EncryptedScoreLeaderboard", signer, chainId);
export const getHonkVerifier = (signer: ethers.Signer | ethers.Provider, chainId?: bigint | number) =>
    getContract("HonkVerifier", signer, chainId);
