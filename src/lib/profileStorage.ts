import type { PatientProfilePlain } from "./profileCommitment";

const PROFILE_STORAGE_KEY = "medvault_profile_plain";
const PROFILE_SALT_STORAGE_KEY = "medvault_profile_salt";

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

export function storeProfileSalt(profileSalt: bigint): void {
    try {
        localStorage.setItem(PROFILE_SALT_STORAGE_KEY, profileSalt.toString());
    } catch {
        /* ignore quota */
    }
}

export function getStoredProfileSalt(): bigint | null {
    try {
        const raw = localStorage.getItem(PROFILE_SALT_STORAGE_KEY);
        if (!raw) return null;
        const salt = BigInt(raw);
        return salt > 0n ? salt : null;
    } catch {
        return null;
    }
}
