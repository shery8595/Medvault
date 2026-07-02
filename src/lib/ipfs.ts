/**
 * Pinata IPFS client for hybrid document storage (browser + optional server fallback).
 */

import { getMedVaultRelayerUrl } from "./mobile";
import { bytesToBase64 } from "./crypto-utils";

const DEFAULT_GATEWAY = "https://gateway.pinata.cloud/ipfs";

function hasBrowserPinataKeys(): boolean {
  const apiKey = import.meta.env.VITE_PINATA_API_KEY?.trim() ?? "";
  const apiSecret = import.meta.env.VITE_PINATA_API_SECRET?.trim() ?? "";
  return Boolean(apiKey && apiSecret);
}

async function pinViaRelayer(payload: Uint8Array | object, name: string): Promise<string> {
  const relayerUrl = getMedVaultRelayerUrl();
  const pinToken = import.meta.env.VITE_RELAYER_PIN_TOKEN?.trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (pinToken) {
    headers.Authorization = `Bearer ${pinToken}`;
  }
  const body =
    payload instanceof Uint8Array
      ? { dataBase64: bytesToBase64(payload), name }
      : { json: payload, name };
  const res = await fetch(`${relayerUrl}/relay/pin-document`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Relayer pin failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { cid?: string; IpfsHash?: string };
  const cid = json.cid ?? json.IpfsHash;
  if (!cid) throw new Error("Relayer pin response missing CID");
  return cid;
}

export type PinataPinResponse = {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
};

function resolveGateway(): string {
  const gateway = import.meta.env.VITE_IPFS_GATEWAY?.trim();
  return gateway || DEFAULT_GATEWAY;
}

function resolvePinataKeys(): { apiKey: string; apiSecret: string } {
  const apiKey = import.meta.env.VITE_PINATA_API_KEY?.trim() ?? "";
  const apiSecret = import.meta.env.VITE_PINATA_API_SECRET?.trim() ?? "";
  if (!apiKey || !apiSecret) {
    throw new Error("Pinata credentials missing — set VITE_PINATA_API_KEY and VITE_PINATA_API_SECRET.");
  }
  return { apiKey, apiSecret };
}

/** Pin JSON or raw bytes to IPFS; browser Pinata when configured, else relayer fallback. */
export async function pinToIpfs(
  payload: Uint8Array | object,
  name = "medvault-document"
): Promise<string> {
  if (!hasBrowserPinataKeys()) {
    return pinViaRelayer(payload, name);
  }
  const { apiKey, apiSecret } = resolvePinataKeys();
  const body =
    payload instanceof Uint8Array
      ? payload
      : new TextEncoder().encode(JSON.stringify(payload));

  const form = new FormData();
  form.append("file", new Blob([body]), name);
  form.append(
    "pinataMetadata",
    JSON.stringify({ name, keyvalues: { app: "medvault" } })
  );

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      pinata_api_key: apiKey,
      pinata_secret_api_key: apiSecret,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata pin failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as PinataPinResponse;
  if (!json.IpfsHash) {
    throw new Error("Pinata response missing IpfsHash");
  }
  return json.IpfsHash;
}

/** Fetch raw bytes from IPFS via configured gateway. */
export async function fetchFromIpfs(cid: string): Promise<Uint8Array> {
  const trimmed = cid.replace(/^ipfs:\/\//, "");
  const url = `${resolveGateway().replace(/\/$/, "")}/${trimmed}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`IPFS fetch failed (${res.status}) for ${trimmed}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/** Fetch and parse an EncryptedPayload JSON blob from IPFS. */
export async function fetchEncryptedPayloadFromIpfs<T>(cid: string): Promise<T> {
  const bytes = await fetchFromIpfs(cid);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as T;
}
