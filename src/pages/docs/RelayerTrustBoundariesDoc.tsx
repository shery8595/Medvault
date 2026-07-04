import { Link } from "react-router-dom";
import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";

export function RelayerTrustBoundariesDoc() {
  return (
    <Prose>
      <DocsPageHeaderForRoute />

      <p>
        Proof-style summary of what MedVault authorized relayers <strong>cannot</strong> do, what they{" "}
        <strong>can</strong> do, and how P3.1 multi-relayer design limits residual risk.
      </p>

      <Callout type="info" title="Not formal verification">
        This document is judge-facing architectural evidence. See test IDs in{" "}
        <Link to="/docs/testing/matrix">testing matrix</Link> (REL-EQV, REL-REP, REL-FF, REL-STALE).
      </Callout>

      <h2>Cannot steal vault funds</h2>
      <ul>
        <li>No cETH mint — relayer has no vault owner role</li>
        <li>Pull-claim: patient <code>confirmReceipt</code> + KMS proof required before credit</li>
        <li>P2: <code>FHE.select</code> gates payout on encrypted eligibility</li>
        <li>Public exit EIP-712 binding prevents replay (<code>PEX-04</code>)</li>
      </ul>

      <h2>Cannot forge eligibility</h2>
      <ul>
        <li>FHE engine is sole on-chain compute authority</li>
        <li>P0.2: relayer re-decrypt when <code>permitRecipient == relayerWallet</code> ignores client <code>eligible</code></li>
        <li>Ineligible path → <code>SilentApply</code>, not payout (<code>SF-01</code>, <code>RDV-01</code>)</li>
      </ul>

      <h2>Cannot replay consumed stages</h2>
      <ul>
        <li>Nullifier consumption — second finalize reverts (<code>REL-REP-01</code>)</li>
        <li>Stale stage permit after cancel (<code>REL-REP-02</code>, <code>INT-EE-10</code>)</li>
      </ul>

      <h2>Can only censor or delay</h2>
      <p>
        Relayers may refuse relay, go offline, or withhold gas. Mitigation: patient chooses among{" "}
        <code>VITE_RELAYER_URLS</code> (P3.1). Future P3.3 M-of-N co-sign spec:{" "}
        <Link to="/docs/p3-3-threshold-attestation">threshold attestation</Link>.
      </p>

      <p>
        Full markdown: <code>docs/RELAYER_TRUST_BOUNDARIES.md</code> in the repository.
      </p>
    </Prose>
  );
}
