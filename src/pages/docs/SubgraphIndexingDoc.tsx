import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";

import { motion } from "framer-motion";
import { Database, Zap, GitMerge, RefreshCcw } from "lucide-react";

const indexingFlowChart = `
graph LR
    A[Fhenix Sepolia Node] -->|Emits Event| B[Graph Node Listener]
    B -->|Triggers Handler| C[AssemblyScript Mapping]
    C -->|Creates / Updates Entity| D[(PostgreSQL Store)]
    D -->|Serves| E[GraphQL API]
    E -->|Frontend Query| F[React DApp]

    style A fill:#0f172a,color:#fff,stroke:#334155
    style D fill:#0f172a,color:#fff,stroke:#334155
    style F fill:#0f172a,color:#fff,stroke:#334155
`;

const events = [
  { contract: "TrialManager", event: "TrialCreated", fields: "trialId, sponsor, name, phase", entity: "Trial" },
  { contract: "TrialManager", event: "TrialHalted", fields: "trialId", entity: "Trial (update active=false)" },
  { contract: "TrialManager", event: "TrialActivated", fields: "trialId", entity: "Trial (update active=true)" },
  { contract: "EligibilityEng", event: "ApplicationStatusUpdated", fields: "patientAddress, trialId, status", entity: "EligibilityResult" },
  { contract: "SponsorRegistry", event: "SponsorAdded", fields: "sponsor, name", entity: "Sponsor" },
  { contract: "SponsorRegistry", event: "SponsorRemoved", fields: "sponsor", entity: "Sponsor (delete)" },
];

export function SubgraphIndexingDoc() {
  return (
    <motion.div>
      <Prose className="max-w-none">
        <span className="text-blue-500 font-bold tracking-widest uppercase text-xs">Integration</span>
        <h1 className="mt-2 text-5xl">The Graph: Subgraph Indexing Architecture</h1>

        <p className="lead text-2xl text-slate-500 dark:text-slate-400 mt-6 mb-6 max-w-prose">
          Blockchain nodes are optimized for consensus integrity, not data querying. Reading complex relational data via raw RPC (<code>eth_getLogs</code>, <code>eth_call</code>) is slow and cannot perform joins or filters. MedVault delegates all indexing to <strong>The Graph Protocol</strong>, transforming emitted events into a highly efficient, queryable GraphQL schema.
        </p>

        {/* Stat Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-10 not-prose">
          {[
            { label: "Indexed Contracts", value: "3", icon: <Database className="w-4 h-4" />, color: "blue" },
            { label: "Entity Types", value: "4", icon: <GitMerge className="w-4 h-4" />, color: "teal" },
            { label: "Event Handlers", value: "6+", icon: <Zap className="w-4 h-4" />, color: "purple" },
            { label: "Query Latency", value: "<100ms", icon: <RefreshCcw className="w-4 h-4" />, color: "emerald" },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-center">
              <div className={`p-2 rounded-xl mb-2 bg-${s.color}-100 dark:bg-${s.color}-900/30 text-${s.color}-600 dark:text-${s.color}-400`}>{s.icon}</div>
              <div className="text-2xl font-bold font-display text-slate-900 dark:text-white">{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-slate-800/50 p-6 mt-6 rounded-xl border border-slate-700/50 mb-8">
            <h3 className="text-xl font-semibold text-slate-200 mb-4">Indexing Pipeline: Chain → Graph → Frontend</h3>
            <div className="text-slate-300 space-y-4">
                <p>1. <strong>FHEVM Network</strong> emits events (ApplicationStatusUpdated, MatchesUpdated, etc.)</p>
                <p>2. <strong>Graph Node</strong> detects blocks and trigger mapping scripts</p>
                <p>3. <strong>AssemblyScript Mappings</strong> parse event data and update Postgres store</p>
                <p>4. <strong>GraphQL API</strong> exposes the indexed data</p>
                <p>5. <strong>React Frontend (Apollo Client)</strong> queries the API to render UI without RPC calls</p>
            </div>
        </div>

        <hr className="my-12 border-slate-200 dark:border-slate-800" />

        <h2>I. Why Indexing is Critical for FHE DApps</h2>
        <p>
          In a standard DApp, on-chain events often emit the complete state (e.g., <code>emit Transfer(from, to, amount)</code>). In an FHE environment, this is only partially possible. Sensitive values—like the encrypted minimum age for a trial—cannot safely appear in event logs because they would expose the ciphertext blob to public observers in raw transaction logs.
        </p>
        <p>
          Therefore, MedVault events emit public structural metadata but <strong>never emit ciphertexts</strong>. The Subgraph captures this metadata and makes it queryable. For example, a <code>TrialCreated</code> event emits <code>trialId</code>, <code>sponsorAddress</code>, and <code>name</code>—but not <code>encryptedMinAge</code>. The encrypted requirements remain exclusively in the smart contract state.
        </p>

        <Callout type="info" title="Events as Structural Pointers in FHE">
          Think of blockchain events in MedVault not as payloads carrying data, but as <em>pointer notifications</em>. A <code>TrialCreated</code> event tells The Graph: "A trial with ID 42 was created by address 0xABC." The Graph stores this relation. When the user later applies, the FHE engine independently reads the encrypted requirements from the contract state — never from the event log.
        </Callout>

        <hr className="my-12 border-slate-200 dark:border-slate-800" />

        <h2>II. Indexed Event Reference</h2>
        <p>These are the events in MedVault smart contracts that The Graph listens to and the entities they create or update:</p>

        <div className="not-prose my-8 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Contract</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Event</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Indexed Fields</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Entity Effect</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={e.event} className={`border-b border-slate-100 dark:border-slate-800/50 ${i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-900/30"}`}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.contract}</td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">{e.event}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{e.fields}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{e.entity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <hr className="my-12 border-slate-200 dark:border-slate-800" />

        <h2>III. GraphQL Schema Design</h2>
        <p>
          The schema defines the shape of the PostgreSQL database maintained by The Graph Studio nodes. Every entity that we want to query from the frontend must be declared here with explicit types.
        </p>
        <p>
          The <code>@entity(immutable: false)</code> directive is critical — it allows our mapping handlers to <em>update</em> an existing entity (e.g., toggling a trial from active to halted). Without this, entities would be write-once only.
        </p>

        <CodeBlock
          filename="subgraph/schema.graphql"
          language="graphql"
          code={`# The schema is the "database blueprint" for The Graph's PostgreSQL store.
# Each type here becomes a queryable GraphQL entity.

type Trial @entity(immutable: false) {
  id: Bytes!                   # tx hash + logIndex (prevents ID collisions)
  trialId: BigInt!             # uint256 contract reference
  sponsor: Bytes!              # address — 20-byte hex
  name: String!                # Human-readable title
  phase: String!               # "Phase I" | "Phase II" | "Phase III"
  active: Boolean!             # Updated by TrialHalted / TrialActivated events
  applicantCount: BigInt!      # Incremented in mapping for efficiency
  blockNumber: BigInt!         # For time-series sorting on the frontend
  blockTimestamp: BigInt!      
  transactionHash: Bytes!
}

# Represents the patient <> trial matching result
type EligibilityResult @entity(immutable: false) {
  id: ID!                      # Composite: "<patientAddress>-<trialId>"
  patientAddress: Bytes!       # address
  trialId: BigInt!             # uint256
  sponsorAddress: Bytes!       # address
  # 0 = Pending | 1 = Accepted | 2 = Rejected
  # This is updated when sponsor calls updateApplicationStatus()
  status: Int!
}

type Sponsor @entity(immutable: false) {
  id: Bytes!                   # The sponsor wallet address
  name: String!                # Organization display name
  active: Boolean!             # false when SponsorRemoved event fires
}`}
        />

        <hr className="my-12 border-slate-200 dark:border-slate-800" />

        <h2>IV. AssemblyScript Handler Deep Dive</h2>
        <p>
          When a contract emits an indexed event, The Graph Node calls the corresponding AssemblyScript handler in our <code>src/mappings/</code> directory. These handlers create or update the entities defined in the schema.
        </p>

        <CodeBlock
          filename="subgraph/src/mappings/trial-manager.ts"
          language="typescript"
          code={`import { BigInt } from "@graphprotocol/graph-ts";
import {
  TrialCreated as TrialCreatedEvent,
  TrialHalted  as TrialHaltedEvent
} from "../../generated/TrialManager/TrialManager";
import { Trial } from "../../generated/schema";

export function handleTrialCreated(event: TrialCreatedEvent): void {
  // Use tx hash + logIndex to create a guaranteed-unique entity ID
  const entityId = event.transaction.hash.concatI32(event.logIndex.toI32());
  const trial = new Trial(entityId);

  trial.trialId        = event.params.trialId;
  trial.sponsor        = event.params.sponsor;
  trial.name           = event.params.name;
  trial.phase          = event.params.phase;
  trial.active         = true;
  trial.applicantCount = BigInt.fromI32(0);
  trial.blockNumber    = event.block.number;
  trial.blockTimestamp = event.block.timestamp;
  trial.transactionHash = event.transaction.hash;

  trial.save();
}

export function handleTrialHalted(event: TrialHaltedEvent): void {
  // Query the existing trial entity and mark it as inactive
  // This requires @entity(immutable: false) in schema.graphql
  const trial = Trial.load(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );
  if (trial) {
    trial.active = false;
    trial.save();
  }
}`}
        />

        <hr className="my-12 border-slate-200 dark:border-slate-800" />

        <h2>V. Frontend GraphQL Query Pattern</h2>
        <p>
          The MedVault frontend queries the Subgraph via HTTP POST requests to the endpoint stored in <code>VITE_SUBGRAPH_URL</code>. This allows the application to list, filter, and sort trials instantly without iterating large arrays in the client.
        </p>

        <CodeBlock
          filename="src/lib/subgraph.ts — Example Query"
          language="typescript"
          code={`const GET_ACTIVE_TRIALS = \`
  query GetActiveTrials($skip: Int, $first: Int) {
    trials(
      where: { active: true }
      orderBy: blockTimestamp
      orderDirection: desc
      skip: $skip
      first: $first
    ) {
      id
      trialId
      sponsor
      name
      phase
      applicantCount
      blockTimestamp
    }
  }
\`;

export const fetchActiveTrials = async (page: number = 0) => {
  const response = await fetch(import.meta.env.VITE_SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: GET_ACTIVE_TRIALS,
      variables: { skip: page * 10, first: 10 },
    }),
  });
  const { data } = await response.json();
  return data.trials;
};`}
        />

      </Prose>
    </motion.div>
  );
}
