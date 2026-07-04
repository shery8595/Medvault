import { Link } from "react-router-dom";
import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";

export function P33ThresholdAttestationDoc() {
  return (
    <Prose>
      <DocsPageHeaderForRoute />

      <Callout type="warning" title="Not deployed">
        On-chain M-of-N co-sign verifier is deferred. P3.1 dual independent relayers are operational; this page is design
        evidence only.
      </Callout>

      <p>
        Goal: require <strong>M-of-N</strong> distinct <code>authorizedRelayers</code> to sign matching eligibility
        attestations before finalize — making equivocation auditable without granting fund custody.
      </p>

      <CodeBlock
        filename="EIP-712 RelayerEligibilityAttestation (future)"
        language="typescript"
        code={`RelayerEligibilityAttestation {
  registry: address
  trialId: uint256
  nullifier: uint256
  finalCt: bytes32
  eligible: bool
  permitRecipient: address
  deadline: uint256
  relayer: address
}`}
      />

      <h2>Pilot parameters</h2>
      <ul>
        <li>N = 2 authorized relayers (Railway A + B)</li>
        <li>M = 2 (2-of-2) for institutional pilot</li>
        <li>Each relayer runs independent <code>getRelayerEligible()</code> before signing</li>
      </ul>

      <p>
        See also: <Link to="/docs/relayer-trust-boundaries">relayer trust boundaries</Link>,{" "}
        <Link to="/docs/timelock-wiring">dual relayer deployment</Link>.
      </p>
    </Prose>
  );
}
