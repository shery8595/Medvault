import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../lib/Web3Context";
import { getContract } from "../lib/contracts";

type WiringContractName =
  | "EligibilityEngine"
  | "TrialManager"
  | "SponsorIncentiveVault"
  | "MedVaultAutomation"
  | "TrialMilestoneManager"
  | "ConsentManager"
  | "ConfidentialETH"
  | "DataAccessLog";
import {
  TIMELOCK_TARGETS,
  formatEtaCountdown,
  isBoolAuthKind,
  type TimelockTarget,
} from "../lib/timelockWiring";

export type TimelockRowState = {
  target: TimelockTarget;
  current: string;
  pending: string;
  eta: bigint;
  delaySec: bigint;
  isOwner: boolean;
};

function resolveReadAddress(target: TimelockTarget, draftAddresses?: Record<string, string>): string {
  const draft = draftAddresses?.[target.id]?.trim();
  if (draft) {
    try {
      return ethers.getAddress(draft);
    } catch {
      return ethers.ZeroAddress;
    }
  }
  return ethers.ZeroAddress;
}

export function useTimelockWiring() {
  const { signer, readOnlyProvider, account } = useWeb3();
  const [rows, setRows] = useState<TimelockRowState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const provider = signer?.provider ?? readOnlyProvider;

  const refresh = useCallback(
    async (draftAddresses?: Record<string, string>) => {
      if (!provider) {
        setRows([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const next: TimelockRowState[] = [];
        for (const target of TIMELOCK_TARGETS) {
          const contract = getContract(target.contract as WiringContractName, provider);
          let isOwner = false;
          try {
            const owner = (await contract.owner()) as string;
            isOwner = Boolean(account && owner.toLowerCase() === account.toLowerCase());
          } catch {
            isOwner = false;
          }

          const readAddr =
            target.readArg === "targetAddr" ? resolveReadAddress(target, draftAddresses) : undefined;

          let current = target.valueType === "bool" ? "false" : ethers.ZeroAddress;
          try {
            if (target.kind === "engineReader") {
              const raw = await contract[target.currentFn]();
              current = typeof raw === "string" ? raw : String(raw);
            } else if (readAddr !== undefined) {
              const raw = await contract[target.currentFn](readAddr);
              current = String(Boolean(raw));
            } else {
              const raw = await contract[target.currentFn]();
              current = typeof raw === "string" ? raw : String(raw);
            }
          } catch {
            current = target.valueType === "bool" ? "false" : ethers.ZeroAddress;
          }

          let pending = target.valueType === "bool" ? "false" : ethers.ZeroAddress;
          let eta = 0n;
          try {
            if (target.kind === "engineReader" && target.roleKey) {
              pending = (await contract[target.pendingFn](target.roleKey)) as string;
              eta = BigInt(await contract[target.etaFn](target.roleKey));
            } else if (readAddr !== undefined) {
              const rawPending = await contract[target.pendingFn](readAddr);
              pending = String(Boolean(rawPending));
              eta = BigInt(await contract[target.etaFn](readAddr));
            } else {
              pending = (await contract[target.pendingFn]()) as string;
              eta = BigInt(await contract[target.etaFn]());
            }
          } catch {
            pending = target.valueType === "bool" ? "false" : ethers.ZeroAddress;
            eta = 0n;
          }

          let delaySec = 21600n;
          try {
            delaySec = BigInt(await contract.READER_CHANGE_DELAY());
          } catch {
            try {
              delaySec = BigInt(await contract.LOGGER_CHANGE_DELAY());
            } catch {
              /* optional */
            }
          }

          next.push({ target, current, pending, eta, delaySec, isOwner });
        }
        setRows(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load timelock wiring");
      } finally {
        setLoading(false);
      }
    },
    [provider, account]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const schedule = useCallback(
    async (target: TimelockTarget, newAddress: string, authorize?: boolean) => {
      if (!signer) throw new Error("Wallet not connected");
      setActionStatus(`Scheduling ${target.label}…`);
      const contract = getContract(target.contract as WiringContractName, signer);
      const addr = ethers.getAddress(newAddress);
      const auth = authorize ?? target.authorizeDefault ?? true;
      let tx;
      if (target.kind === "engineReader" && target.roleKey) {
        tx = await contract[target.scheduleFn](target.roleKey, addr);
      } else if (isBoolAuthKind(target.kind)) {
        tx = await contract[target.scheduleFn](addr, auth);
      } else if (target.scheduleArgs) {
        tx = await contract[target.scheduleFn](...target.scheduleArgs(addr, auth));
      } else {
        tx = await contract[target.scheduleFn](addr);
      }
      await tx.wait();
      setActionStatus(`Scheduled ${target.label}`);
      await refresh();
    },
    [signer, refresh]
  );

  const apply = useCallback(
    async (target: TimelockTarget, targetAddress?: string) => {
      if (!signer) throw new Error("Wallet not connected");
      setActionStatus(`Applying ${target.label}…`);
      const contract = getContract(target.contract as WiringContractName, signer);
      let tx;
      if (target.kind === "engineReader" && target.roleKey) {
        tx = await contract[target.applyFn](target.roleKey);
      } else if (isBoolAuthKind(target.kind)) {
        if (!targetAddress) throw new Error("Target address required to apply");
        tx = await contract[target.applyFn](ethers.getAddress(targetAddress));
      } else {
        tx = await contract[target.applyFn]();
      }
      await tx.wait();
      setActionStatus(`Applied ${target.label}`);
      await refresh();
    },
    [signer, refresh]
  );

  const cancel = useCallback(
    async (target: TimelockTarget, targetAddress?: string) => {
      if (!signer || !target.cancelFn) throw new Error("Cancel not supported");
      setActionStatus(`Cancelling ${target.label}…`);
      const contract = getContract(target.contract as WiringContractName, signer);
      let tx;
      if (target.kind === "engineReader" && target.roleKey) {
        tx = await contract[target.cancelFn](target.roleKey);
      } else if (target.kind === "loggerAuth") {
        if (!targetAddress) throw new Error("Logger address required to cancel");
        tx = await contract[target.cancelFn](ethers.getAddress(targetAddress));
      } else {
        throw new Error("Cancel not implemented for this target");
      }
      await tx.wait();
      setActionStatus(`Cancelled ${target.label}`);
      await refresh();
    },
    [signer, refresh]
  );

  return {
    rows,
    loading,
    error,
    actionStatus,
    refresh,
    schedule,
    apply,
    cancel,
    formatEtaCountdown,
  };
}
