/** @type {import('solidity-coverage').SolcoverUserConfig} */
module.exports = {
    // Generated Noir verifier uses deep stack; instrumentation breaks Yul compile.
    skipFiles: [
        "HonkVerifier.sol",
        // finalizeAnonymousEligibilityWithProof stack is at the Yul limit; instrumentation overflows.
        "EligibilityEngine.sol",
    ],
};
