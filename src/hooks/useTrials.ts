import { useMemo, useState, useEffect } from 'react';
import { useSubgraph } from './useSubgraph';
import { Trial } from '../types';
import { generateEphemeralAddress, getAnonymousNullifier, getStoredIdentity, listStoredAnonymousTrialIds } from '../lib/semaphore';
import { filterSponsorVisibleSubmissions } from '../lib/anonymousApplicationStatus';
import { countTrialMatches } from '../lib/sponsorChartData';

const GET_TRIALS_WITH_USER_STATE = `
  query GetTrialsWithUserState($account: Bytes!, $accountId: ID!, $anonymousNullifiers: [BigInt!]!) {
    patientConsentEpoch(id: $accountId) {
      epoch
    }
    anonymousSubmissions(where: { nullifier_in: $anonymousNullifiers }) {
      id
      nullifier
      status
      submittedAt
      statusUpdatedAt
      finalCt
      trial {
        id
      }
    }
    trials(orderBy: createdAt, orderDirection: desc) {
      id
      endTime
      sponsor {
        id
        name
      }
      name
      phase
      location
      compensation
      minAge
      maxAge
      requiresDiabetes
      minHb
      active
      createdAt
      consents(where: { patient: $account }) {
        id
        granted
        validEpoch
        expiresAt
      }
      eligibilityResults(where: { patient: $account }) {
        id
        computedAt
      }
      applications(where: { patient: $account }) {
        id
        status
        message
      }
      incentivePool {
        id
        distributed
        totalFundedWei
        shareWei
        participantCount
        participants {
          patient
        }
      }
    }
  }
`;

const GET_TRIALS_BY_SPONSOR = `
  query GetTrialsBySponsor($sponsor: Bytes!) {
    trials(where: { sponsor: $sponsor }, orderBy: createdAt, orderDirection: desc) {
      id
      endTime
      sponsor {
        id
        name
      }
      name
      phase
      location
      compensation
      minAge
      maxAge
      requiresDiabetes
      minHb
      active
      createdAt
      eligibilityResults {
        id
      }
      applications {
        id
        status
        updatedAt
      }
      anonymousSubmissions {
        id
        status
        statusUpdatedAt
        submittedAt
        stagedAt
        fhePropensityCommittedAt
      }
      propensitySignals {
        signalCount
      }
      incentivePool {
        id
        totalFundedWei
        distributed
        participantCount
        shareWei
      }
      milestones {
        index
        weightBps
        distributed
      }
      consents {
        id
      }
    }
  }
`;

function enrichSponsorTrialRow(t: any, now: number): Trial {
  const walletApps = t.applications ?? [];
  const anonApps = filterSponsorVisibleSubmissions(t.anonymousSubmissions);
  const apps = [...walletApps, ...anonApps];
  const accepted = apps.filter((a: any) => a.status === "Accepted").length;
  const pendingApplicationCount = apps.filter((a: any) => a.status === "Pending").length;
  const screened = countTrialMatches(t);
  const poolDistributed = Boolean(t.incentivePool?.distributed);
  const milestones = (t.milestones ?? []).map((m: any) => {
    const index = Number(m.index ?? 0);
    const distributed = Boolean(m.distributed) || (poolDistributed && index === 0);
    return {
      index,
      weightBps: Number(m.weightBps ?? 0),
      distributed,
    };
  });
  const distributedWeight = milestones.filter((m) => m.distributed).reduce((acc, m) => acc + m.weightBps, 0);
  const milestoneProgressPct = milestones.length > 0 ? Math.round(distributedWeight / 100) : 0;

  let updatedAtSec = Number(t.createdAt ?? 0);
  for (const a of apps) {
    const ts = Number(
      a.updatedAt ?? a.statusUpdatedAt ?? a.submittedAt ?? a.stagedAt ?? 0,
    );
    if (ts > updatedAtSec) updatedAtSec = ts;
  }

  const poolFundedWei = t.incentivePool?.totalFundedWei ?? "0";
  const createdAtSec = Number(t.createdAt ?? 0);
  const applicants = apps.length;
  const enrollmentPct = applicants > 0 ? Math.round((accepted / applicants) * 100) : 0;

  return {
    ...t,
    hasConsent: (t.consents ?? []).length > 0,
    hasComputed: screened > 0 || applicants > 0,
    matchCount: screened,
    screenedCount: screened,
    applicantCount: applicants,
    acceptedCount: accepted,
    pendingApplicationCount,
    updatedAtSec,
    poolFundedWei,
    milestoneProgressPct,
    milestones,
    enrollmentPct,
    isNew: createdAtSec > 0 && now - createdAtSec < 14 * 24 * 3600,
    isExpired: t.endTime ? parseInt(String(t.endTime), 10) <= now : false,
    isFinalized: Boolean(t.incentivePool?.distributed),
    rewardPoolFunded: BigInt(poolFundedWei || "0") > 0n,
    rewardParticipantRegistered: false,
  };
}

export function useTrials(account?: string, sponsorAddress?: string) {
  const query = sponsorAddress ? GET_TRIALS_BY_SPONSOR : GET_TRIALS_WITH_USER_STATE;
  const al = account?.toLowerCase() || "0x0000000000000000000000000000000000000000";
  /** Local anonymous apply state only applies after wallet connect (avoids ghost UI when logged out). */
  const storedAnonymousTrialIds = useMemo(
    () => (account ? listStoredAnonymousTrialIds() : []),
    [account]
  );
  const storedAnonymousNullifiers = useMemo(
    () =>
      storedAnonymousTrialIds
        .map((trialId) => getAnonymousNullifier(trialId)?.toString())
        .filter((value): value is string => !!value),
    [storedAnonymousTrialIds]
  );
  const variables = useMemo(
    () =>
      sponsorAddress
        ? { sponsor: sponsorAddress.toLowerCase() }
        : {
            account: al,
            accountId: al,
            anonymousNullifiers: storedAnonymousNullifiers.length > 0 ? storedAnonymousNullifiers : ["0"],
          },
    [al, sponsorAddress, storedAnonymousNullifiers]
  );

  const { data, loading: subgraphLoading, error: subgraphError, refetch } = useSubgraph(query, variables);
  const [enrichedTrials, setEnrichedTrials] = useState<Trial[]>([]);
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    let mounted = true;

    const enrichTrials = async () => {
      if (!data?.trials) return;

      setEnriching(true);
      const now = Math.floor(Date.now() / 1000);
      const patientEpoch =
        (data as any).patientConsentEpoch?.epoch != null
          ? String((data as any).patientConsentEpoch.epoch)
          : "1";

      try {
        const anonymousTrialIds = new Set(storedAnonymousTrialIds);
        const anonymousSubmissionByTrialId = new Map<string, any>();
        for (const submission of ((data as any).anonymousSubmissions || [])) {
          anonymousSubmissionByTrialId.set(String(submission.trial.id), submission);
        }
        const identity = getStoredIdentity();
        const ephemeralAddress = identity ? (await generateEphemeralAddress(identity)).toLowerCase() : null;
        const accountAddress = account?.toLowerCase() ?? null;

        if (sponsorAddress) {
          const sponsorRows = data.trials.map((t: any) => enrichSponsorTrialRow(t, now));
          if (mounted) {
            setEnrichedTrials(sponsorRows);
            setEnriching(false);
          }
          return;
        }

        const processed: Trial[] = await Promise.all(
          data.trials.filter((t: any) => {
            // Sponsor dashboards must always list sponsor-owned trials so
            // recruitment detail pages remain accessible.
            if (sponsorAddress) return true;

            const consent = t.consents && t.consents.length > 0 ? t.consents[0] : null;
            const hasEffectiveConsent =
              !!consent &&
              consent.granted === true &&
              String(consent.validEpoch ?? "0") === patientEpoch &&
              (String(consent.expiresAt ?? "0") === "0" || parseInt(String(consent.expiresAt), 10) > now);

            const hasInteraction =
              hasEffectiveConsent ||
              (t.eligibilityResults && t.eligibilityResults.length > 0) ||
              (t.applications && t.applications.length > 0) ||
              anonymousTrialIds.has(String(t.id));

            if (hasInteraction) return true;
            const isExpired = t.endTime && parseInt(t.endTime) <= now;
            return t.active && !isExpired;
          }).map(async (t: any) => {
            const app = t.applications && t.applications.length > 0 ? t.applications[0] : null;
            const isExpired = t.endTime && parseInt(t.endTime) <= now;

            // Anonymous flows are keyed by nullifier, so read the indexed
            // AnonymousSubmission instead of doing per-trial RPC calls.
            let anonymousStatus: string | null = null;
            let anonymousNullifier: string | null = null;
            const localNullifier = getAnonymousNullifier(t.id);
            const anonymousSubmission = anonymousSubmissionByTrialId.get(String(t.id));
            if (localNullifier) {
              anonymousNullifier = localNullifier.toString();
              const indexedStatus = anonymousSubmission?.status;
              if (indexedStatus === "Accepted" || indexedStatus === "Rejected" || indexedStatus === "Pending") {
                anonymousStatus = indexedStatus;
              } else if (indexedStatus === "Staged" || indexedStatus === "None") {
                anonymousStatus = "Pending";
              } else {
                anonymousStatus = "Pending";
              }
            }

            const effectiveStatus = app ? app.status : anonymousStatus;
            const participants = (t.incentivePool?.participants || []) as { patient: string }[];
            const rewardParticipantRegistered = participants.some((p) => {
              const patient = String(p.patient).toLowerCase();
              return patient === accountAddress || patient === ephemeralAddress;
            });

            // Anonymous applies don't create wallet-keyed subgraph eligibility rows — use chain status.
            // Wallet-keyed applications always merit score reveal when present.
            const hasComputed =
              (t.eligibilityResults && t.eligibilityResults.length > 0) ||
              anonymousStatus !== null ||
              !!app;

            return {
              ...t,
              hasConsent: t.consents && t.consents.length > 0,
              hasComputed,
              applicationStatus: effectiveStatus,
              applicationMessage: app ? app.message : null,
              nullifier: anonymousNullifier,
              eligibilityScore: null,
              matchCount: t.eligibilityResults ? t.eligibilityResults.length : 0,
              isExpired,
              isFinalized: Boolean(t.incentivePool?.distributed),
              rewardPoolFunded: BigInt(t.incentivePool?.totalFundedWei || "0") > 0n,
              rewardParticipantRegistered
            };
          })
        );

        if (mounted) {
          setEnrichedTrials(processed);
          setEnriching(false);
        }
      } catch (err) {
        console.error("Error enriching trials:", err);
        if (mounted) setEnriching(false);
      }
    };

    if (data?.trials) {
      enrichTrials();
    } else if (!subgraphLoading && mounted) {
      setEnrichedTrials([]);
    }

    return () => { mounted = false; };
  }, [account, data, subgraphLoading, sponsorAddress, storedAnonymousTrialIds]);

  return {
    trials: enrichedTrials,
    loading: subgraphLoading && enrichedTrials.length === 0,
    refreshing: enriching || (subgraphLoading && enrichedTrials.length > 0),
    error: subgraphError,
    refetch
  };
}
