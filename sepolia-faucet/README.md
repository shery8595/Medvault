# Ethereum Sepolia testnet faucet

Small **Node.js** service that sends a little **Ethereum Sepolia** native ETH to a given address. Intended for demos and QA — **testnet only**.

### RPC must be Ethereum Sepolia (chain ID `11155111`)

Fund the faucet wallet with **Ethereum Sepolia** ETH (e.g. [Chainlink Sepolia faucet](https://faucets.chain.link/sepolia)).

## Quick start

```bash
cd sepolia-faucet
npm install
cp .env.example .env
# Edit .env — set FAUCET_PRIVATE_KEY (wallet funded on Ethereum Sepolia)
npm start
```

`POST /drip` with JSON body `{ "address": "0x..." }`.

## Environment

| Variable | Required | Default / notes |
|----------|----------|-----------------|
| `FAUCET_PRIVATE_KEY` | Yes | Funded Sepolia EOA |
| `SEPOLIA_RPC_URL` | No | Ethereum Sepolia JSON-RPC (chain **11155111**) |
| `PORT` | No | `8787` |
| `DRIP_ETH` | No | `0.0004` |
| `FAUCET_CORS_ORIGIN` | No | `*` or your dapp origin (no trailing slash) |

Wire the deployed base URL into the dapp as `VITE_TESTNET_FAUCET_URL`.

## Deploy (Railway / Render)

1. Deploy this directory as a Node service.
2. Set `FAUCET_PRIVATE_KEY` in platform secrets (wallet funded on **Ethereum Sepolia**).
3. Set `SEPOLIA_RPC_URL` to an Ethereum Sepolia endpoint.
4. Set `FAUCET_CORS_ORIGIN` to your production app origin (e.g. `https://med-vault.xyz`).
