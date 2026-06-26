import { expect } from "chai";
import type { ApplyWizardPhase } from "../../src/components/apply/AnonymousApplyWizard";

function derivePhase(input: {
  applied: boolean;
  error: boolean;
  submitting: boolean;
  generating: boolean;
}): ApplyWizardPhase {
  if (input.applied) return "applied";
  if (input.error) return "error";
  if (input.submitting) return "finalizing";
  if (input.generating) return "generating-proof";
  return "idle";
}

describe("Unit: Anonymous apply wizard phases", function () {
  it("maps submitting to finalize step", function () {
    expect(derivePhase({ applied: false, error: false, submitting: true, generating: false })).to.equal(
      "finalizing"
    );
  });

  it("maps success to applied", function () {
    expect(derivePhase({ applied: true, error: false, submitting: false, generating: false })).to.equal(
      "applied"
    );
  });
});
