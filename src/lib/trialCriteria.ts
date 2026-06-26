import { ethers } from "ethers";
import type { TrialCriteriaPlain } from "./noir";
import { getTrialManager } from "./contracts";
import { normalizeTrialCriteria } from "./trialCriteriaNormalize";

export type { TrialCriteriaFields } from "./trialCriteriaNormalize";
export { normalizeTrialCriteria } from "./trialCriteriaNormalize";

export async function fetchTrialCriteria(
    provider: ethers.Provider,
    trialId: bigint,
    chainId?: bigint | number
): Promise<TrialCriteriaPlain> {
    const trialManager = getTrialManager(provider, chainId);
    const trial = await trialManager.getTrial(trialId);
    return normalizeTrialCriteria(trial);
}
