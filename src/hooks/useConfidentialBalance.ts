import { useState, useCallback, useEffect } from "react";
import { useWeb3 } from "../lib/Web3Context";
import { getConfidentialETH } from "../lib/contracts";
import { ethers } from "ethers";
import {
    ensureZamaConnected,
    isZamaUserRejection,
    reencryptUint64,
    reencryptUint64WithEphemeral,
} from "../lib/fhe";
import {
    requestEncryptedWithdraw,
    completeEncryptedWithdraw,
    signPublicExitAuthorization,
    completePublicExitViaRelayer,
    type WithdrawExitMode,
} from "../lib/withdrawFlow";
import { generateStealthRecipient } from "../lib/stealthAddress";
import { getStoredIdentity } from "../lib/semaphore";
import { getMedVaultRelayerUrl } from "../lib/mobile";

export function useConfidentialBalance() {
    const { signer, account } = useWeb3();
    const [balanceMwei, setBalanceMwei] = useState<number | null>(null);
    const [balanceEth, setBalanceEth] = useState<string | null>(null);
    const [walletBalanceEth, setWalletBalanceEth] = useState<string | null>(null);
    const [rewardBalanceEth, setRewardBalanceEth] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRevealed, setIsRevealed] = useState(false);

    const fetchEncryptedBalance = useCallback(async (address?: string | null) => {
        if (!signer || !address) return null;
        try {
            const contract = getConfidentialETH(signer);
            const handle = await contract.getBalance(address);
            return handle.toString();
        } catch (err: unknown) {
            console.error("Failed to fetch encrypted balance:", err);
            return null;
        }
    }, [signer]);

    const formatUnitsAsEth = (units: number) => (units / 1_000_000).toFixed(6);

    const revealBalance = useCallback(async () => {
        if (!signer || !account) {
            setError("Wallet not connected");
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const contract = getConfidentialETH(signer);
            const contractAddress = await contract.getAddress();

            const provider = signer.provider;
            if (!provider) {
                throw new Error("Wallet provider not available");
            }

            await ensureZamaConnected(provider, signer);

            const walletHandle = await fetchEncryptedBalance(account);
            let walletUnits = 0;
            if (walletHandle && BigInt(walletHandle) !== 0n) {
                const decryptedValue = await reencryptUint64(contractAddress, account, walletHandle);
                walletUnits = Number(decryptedValue);
            }

            let rewardUnits = 0;
            const identity = getStoredIdentity();
            if (identity && provider) {
                const { generateEphemeralAddress, getEphemeralSigner } = await import("../lib/semaphore");
                const ephemeralAddress = await generateEphemeralAddress(identity);
                const rewardHandle = await fetchEncryptedBalance(ephemeralAddress);
                if (rewardHandle && BigInt(rewardHandle) !== 0n) {
                    const ephemeralSigner = getEphemeralSigner(identity, provider);
                    const decryptedRewardValue = await reencryptUint64WithEphemeral(
                        ephemeralSigner,
                        contractAddress,
                        rewardHandle
                    );
                    rewardUnits = Number(decryptedRewardValue);
                }
            }

            const units = walletUnits + rewardUnits;
            setBalanceMwei(units);
            setWalletBalanceEth(formatUnitsAsEth(walletUnits));
            setRewardBalanceEth(formatUnitsAsEth(rewardUnits));
            setBalanceEth(formatUnitsAsEth(units));
            setIsRevealed(true);
        } catch (err: unknown) {
            console.error("Decryption failed:", err);
            if (isZamaUserRejection(err)) {
                setError("You cancelled the signature request.");
            } else {
                setError((err as Error).message || "Failed to reveal balance");
            }
        } finally {
            setLoading(false);
        }
    }, [signer, account, fetchEncryptedBalance]);

    const hideBalance = () => {
        setIsRevealed(false);
        setBalanceMwei(null);
        setBalanceEth(null);
        setWalletBalanceEth(null);
        setRewardBalanceEth(null);
    };

    const deposit = async (amountEth: string) => {
        if (!signer) return;
        try {
            setLoading(true);
            const contract = getConfidentialETH(signer);
            const tx = await contract.deposit({ value: ethers.parseEther(amountEth) });
            await tx.wait();
            hideBalance();
        } catch (err: unknown) {
            console.error("Deposit failed:", err);
            setError((err as Error).message || "Failed to deposit funds");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    /**
     * Encrypted withdraw with optional exit mode:
     * - wallet: direct complete to connected wallet (public amount at settlement)
     * - fast: relayer + stealth recipient, immediate
     * - private_batch: relayer + stealth recipient, batched settlement
     */
    const withdraw = async (amountEth: string, exitMode: WithdrawExitMode = "wallet") => {
        if (!signer || !account) return;
        try {
            setLoading(true);
            const contract = getConfidentialETH(signer);
            const contractAddress = await contract.getAddress();
            const unitsString = (parseFloat(amountEth) * 1_000_000).toFixed(0);
            const units = parseInt(unitsString, 10);
            if (units <= 0) throw new Error("Amount too low. Minimum is 0.000001 ETH");

            const { transferableHandle } = await requestEncryptedWithdraw(signer, units);

            if (exitMode === "wallet") {
                await completeEncryptedWithdraw(signer, transferableHandle);
            } else {
                const provider = signer.provider;
                if (!provider) throw new Error("Wallet provider not available");
                const network = await provider.getNetwork();
                const stealth = generateStealthRecipient();
                const nonce = await contract.withdrawNonces(account);
                const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
                const signature = await signPublicExitAuthorization(signer, {
                    contractAddress,
                    chainId: Number(network.chainId),
                    owner: account,
                    stealthRecipient: stealth.address,
                    transferableHandle,
                    exitMode,
                    nonce,
                    deadline,
                });

                await completePublicExitViaRelayer(getMedVaultRelayerUrl(), {
                    owner: account,
                    stealthRecipient: stealth.address,
                    exitMode: exitMode === "private_batch" ? 1 : 0,
                    nonce: nonce.toString(),
                    deadline: deadline.toString(),
                    signature,
                    transferableHandle,
                });
            }

            hideBalance();
        } catch (err: unknown) {
            console.error("Withdrawal failed:", err);
            setError((err as Error).message || "Failed to complete withdrawal");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        hideBalance();
    }, [account]);

    return {
        balanceEth,
        walletBalanceEth,
        rewardBalanceEth,
        isRevealed,
        loading,
        error,
        revealBalance,
        hideBalance,
        deposit,
        withdraw,
    };
}
