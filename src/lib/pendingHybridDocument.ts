import type { DocumentBindingInputs } from "./noir";

const STORAGE_KEY = "medvault:pending-hybrid-documents";

function hybridDocStorage(): Storage | null {
  if (typeof sessionStorage !== "undefined") return sessionStorage;
  if (typeof localStorage !== "undefined") return localStorage;
  return null;
}

export type StoredPendingHybridDocument = {
  trialId: string;
  cid: string;
  aesKeyCtHash: string;
  filename: string;
  /** base64 AES key — cleared after successful on-chain record */
  aesKeyB64: string;
  documentBinding?: DocumentBindingInputs;
  recordedTxHash?: string;
  createdAt: number;
};

function readAll(): Record<string, StoredPendingHybridDocument> {
  const storage = hybridDocStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StoredPendingHybridDocument>;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, StoredPendingHybridDocument>): void {
  const storage = hybridDocStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function storePendingHybridDocument(doc: StoredPendingHybridDocument): void {
  const map = readAll();
  map[doc.trialId] = doc;
  writeAll(map);
}

export function getPendingHybridDocument(
  trialId: number | bigint | string
): StoredPendingHybridDocument | null {
  const key = String(trialId);
  return readAll()[key] ?? null;
}

export function updatePendingHybridDocument(
  trialId: number | bigint | string,
  patch: Partial<StoredPendingHybridDocument>
): void {
  const key = String(trialId);
  const map = readAll();
  const existing = map[key];
  if (!existing) return;
  map[key] = { ...existing, ...patch };
  writeAll(map);
}

export function clearPendingHybridDocument(trialId: number | bigint | string): void {
  const key = String(trialId);
  const map = readAll();
  delete map[key];
  writeAll(map);
}
