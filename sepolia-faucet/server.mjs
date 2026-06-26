/**
 * Ethereum Sepolia test ETH drip — tiny HTTP service (POST /drip).
 *
 * Deploy: set FAUCET_PRIVATE_KEY to a funded testnet EOA. Never commit the key.
 *
 * Env:
 *   FAUCET_PRIVATE_KEY — required
 *   SEPOLIA_RPC_URL      — optional (default: public Ethereum Sepolia RPC)
 *   PORT                 — optional, default 8787
 *   DRIP_ETH             — optional, default 0.0004
 *   COOLDOWN_MS          — optional, default 86400000 (24h window per address & per IP)
 *   MAX_DRIPS_PER_WINDOW — optional, default 3
 *   FAUCET_CORS_ORIGIN   — optional, default * (set to your app origin in production)
 */
import "dotenv/config";
import http from "node:http";
import { ethers } from "ethers";

const EXPECTED_CHAIN_ID = 11155111n;

const RPC =
  process.env.SEPOLIA_RPC_URL ||
  process.env.RPC_URL ||
  "https://ethereum-sepolia-rpc.publicnode.com";
const PK = process.env.FAUCET_PRIVATE_KEY;
const PORT = Number(process.env.PORT || 8787);
const DRIP = ethers.parseEther(process.env.DRIP_ETH || "0.0004");
const COOLDOWN_MS = Number(process.env.COOLDOWN_MS || 86_400_000);
const MAX_DRIPS = Math.max(1, Number(process.env.MAX_DRIPS_PER_WINDOW || 3));

/** Browser origins must match exactly — no trailing slash (https://med-vault.xyz not …xyz/). */
function normalizeCorsOrigin(raw) {
  const v = (raw || "*").trim();
  if (v === "*") return "*";
  return v.replace(/\/+$/, "");
}

const CORS = normalizeCorsOrigin(process.env.FAUCET_CORS_ORIGIN);

/** @type {Map<string, { windowStart: number, count: number }>} */
const dripsByAddress = new Map();
/** @type {Map<string, { windowStart: number, count: number }>} */
const dripsByIp = new Map();

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": CORS,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() });
  res.end(JSON.stringify(body));
}

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

/**
 * @returns {null | { retryAfterMs: number, remaining: number }}
 */
function checkDripLimit(map, key, now) {
  let entry = map.get(key);
  if (!entry || now - entry.windowStart >= COOLDOWN_MS) {
    entry = { windowStart: now, count: 0 };
    map.set(key, entry);
  }
  if (entry.count >= MAX_DRIPS) {
    return {
      retryAfterMs: COOLDOWN_MS - (now - entry.windowStart),
      remaining: 0,
    };
  }
  return null;
}

function recordDrip(map, key, now) {
  let entry = map.get(key);
  if (!entry || now - entry.windowStart >= COOLDOWN_MS) {
    entry = { windowStart: now, count: 0 };
  }
  entry.count += 1;
  map.set(key, entry);
}

async function main() {
  if (!PK) {
    console.error("Missing FAUCET_PRIVATE_KEY");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  let network;
  try {
    network = await provider.getNetwork();
  } catch (e) {
    console.error("[sepolia-faucet] Could not reach RPC:", e.message || e);
    process.exit(1);
  }

  if (network.chainId !== EXPECTED_CHAIN_ID) {
    console.error(
      [
        "[sepolia-faucet] Wrong chain: RPC reports chainId",
        String(network.chainId),
        "— expected",
        String(EXPECTED_CHAIN_ID),
        "(Ethereum Sepolia).",
        "",
        "Set SEPOLIA_RPC_URL to an Ethereum Sepolia endpoint, for example:",
        "  • https://ethereum-sepolia-rpc.publicnode.com",
        "  • https://eth-sepolia.g.alchemy.com/v2/<YOUR_KEY>",
      ].join("\n")
    );
    process.exit(1);
  }

  const wallet = new ethers.Wallet(PK, provider);

  const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }

    if (req.method === "GET" && (req.url === "/health" || req.url === "/")) {
      json(res, 200, {
        ok: true,
        service: "sepolia-faucet",
        chain: "sepolia",
        chainId: Number(EXPECTED_CHAIN_ID),
        maxDripsPerWindow: MAX_DRIPS,
        cooldownMs: COOLDOWN_MS,
      });
      return;
    }

    if (req.url !== "/drip" || req.method !== "POST") {
      json(res, 404, { error: "Not found" });
      return;
    }

    let raw = "";
    try {
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      const address = typeof body.address === "string" ? body.address.trim() : "";

      if (!address || !ethers.isAddress(address)) {
        json(res, 400, { error: "Invalid address" });
        return;
      }
      const checksum = ethers.getAddress(address);
      const now = Date.now();
      const ip = clientIp(req);

      const waitAddr = checkDripLimit(dripsByAddress, checksum.toLowerCase(), now);
      if (waitAddr !== null) {
        json(res, 429, {
          error: `This address has used all ${MAX_DRIPS} drips for this period. Try again later.`,
          retryAfterMs: waitAddr.retryAfterMs,
          dripsRemaining: waitAddr.remaining,
        });
        return;
      }
      const waitIp = checkDripLimit(dripsByIp, ip, now);
      if (waitIp !== null) {
        json(res, 429, {
          error: `Too many requests from this network (${MAX_DRIPS} per period). Try again later.`,
          retryAfterMs: waitIp.retryAfterMs,
          dripsRemaining: waitIp.remaining,
        });
        return;
      }

      const bal = await provider.getBalance(wallet.address);
      const minReserve = DRIP + ethers.parseEther("0.0001");
      if (bal < minReserve) {
        json(res, 503, { error: "Faucet wallet is empty. Operator must top up on Ethereum Sepolia." });
        return;
      }

      const tx = await wallet.sendTransaction({ to: checksum, value: DRIP });
      recordDrip(dripsByAddress, checksum.toLowerCase(), now);
      recordDrip(dripsByIp, ip, now);

      const addrEntry = dripsByAddress.get(checksum.toLowerCase());
      const dripsUsed = addrEntry?.count ?? 1;
      const dripsRemaining = Math.max(0, MAX_DRIPS - dripsUsed);

      const txHash = tx.hash;
      json(res, 200, {
        success: true,
        txHash,
        chainId: Number(EXPECTED_CHAIN_ID),
        explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
        dripsUsed,
        dripsRemaining,
        maxDripsPerWindow: MAX_DRIPS,
      });
    } catch (e) {
      console.error(e);
      json(res, 500, { error: e && e.message ? e.message : "Drip failed" });
    }
  });

  server.listen(PORT, () => {
    console.log(
      `[sepolia-faucet] listening on :${PORT} | chainId ${EXPECTED_CHAIN_ID} (Ethereum Sepolia) | RPC ${RPC}`
    );
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
