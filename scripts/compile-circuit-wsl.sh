#!/usr/bin/env bash
set -eu

export PATH="$HOME/.nargo/bin:$HOME/.bb:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

NOIR_VERSION="1.0.0-beta.21"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v nargo >/dev/null 2>&1; then
  curl -sL https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
  export PATH="$HOME/.nargo/bin:$PATH"
fi
noirup -v "$NOIR_VERSION"

mkdir -p "$ROOT/src/lib/circuits"

for CIRCUIT in eligibility_plaintext eligibility_encrypted; do
  CIRCUIT_DIR="$ROOT/circuits/$CIRCUIT"
  cd "$CIRCUIT_DIR"
  echo "── nargo compile ($CIRCUIT) ──"
  nargo compile
  echo "── nargo test ($CIRCUIT) ──"
  nargo test
  cp "target/${CIRCUIT}.json" "$ROOT/src/lib/circuits/${CIRCUIT}.json"
  echo "✓ Copied ${CIRCUIT}.json to src/lib/circuits/"
done

# Back-compat alias for frontend paths still referencing eligibility_proof.json
cp "$ROOT/src/lib/circuits/eligibility_plaintext.json" "$ROOT/src/lib/circuits/eligibility_proof.json"
echo "✓ eligibility_proof.json -> eligibility_plaintext.json alias"
echo "  Run: npm run generate:honk-verifier  (bb.js Keccak Solidity verifiers)"
