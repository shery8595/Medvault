/**
 * Server-side Pinata pinning fallback for hybrid document storage.
 */
const PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

function resolvePinataKeys() {
  const apiKey = process.env.PINATA_API_KEY?.trim() || process.env.VITE_PINATA_API_KEY?.trim();
  const apiSecret =
    process.env.PINATA_API_SECRET?.trim() || process.env.VITE_PINATA_API_SECRET?.trim();
  if (!apiKey || !apiSecret) {
    throw new Error("Pinata credentials missing — set PINATA_API_KEY and PINATA_API_SECRET.");
  }
  return { apiKey, apiSecret };
}

/**
 * Pin a Buffer/Uint8Array to Pinata; returns CID string.
 * @param {Buffer|Uint8Array} data
 * @param {string} [name]
 */
async function pinBufferToIpfs(data, name = "medvault-document") {
  const { apiKey, apiSecret } = resolvePinataKeys();
  const blob = new Blob([data]);
  const form = new FormData();
  form.append("file", blob, name);
  form.append("pinataMetadata", JSON.stringify({ name, keyvalues: { app: "medvault" } }));

  const res = await fetch(PINATA_PIN_URL, {
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

  const json = await res.json();
  if (!json.IpfsHash) {
    throw new Error("Pinata response missing IpfsHash");
  }
  return json.IpfsHash;
}

module.exports = { pinBufferToIpfs, resolvePinataKeys };
