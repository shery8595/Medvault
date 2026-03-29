import { useState, useCallback, useEffect } from "react";
import { useWeb3 } from "../lib/Web3Context";
import { getConfidentialETH } from "../lib/contracts";
import { reencryptUint64 } from "../lib/fhe";
import { ethers } from "ethers";

export function useConfidentialBalance() {
    const { signer, account } = useWeb3();
    const [balanceMwei, setBalanceMwei] = useState<number | null>(null);
    const [balanceEth, setBalanceEth] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRevealed, setIsRevealed] = useState(false);

    const fetchEncryptedBalance = useCallback(async () => {
        if (!signer || !account) return null;
        try {
            const contract = getConfidentialETH(signer);
            // Returns an euint32 handle
            const handle = await contract.getBalance(account);
            return handle.toString();
        } catch (err: any) {
            console.error("Failed to fetch encrypted balance:", err);
            return null;
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

            // Uninitialized handles in fhEVM return 0. Attempting to decrypt a 0 handle throws an authorization error.
            if (!handle || BigInt(handle) === 0n) {
                setBalanceMwei(0);
                setBalanceEth("0.00");
                setIsRevealed(true);
                return;
            }

            const contract = getConfidentialETH(signer);
            const contractAddress = await contract.getAddress();

            // Re-encrypt to user's public key (requires signature)
            const decryptedValue = await reencryptUint64(contractAddress, account, handle);

            // The value is in units (1 unit = 1e12 wei = 1 micro-ETH)
            const units = Number(decryptedValue);
            setBalanceMwei(units);

            // Convert units to ETH (units * 1e12 / 1e18) = units / 1e6
            const ethValue = (units / 1_000_000).toFixed(6);
            setBalanceEth(ethValue);
            setIsRevealed(true);

        } catch (err: any) {
            console.error("Decryption failed:", err);
            setError(err.message || "Failed to reveal balance");
        } finally {
            setLoading(false);
        }
    }, [signer, account, fetchEncryptedBalance]);

    const hideBalance = () => {
        setIsRevealed(false);
        setBalanceMwei(null);
        setBalanceEth(null);
    };

    const deposit = async (amountEth: string) => {
        if (!signer) return;
        try {
            setLoading(true);
            const contract = getConfidentialETH(signer);
            const tx = await contract.deposit({ value: ethers.parseEther(amountEth) });
            await tx.wait();
            // Automatically hide after state change to force a fresh re-encryption next time
            hideBalance();
        } catch (err: any) {
            console.error("Deposit failed:", err);
            setError(err.message || "Failed to deposit funds");
            throw err; // Re-throw to let component handle UX
        } finally {
            setLoading(false);
        }
    };

    const withdraw = async (amountEth: string) => {
        if (!signer) return;
        try {
            setLoading(true);
            const contract = getConfidentialETH(signer);
            // Convert ETH to units (1 unit = 1e-6 ETH = 0.000001 ETH)
            const unitsString = (parseFloat(amountEth) * 1_000_000).toFixed(0);
            const units = parseInt(unitsString, 10);

            if (units <= 0) throw new Error("Amount too low. Minimum is 0.000001 ETH");

            const tx = await contract.withdraw(units);
            await tx.wait();
            hideBalance();
        } catch (err: any) {
            console.error("Withdrawal failed:", err);
            setError(err.message || "Failed to withdraw funds");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    // Auto-hide on account change
    useEffect(() => {
        hideBalance();
    }, [account]);

    return {
        balanceEth,
        isRevealed,
        loading,
        error,
        revealBalance,
        hideBalance,
        deposit,
        withdraw
    };
}
