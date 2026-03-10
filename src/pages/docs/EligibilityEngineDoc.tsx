import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";

import { motion } from "framer-motion";

const fheSequenceChart = `
sequenceDiagram
    participant P as Patient
    participant EE as EligibilityEngine
    participant PR as PatientRegistry
    participant TM as TrialManager

    P->>EE: computeEligibility(patient, trialId)
    EE->>PR: getPatientEncryptedMetrics(patient)
    PR-->>EE: euint32[] (Age, HbA1c, etc.)
    EE->>TM: getTrialEncryptedRequirements(trialId)
    TM-->>EE: euint32[] (MinAge, MaxHbA1c, etc.)
    
    rect rgb(20, 20, 30)
        Note over EE: Zama FHE Processing
        EE->>EE: TFHE.ge(age, minAge) -> ebool
        EE->>EE: TFHE.le(hba1c, maxHba1c) -> ebool
        EE->>EE: TFHE.cmux(isMatch, score, 0) -> euint32
    end

    EE->>EE: storeScore(trialId, patient, finalScore)
    Note over EE: Final Score is still Encrypted!
`;

export function EligibilityEngineDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <span className="text-purple-500 font-bold tracking-widest uppercase text-xs">Smart Contracts</span>
                <h1 className="mt-2 text-5xl">Eligibility Engine Mechanics</h1>

                <p className="lead text-2xl text-slate-500 dark:text-slate-400 mt-6 mb-12 max-w-prose">
                    The `EligibilityEngine` is the algorithmic core of MedVault. It runs the Zama fhEVM precompiles to evaluate highly sensitive patient health metrics against sponsor-defined trial criteria.
                </p>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>The Computation Flow</h2>
                <p>
                    Because FHE operations on `euint32` variables require significant computational power, executing multiple transactions to check individual health parameters is not feasible. The computation is therefore <strong>batched</strong> into a single function call: <code>computeEligibility(address patient, uint256 trialId)</code>.
                </p>

                <p>
                    The engine evaluates three core metrics simultaneously: Age, Blood Pressure, and HbA1c.
                </p>

                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 mb-8">
                    <h3 className="text-xl font-semibold text-slate-200 mb-4">FHE Verification Sequence</h3>
                    <div className="text-slate-300 space-y-2">
                        <p>1. <strong>Patient</strong> generates FHE ciphertexts locally representing their medical history.</p>
                        <p>2. <strong>Patient</strong> calls Smart Contract <code>applyForTrial(ciphertexts)</code>.</p>
                        <p>3. <strong>Smart Contract</strong> loads Sponsor's predefined FHE conditions (minAge, bgType, etc).</p>
                        <p>4. <strong>Smart Contract</strong> performs homomorphic comparisons strictly on-chain.</p>
                        <p>5. <strong>Smart Contract</strong> decrypts the final boolean result (1 = Match, 0 = Reject).</p>
                        <p>6. <strong>Blockchain</strong> emits Match event while keeping all patient inputs completely secret.</p>
                    </div>
                </div>

                <CodeBlock
                    filename="EligibilityEngine.sol (Snippet: Engine Core)"
                    language="solidity"
                    code={`import "@zama-ai/fhevm/contracts/lib/TFHE.sol";

function _computeScore(address patient, uint256 trialId) internal returns (euint32) {
    // 0. Initialize a new encrypted score of 0
    euint32 score = TFHE.asEuint32(0);
    ebool isMatch;

    // 1. Age Range Check
    // We 'AND' two booleans together: is age >= minAge AND age <= maxAge?
    isMatch = TFHE.and(
        TFHE.ge(patientInfo.age, reqs.minAge),
        TFHE.le(patientInfo.age, reqs.maxAge)
    );
    // If isMatch is true (after decryption), add 40 to the score.
    score = TFHE.add(score, TFHE.cmux(isMatch, TFHE.asEuint32(40), TFHE.asEuint32(0)));

    // 2. Blood Pressure Check
    isMatch = TFHE.and(
        TFHE.ge(patientInfo.bloodPressure, reqs.minBloodPressure),
        TFHE.le(patientInfo.bloodPressure, reqs.maxBloodPressure)
    );
    // Add 30 points if the BP is within range
    score = TFHE.add(score, TFHE.cmux(isMatch, TFHE.asEuint32(30), TFHE.asEuint32(0)));

    // 3. HbA1c Check (Max threshold only)
    isMatch = TFHE.le(patientInfo.hba1c, reqs.maxHba1c);
    // Add final 30 points
    score = TFHE.add(score, TFHE.cmux(isMatch, TFHE.asEuint32(30), TFHE.asEuint32(0)));

    return score;
}`}
                />

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>Understanding the Score State</h2>

                <p>
                    Notice how the resulting score accumulates up to a perfectly matching `100`. But what happens to this score?
                </p>

                <p>
                    In a traditional Solidity contract, determining the outcome of this function would involve emitting an event: <code>emit ScoreCalculated(score)</code>. However, doing so would expose the ciphertext on the public ledger. While technically secure because only the user has the decryption key, tracking ciphertexts in event logs is an anti-pattern for FHE data density.
                </p>

                <Callout type="danger" title="The Event Anti-Pattern">
                    <strong>Never emit encrypted types in standard events.</strong> Doing so forces indexers to parse massive byte arrays. Store cyphertexts securely in contract state mappings instead.
                </Callout>

                <p>Instead, MedVault maps the score securely in the contract state:</p>

                <CodeBlock
                    language="solidity"
                    code={`// Mapping: trialId => patientAddress => encryptedScore
mapping(uint256 => mapping(address => euint32)) private trialApplicantScores;

function storeScore(uint256 trialId, address patient, euint32 score) internal {
    trialApplicantScores[trialId][patient] = score;
}`}
                />

                <h3>Decoupling Storage from Computation</h3>
                <p>
                    Why not update the `Applied Trials` array right here in the Engine? Because updating complex array structures while simultaneously performing heavy TFHE opcodes would routinely exceed the Zama Sepolia block gas limits.
                </p>
                <p>
                    Therefore, the `EligibilityEngine` calculates the score and stores it. The frontend `PatientRegistry` and Subgraph then index the simple `ApplicationStatusUpdated` event (which contains the trial ID but <em>not</em> the score) to update the user's dashboard asynchronously.
                </p>

            </Prose>
        </motion.div>
    );
}
