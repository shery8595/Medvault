import { useState, useEffect, useCallback } from "react";
import { useWeb3 } from "../lib/Web3Context";
import { getStakingManager } from "../lib/contracts";
import { ethers } from "ethers";
import {
    ensureZamaConnected,
    isZamaUserRejection,
    publicDecrypt,
    reencryptUint64,
    encryptUint64,
} from "../lib/fhe";
import { parseEventArg } from "../lib/contractEvents";

export function useStaking() {
    const { signer, account } = useWeb3();
    const [stakedBalanceGwei, setStakedBalanceGwei] = useState<bigint | null>(null);
    const [stakedBalanceEth, setStakedBalanceEth] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRevealed, setIsRevealed] = useState(false);

    const fetchEncryptedBalance = useCallback(async () => {
        if (!signer || !account) return null;
        try {
            const contract = getStakingManager(signer);
            try {
                const [publicHandle, privateHandle] = await Promise.all([
                    contract.getEncryptedPublicStaked(account),
                    contract.getEncryptedPrivateStaked(account),
                ]);
                const pub = BigInt(publicHandle.toString());
                const priv = BigInt(privateHandle.toString());
                if (pub > 0n && priv > 0n) {
                    throw new Error(
                        "Mixed public and private stake detected. Reveal public and private balances separately."
                    );
                }
                const combined = pub + priv;
                if (combined > 0n) return combined.toString();
            } catch (splitErr) {
                const msg = splitErr instanceof Error ? splitErr.message : "";
                if (msg.includes("Mixed public and private")) throw splitErr;
            }
            return null;
        } catch (err) {
            console.error("Failed to fetch encrypted staking balance:", err);
            throw err;
        }
    }, [signer, account]);

    const revealBalance = useCallback(async () => {
        if (!signer || !account) {
            setError("Wallet not connected");
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const handle = await fetchEncryptedBalance();

            if (!handle || BigInt(handle) === 0n) {
                setStakedBalanceGwei(0n);
                setStakedBalanceEth("0.00");
                setIsRevealed(true);
                return;
            }

            const provider = signer.provider;
            if (!provider) {
                throw new Error("Wallet provider not available");
            }

            await ensureZamaConnected(provider, signer);

            const contract = getStakingManager(signer);
            const contractAddress = await contract.getAddress();

            const decryptedValue = await reencryptUint64(contractAddress, account, handle);
            const gwei = BigInt(decryptedValue);
            setStakedBalanceGwei(gwei);
            setStakedBalanceEth((Number(gwei) / 1_000_000_000).toFixed(6));
            setIsRevealed(true);
        } catch (err: unknown) {
            console.error("Staking balance decryption failed:", err);
            if (isZamaUserRejection(err)) {
                setError("You cancelled the signature request.");
            } else {
                const msg = err instanceof Error ? err.message : "Failed to reveal staking balance";
                setError(msg.includes("Mixed public and private")
                    ? "You have both public and private stake — contact support or unstake one type first."
                    : msg);
            }
        } finally {
            setLoading(false);
        }
    }, [signer, account, fetchEncryptedBalance]);

    const stakeFromConfidential = async (amountEth: string) => {
        if (!signer || !account) return;
        try {
            setLoading(true);
            const contract = getStakingManager(signer);
            const contractAddress = await contract.getAddress();
            const units = Math.floor(parseFloat(amountEth) * 1_000_000);
            await ensureZamaConnected(signer.provider!, signer);
            const encrypted = await encryptUint64(contractAddress, account, units);
            const tx = await contract.stakeFromConfidential(encrypted.handle, encrypted.inputProof);
            await tx.wait();
            setIsRevealed(false);
        } catch (err: unknown) {
            console.error("Staking from confidential failed:", err);
            setError((err as Error).message || "Failed to stake");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const stakeFromWallet = async (amountEth: string) => {
        if (!signer) return;
        try {
            setLoading(true);
            const contract = getStakingManager(signer);
            const amountWei = ethers.parseEther(amountEth);
            const tx = await contract.stake({ value: amountWei });
            await tx.wait();
            setIsRevealed(false);
        } catch (err: unknown) {
            console.error("Staking from wallet failed:", err);
            setError((err as Error).message || "Failed to stake");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    /** Private unstake: return encrypted stake to cETH (no Aave exit). */
    const privateUnstake = async (amountEth: string) => {
        if (!signer || !account) return;
        try {
            setLoading(true);
            const contract = getStakingManager(signer);
            const contractAddress = await contract.getAddress();
            const units = Math.floor(parseFloat(amountEth) * 1_000_000);

            await ensureZamaConnected(signer.provider!, signer);
            const encrypted = await encryptUint64(contractAddress, account, units);

            const tx = await contract.requestPrivateUnstake(encrypted.handle, encrypted.inputProof);
            const receipt = await tx.wait();
            if (!receipt) throw new Error("Unstake request receipt missing");

            const transferableHandle = parseEventArg(
                receipt,
                contract.interface,
                contractAddress,
                "PrivateUnstakeRequested",
                "transferableHandle"
            );
            const decrypted = await publicDecrypt(transferableHandle);

            const completeTx = await contract.completePrivateUnstake(decrypted.cleartexts, decrypted.proof);
            await completeTx.wait();
            if (decrypted.value === 0n) {
                throw new Error("Insufficient staked balance for this unstake");
            }
            setIsRevealed(false);
        } catch (err: unknown) {
            console.error("Private unstaking failed:", err);
            setError((err as Error).message || "Failed to complete private unstake");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    /** Public Aave exit (amount visible on-chain). */
    const publicUnstake = async (amountEth: string) => {
        if (!signer || !account) return;
        try {
            setLoading(true);
            const contract = getStakingManager(signer);
            const contractAddress = await contract.getAddress();
            const amountWei = ethers.parseEther(amountEth);

            await ensureZamaConnected(signer.provider!, signer);

            const tx = await contract.requestPublicUnstake(amountWei);
            const receipt = await tx.wait();
            if (!receipt) throw new Error("Unstake request receipt missing");

            const transferableHandle = parseEventArg(
                receipt,
                contract.interface,
                contractAddress,
                "PublicUnstakeRequested",
                "transferableHandle"
            );
            const decrypted = await publicDecrypt(transferableHandle);

            const completeTx = await contract.completePublicUnstake(decrypted.cleartexts, decrypted.proof);
            await completeTx.wait();
            if (decrypted.value === 0n) {
                throw new Error("Insufficient staked balance for this unstake");
            }
            setIsRevealed(false);
        } catch (err: unknown) {
            console.error("Public unstaking failed:", err);
            setError((err as Error).message || "Failed to complete public unstake");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const unstake = privateUnstake;

    const hideBalance = () => {
        setIsRevealed(false);
        setStakedBalanceEth(null);
    };

    useEffect(() => {
        hideBalance();
    }, [account]);

    return {
        stakedBalanceEth,
        isRevealed,
        loading,
        error,
        revealBalance,
        hideBalance,
        unstake,
        privateUnstake,
        publicUnstake,
        stakeFromConfidential,
        stakeFromWallet,
    };
}
