import { Link } from "react-router-dom";
import { Prose } from "../../../components/docs/Prose";
import { Callout } from "../../../components/docs/Callout";
import { CodeBlock } from "../../../components/docs/CodeBlock";
import { DocsPageHeaderForRoute } from "../../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";

export function TestingInfrastructureDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <p>
                    Shared test code lives under <code>test-support/</code> — <strong>19 helper modules</strong>{" "}
                    (imported as <code>../../test-support/...</code> from test files; not executed as tests).
                    Hardhat loads TypeScript via <code>ts-node</code> with CommonJS in <code>hardhat.config.ts</code>.
                </p>

                <h2>test-support/ modules</h2>
                <ul className="columns-2 gap-x-6 text-sm">
                    <li><code>deployments.ts</code> — full stack deploy</li>
                    <li><code>timelock.ts</code> — schedule/apply helpers</li>
                    <li><code>fhe.ts</code> — Zama encrypt/decrypt mocks</li>
                    <li><code>journey.ts</code> — apply/stage/claim flows</li>
                    <li><code>withdraw.ts</code> — withdraw-to EIP-712</li>
                    <li><code>vaultEip712.ts</code> — claim authorization</li>
                    <li><code>consent.ts</code> — grantConsent disambiguation</li>
                    <li><code>signers.ts</code> — impersonateAccount</li>
                    <li><code>semaphore.ts</code> — MockSemaphore proofs</li>
                    <li><code>assertions.ts</code> — expectRevert</li>
                    <li><code>constants.ts</code> — trial params, chain IDs</li>
                    <li><code>fixtures/profiles.ts</code> — ELIGIBLE_PROFILE presets</li>
                    <li><code>documentCrypto.ts</code> — hybrid doc AES helpers</li>
                    <li><code>documentBinding.ts</code> — IPFS binding hashes</li>
                    <li><code>anonymousApply.ts</code> — Semaphore apply helpers</li>
                    <li><code>noirProof.ts</code> — attestation proof fixtures</li>
                    <li><code>profileCommitment.ts</code> — salted commitment + <code>randomProfileSalt</code></li>
                    <li><code>staking.ts</code> — stake/unstake helpers</li>
                    <li><code>transfer.ts</code> — confidential transfer helpers</li>
                </ul>
                <p>
                    <code>contracts/test/</code> holds <strong>5 Solidity helpers/mocks</strong> (e.g.{" "}
                    <code>MockSemaphore.sol</code>) — not Foundry test contracts.
                </p>

                <h2>deployMedVaultStack()</h2>
                <p>
                    Defined in <code>test-support/deployments.ts</code>. Deploys the full MedVault graph and
                    configures cross-contract permissions in one call:
                </p>
                <ul>
                    <li>Authorizes loggers on DataAccessLog via schedule/apply (timelock)</li>
                    <li>Wires EligibilityEngine readers, TrialManager automation, vault milestone manager, cETH contract auth</li>
                    <li>Sets <code>consentManager.setEligibilityEngine</code> for FHE consent composition</li>
                    <li>Pre-approves <code>stack.sponsor</code> on SponsorRegistry for trial creation on chain 31337</li>
                    <li>Uses <code>test-support/timelock.ts</code> — <code>scheduleAndApply</code> fast-forwards 2 days on Hardhat</li>
                </ul>
                <p>Signers exposed on the stack:</p>
                <CodeBlock
                    language="typescript"
                    code={`owner, patient, sponsor, sponsor2, stranger, relayer`}
                />
                <p>Helpers:</p>
                <ul>
                    <li>
                        <code>createTrialForSponsor(stack, sponsor?, overrides?)</code> — creates a trial, returns
                        trialId
                    </li>
                    <li>
                        <code>registerPatientOnRegistry(stack, patientSigner, commitment, permitRecipient, profile)</code>{" "}
                        — encrypts health fields, uses <code>randomProfileSalt()</code> + <code>profileSaltCommitment()</code> from{" "}
                        <code>test-support/profileCommitment.ts</code>
                    </li>
                    <li>
                        Anonymous apply finalize/cancel via <code>stack.relayer</code> (<code>onlyAuthorizedRelayer</code>)
                    </li>
                </ul>

                <h2>Zama FHE encryption (test-support/fhe.ts)</h2>
                <p>
                    Replaces the removed <code>fhevm</code> export from Hardhat. Uses{" "}
                    <code>hre.fhevm.createClientWithBatteries(signer)</code> and{" "}
                    <code>client.encryptInputs([Encryptable.uint8(...)])</code>
                    <code>.setAccount(proofAccount)</code>
                    <code>.execute()</code>.
                </p>

                <Callout type="warning" title="proofAccount must match msg.sender at verify">
                    Zama FHE verifies encrypted inputs against the account that will appear as{" "}
                    <code>msg.sender</code> when <code>FHE.asEuint*</code> runs. Examples:
                    <ul className="mt-2 mb-0">
                        <li>
                            Patient registration via <code>MedVaultRegistry</code> → inner call from registry → use{" "}
                            <strong>MedVaultRegistry address</strong> as <code>proofAccount</code>
                        </li>
                        <li>
                            <code>SponsorRegistry.requestSponsorship</code> → sponsor calls directly → use{" "}
                            <strong>sponsor address</strong>
                        </li>
                        <li>
                            <code>confirmReceipt</code> (pull-claim) → permit holder calls vault; KMS{" "}
                            <code>mockPublicDecryptProof</code> on staged entitlement ebool — see{" "}
                            <code>test-support/claimReceipt.ts</code>
                        </li>
                        <li>
                            <code>claimParticipantRewards</code> → <code>requestWithdrawTo</code> → use{" "}
                            <strong>SponsorIncentiveVault address</strong> as <code>proofAccount</code> (contract =
                            ConfidentialETH)
                        </li>
                        <li>
                            <code>requestWithdraw</code> → patient EOA; <code>stakeFromConfidential</code> → patient EOA
                            with StakingManager as contract
                        </li>
                    </ul>
                </Callout>

                <p>Exported helpers:</p>
                <CodeBlock
                    language="typescript"
                    code={`createEncryptedUint8(proofAccount, signerAddress, value)
createEncryptedUint16(...)
createEncryptedUint64(...)
createEncryptedBool(...)
buildPatientProfileInputs(proofAccount, signerAddress, profile)

mockGetPlaintext(ctHash)      // hre.fhevm.mocks.getPlaintext
mockDecryptBool(ctHash)       // for ebool handles
coerceFheHandle(value)        // normalize ethers / ebool return types
assertFhevmMock()             // require hre.fhevm.isMock in unit tests
mockPublicDecrypt(handle)     // v0.9 completion proofs`}
                />

                <h2>Timelock helpers (test-support/timelock.ts)</h2>
                <CodeBlock
                    language="typescript"
                    code={`advanceTimelock()                    // +2 days on Hardhat
scheduleAndApply(scheduleFn, applyFn)  // schedule → advance → apply
authorizeCethContract(cETH, owner, addr, true)  // scheduleContractAuth / applyContractAuth`}
                />

                <h2>Withdraw helpers (test-support/withdraw.ts)</h2>
                <p>
                    Encrypted staging and completion for v0.9 withdraw flows. See also{" "}
                    <Link to="/docs/private-withdrawals" className="font-semibold text-[#00685f] hover:underline">
                        Private withdrawals
                    </Link>{" "}
                    doc.
                </p>
                <CodeBlock
                    language="typescript"
                    code={`buildWithdrawToAuthorization(cEth, user, destination, enc)
confirmStagedReceipt(vault, trialId, milestoneIndex, participant)  // P0-1 pull claim
claimParticipantRewardsTx(vault, patient, trialId, enc, withdrawToArgs)
requestEncryptedWithdraw(cEth, patient, units)
completeEncryptedWithdraw(cEth, vaultSigner, user, stageReceipt)  // vault must call completeWithdrawTo
createEncryptedClaimUnits(cEthAddress, vaultAddress, units)
signPublicExitAuthorization(owner, { contractAddress, chainId, ... })`}
                />

                <h2>Consent overloads (test-support/consent.ts)</h2>
                <p>
                    Ethers v6 cannot disambiguate <code>grantConsent(uint256,uint256)</code> vs{" "}
                    <code>grantConsent(uint256,InEbool)</code>. Tests use explicit selectors:
                </p>
                <CodeBlock
                    language="typescript"
                    code={`grantConsentLegacy(consentManager, trialId)
grantConsentEncrypted(consentManager, trialId, enc)`}
                />

                <h2>Contract impersonation (test-support/signers.ts)</h2>
                <p>
                    When a test must send a transaction as a deployed contract (e.g.{" "}
                    <code>MedVaultRegistry</code> calling <code>stageAnonymousEligibility</code>):
                </p>
                <CodeBlock
                    language="typescript"
                    code={`import { impersonateAccount } from "../../test-support/signers";

const registrySigner = await impersonateAccount(
  await stack.medVaultRegistry.getAddress()
);
await stack.eligibilityEngine
  .connect(registrySigner)
  .stageAnonymousEligibility(...);`}
                />

                <h2>Semaphore (test-support/semaphore.ts)</h2>
                <ul>
                    <li>
                        <code>buildMockSemaphoreProof(trialId, nullifier, commitment, permitRecipient)</code> — works
                        with <code>contracts/test/MockSemaphore.sol</code>
                    </li>
                    <li>
                        <code>deriveNullifier(identity, trialId)</code> — matches frontend / Noir keccak-scoped
                        Poseidon scheme
                    </li>
                </ul>

                <h2>Profile fixtures (test-support/fixtures/profiles.ts)</h2>
                <p>Plaintext health presets for encryption:</p>
                <ul>
                    <li><code>ELIGIBLE_PROFILE</code> — passes default trial criteria</li>
                    <li><code>PROFILE_FAIL_AGE</code>, <code>PROFILE_FAIL_DIABETES</code>, <code>PROFILE_FAIL_HB</code>, etc.</li>
                </ul>

                <h2>Assertions (test-support/assertions.ts)</h2>
                <CodeBlock
                    language="typescript"
                    code={`await expectRevert(promise, "substring or /regex/");`}
                />
                <p>
                    Use regex when Hardhat cannot decode custom errors (common with FHE precompile reverts).
                </p>

                <h2>ConsentManager contract note</h2>
                <p>
                    Tests required a small production fix: <code>ConsentManager</code> now calls{" "}
                    <code>setEligibilityEngine</code> and grants <code>FHE.allow</code> to the engine on consent
                    grants, and <code>getActiveConsent</code> allows the caller on the composed result. Without this,{" "}
                    <code>applyToTrialWithConsent</code> fails with <code>SenderNotAllowed</code> in mocks.
                </p>
            </Prose>
        </motion.div>
    );
}
