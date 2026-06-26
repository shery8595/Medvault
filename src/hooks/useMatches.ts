import { useSubgraph } from "./useSubgraph";
import { Match } from "../types";
import { useMemo } from "react";
import { normalizeAddress, isConsentRowEffective } from "../lib/consentEffective";
import { isSponsorVisibleAnonymousStatus } from "../lib/anonymousApplicationStatus";

const GET_SPONSOR_DATA = `
  query GetSponsorData($sponsor: Bytes!) {
    trials(where: { sponsor: $sponsor }) {
      id
      name
      eligibilityResults {
        id
        patient
        computedAt
        txHash
      }
      consents {
        id
        patient
        granted
        validEpoch
        expiresAt
        lastUpdatedAt
        txHash
      }
      applications {
        id
        patient
        status
        updatedAt
        message
        txHash
      }
      progress {
        patient
        lastCompletedMilestoneIndex
      }
      anonymousSubmissions {
        id
        trialId
        nullifier
        submittedAt
        status
        statusUpdatedAt
        fhePropensityCommittedAt
        noirCertified
        noirEligible
        noirCertifiedAt
        attestationResultHash
        attestationFheStageHash
        attestationCriteriaSchemaHash
      }
    }
  }
`;

const GET_EPOCHS = `
  query GetEpochs($ids: [ID!]!) {
    patientConsentEpochs(where: { id_in: $ids }) {
      id
      epoch
    }
  }
`;

export function useMatches(sponsorAddress?: string) {
  const sponsor = sponsorAddress?.toLowerCase() || "0x0000000000000000000000000000000000000000";

  const { data, loading: loadingTrials, error: errTrials, refetch: refetchTrials } = useSubgraph(
    GET_SPONSOR_DATA,
    { sponsor }
  );

  const patientIds = useMemo(() => {
    if (!data?.trials) return [] as string[];
    const s = new Set<string>();
    for (const t of data.trials as any[]) {
      for (const c of t.consents || []) {
        if (c.patient) s.add(normalizeAddress(String(c.patient)));
      }
    }
    return Array.from(s);
  }, [data]);

  const epochIds = patientIds.length > 0 ? patientIds : ["0x0000000000000000000000000000000000000000"];

  const { data: epochData, loading: loadingEpochs, error: errEpochs, refetch: refetchEpochs } =
    useSubgraph(GET_EPOCHS, { ids: epochIds });

  const loading = loadingTrials || loadingEpochs;
  const error = errTrials || errEpochs;

  const refetch = async () => {
    await refetchTrials();
    await refetchEpochs();
  };

  const matches: Match[] = useMemo(() => {
    if (!data?.trials) return [];

    const epochMap = new Map<string, string>();
    for (const e of (epochData as any)?.patientConsentEpochs || []) {
      epochMap.set(normalizeAddress(e.id), String(e.epoch));
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const allMatches: Match[] = [];

    data.trials.forEach((trial: any) => {
      const patientStateMap = new Map<string, any>();

      (trial.consents || []).forEach((c: any) => {
        const p = normalizeAddress(String(c.patient));
        const pe = epochMap.get(p) ?? "1";
        if (!isConsentRowEffective(c, pe, nowSec)) return;

        patientStateMap.set(c.patient, {
          id: c.id,
          status: "Interested",
          timestamp: Number(c.lastUpdatedAt),
          score: 0,
        });
      });

      trial.eligibilityResults.forEach((er: any) => {
        patientStateMap.set(er.patient, {
          id: er.id,
          status: "Computed",
          timestamp: Number(er.computedAt),
          score: 100,
        });
      });

      trial.applications.forEach((app: any) => {
        patientStateMap.set(app.patient, {
          id: app.id,
          status: app.status,
          timestamp: Number(app.updatedAt),
          score: 100,
          message: app.message,
          currentMilestone: 0,
        });
      });

      trial.progress.forEach((p: any) => {
        const existing = patientStateMap.get(p.patient);
        if (existing) {
          existing.currentMilestone = p.lastCompletedMilestoneIndex + 1;
        }
      });

      patientStateMap.forEach((state, patientAddr) => {
        allMatches.push({
          id: state.id,
          trialId: trial.id,
          trialName: trial.name,
          patientAddress: patientAddr as string,
          patientId: `${(patientAddr as string).slice(0, 6)}...${(patientAddr as string).slice(-4)}`,
          status: state.status,
          timestamp: new Date(state.timestamp * 1000).toLocaleString(),
          rawTimestamp: state.timestamp,
          matchScore: state.score,
          applicationStatus: ["Pending", "Accepted", "Rejected"].includes(state.status)
            ? state.status
            : "None",
          applicationMessage: state.message,
          currentMilestone: state.currentMilestone || 0,
          isAnonymous: false,
        });
      });

      trial.anonymousSubmissions?.forEach((anon: any) => {
        const status = anon.status || "Pending";
        if (!isSponsorVisibleAnonymousStatus(status)) {
          return;
        }
        const fheAt = anon.fhePropensityCommittedAt
          ? String(anon.fhePropensityCommittedAt)
          : null;
        allMatches.push({
          id: anon.id,
          trialId: trial.id,
          trialName: trial.name,
          patientAddress: "0x0000000000000000000000000000000000000000",
          patientId: `Anonymous-${String(anon.nullifier).slice(0, 8)}...`,
          status: status,
          timestamp: new Date(Number(anon.submittedAt) * 1000).toLocaleString(),
          rawTimestamp: Number(anon.submittedAt),
          matchScore: undefined,
          applicationStatus: ["Pending", "Accepted", "Rejected"].includes(status) ? status : "None",
          applicationMessage: undefined,
          currentMilestone: 0,
          isAnonymous: true,
          nullifier: String(anon.nullifier),
          fhePropensityCommittedAt: fheAt,
          noirCertified: anon.noirCertified === true,
          noirEligible:
            anon.noirEligible === true || anon.noirEligible === false ? anon.noirEligible : null,
          attestationResultHash: anon.attestationResultHash ?? null,
          attestationFheStageHash: anon.attestationFheStageHash ?? null,
          attestationCriteriaSchemaHash: anon.attestationCriteriaSchemaHash ?? null,
        });
      });
    });

    return allMatches.sort((a, b) => (b as any).rawTimestamp - (a as any).rawTimestamp);
  }, [data, epochData]);

  return {
    matches,
    loading,
    error,
    refetch,
  };
}
