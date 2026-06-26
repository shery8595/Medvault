import type { PatientProfilePlain } from "./profileCommitment";

const PROFILE_STORAGE_KEY = "medvault_profile_plain";

export function storePatientProfilePlain(profile: PatientProfilePlain): void {
    try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
        /* ignore quota */
    }
}

export function getStoredPatientProfilePlain(): PatientProfilePlain | null {
    try {
        const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PatientProfilePlain;
        if (typeof parsed.age !== "number") return null;
        return parsed;
    } catch {
        return null;
    }
}
