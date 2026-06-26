import { formatEther } from "viem";

export function weiToEth(wei?: string | bigint | null): number {
  try {
    return parseFloat(formatEther(BigInt(wei ?? "0")));
  } catch {
    return 0;
  }
}

type MilestoneRow = { index?: number; weightBps: number; distributed: boolean };
type PoolRow = {
  distributed?: boolean;
  participantCount?: number;
};

/** Screening (milestone 0) is auto-paid at trial end via vault.distribute() / Chainlink finalization. */
export function effectiveMilestoneRows(
  milestones: MilestoneRow[] | undefined,
  pool?: PoolRow | null,
): MilestoneRow[] {
  const ms = milestones ?? [];
  if (!pool?.distributed || ms.length === 0) return ms;
  return ms.map((m, i) => {
    const idx = m.index ?? i;
    if (idx === 0 && !m.distributed) return { ...m, distributed: true };
    return m;
  });
}

/**
 * Estimate ETH sent to participants from milestone weights only.
 * Pool funding amounts are sponsor-private and not indexed in the subgraph.
 */
export function estimateParticipantPayoutEth(
  fundedWei: string | undefined,
  milestones: MilestoneRow[] | undefined,
  pool?: PoolRow | null,
): number {
  const funded = weiToEth(fundedWei);
  const ms = effectiveMilestoneRows(milestones, pool);

  if (ms.length > 0) {
    const distributedBps = ms.filter((m) => m.distributed).reduce((acc, m) => acc + m.weightBps, 0);
    return funded * (distributedBps / 10000);
  }

  if (pool?.distributed && pool.participantCount) {
    return funded;
  }

  return 0;
}

export function payoutUtilizationPct(allocatedEth: number, paidEth: number): number {
  if (allocatedEth <= 0) return 0;
  return Math.min(100, Math.round((paidEth / allocatedEth) * 100));
}
