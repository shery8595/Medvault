import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../lib/Web3Context";
import { useTimelockWiring } from "../hooks/useTimelockWiring";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Loader2, Shield, RefreshCw } from "lucide-react";
import { ethers } from "ethers";
import {
  formatTimelockValue,
  isBoolAuthKind,
} from "../lib/timelockWiring";

export function AdminWiringPage() {
  const { account } = useWeb3();
  const { rows, loading, error, actionStatus, refresh, schedule, apply, cancel, formatEtaCountdown } =
    useTimelockWiring();
  const [draftAddrs, setDraftAddrs] = useState<Record<string, string>>({});
  const [draftAuthorize, setDraftAuthorize] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh(draftAddrs);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftAddrs, refresh]);

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  if (!account) {
    return (
      <div className="max-w-5xl mx-auto p-8 space-y-4">
        <h1 className="text-2xl font-bold">Protocol wiring (timelock)</h1>
        <p className="text-slate-600">Connect an owner wallet to schedule and apply trusted-address changes.</p>
        <Link to="/" className="text-sm text-violet-600 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 pb-20 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-violet-600" />
            Timelock wiring
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            2-day schedule → apply for trusted contract addresses. Owner-only writes.
          </p>
        </div>
        <Button variant="outline" onClick={() => void refresh(draftAddrs)} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {actionStatus && <p className="text-sm text-violet-700 font-medium">{actionStatus}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wiring targets ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-slate-500 uppercase tracking-wider">
                <th className="py-2 pr-3">Target</th>
                <th className="py-2 pr-3">Current</th>
                <th className="py-2 pr-3">Pending</th>
                <th className="py-2 pr-3">ETA</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isBoolRow = row.target.valueType === "bool";
                const pendingActive = isBoolRow
                  ? row.eta > 0n
                  : Boolean(row.pending && row.pending !== ethers.ZeroAddress);
                const canApply =
                  pendingActive &&
                  row.isOwner &&
                  Number(row.eta) > 0 &&
                  Math.floor(Date.now() / 1000) >= Number(row.eta);
                const draft = draftAddrs[row.target.id] ?? "";
                const authorize = draftAuthorize[row.target.id] ?? row.target.authorizeDefault ?? true;
                return (
                  <tr key={row.target.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-3 pr-3 font-medium text-slate-800 dark:text-slate-200">
                      {row.target.label}
                      {!row.isOwner && (
                        <span className="block text-[10px] text-slate-400 font-normal">read-only</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 font-mono text-[10px]">
                      {formatTimelockValue(row.current, row.target.valueType)}
                    </td>
                    <td className="py-3 pr-3 font-mono text-[10px]">
                      {pendingActive
                        ? formatTimelockValue(row.pending, row.target.valueType)
                        : "—"}
                    </td>
                    <td className="py-3 pr-3">{pendingActive ? formatEtaCountdown(row.eta) : "—"}</td>
                    <td className="py-3">
                      {row.isOwner ? (
                        <div className="flex flex-col gap-2 min-w-[200px]">
                          <Input
                            placeholder="0x target address"
                            value={draft}
                            onChange={(e) =>
                              setDraftAddrs((p) => ({ ...p, [row.target.id]: e.target.value }))
                            }
                            className="h-8 text-xs font-mono"
                          />
                          {isBoolAuthKind(row.target.kind) ? (
                            <label className="flex items-center gap-2 text-[10px] text-slate-600">
                              <input
                                type="checkbox"
                                checked={authorize}
                                onChange={(e) =>
                                  setDraftAuthorize((p) => ({
                                    ...p,
                                    [row.target.id]: e.target.checked,
                                  }))
                                }
                                className="rounded border-slate-300"
                              />
                              Authorize (uncheck to deauthorize)
                            </label>
                          ) : null}
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="sm"
                              className="h-7 text-[10px]"
                              disabled={!draft || busyId === row.target.id}
                              onClick={() =>
                                void run(row.target.id, () =>
                                  schedule(row.target, draft, authorize).then(() =>
                                    refresh(draftAddrs)
                                  )
                                )
                              }
                            >
                              Schedule
                            </Button>
                            {canApply && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px]"
                                disabled={busyId === row.target.id || (isBoolRow && !draft)}
                                onClick={() =>
                                  void run(row.target.id, () =>
                                    apply(row.target, isBoolRow ? draft : undefined).then(() =>
                                      refresh(draftAddrs)
                                    )
                                  )
                                }
                              >
                                Apply
                              </Button>
                            )}
                            {pendingActive && row.target.cancelFn && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[10px]"
                                disabled={
                                  busyId === row.target.id ||
                                  (row.target.kind === "loggerAuth" && !draft)
                                }
                                onClick={() =>
                                  void run(row.target.id, () =>
                                    cancel(
                                      row.target,
                                      row.target.kind === "loggerAuth" ? draft : undefined
                                    ).then(() => refresh(draftAddrs))
                                  )
                                }
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminWiringPage;
