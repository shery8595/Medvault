import { expect } from "chai";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const plaintextVerifier = path.join(root, "contracts/HonkVerifier.sol");
const encryptedVerifier = path.join(root, "contracts/HonkVerifierEncrypted.sol");
const engineSol = path.join(root, "contracts/EligibilityEngine.sol");
const vkFingerprintPath = path.join(root, "src/lib/circuits/vk_fingerprint.json");

const ELIGIBILITY_PUBLIC_INPUT_COUNT = 25;
const ELIGIBILITY_ENCRYPTED_PUBLIC_INPUT_COUNT = 15;
const PAIRING_POINTS_SIZE = 8;

function extractConst(src: string, name: string): string | null {
    const m = src.match(new RegExp(`${name}\\s*=\\s*(?:hex"([0-9a-f]+)"|(\\d+))`, "i"));
    if (!m) return null;
    return m[1] ?? m[2] ?? null;
}

function extractVkHash(src: string): string | null {
    const m = src.match(/VK_HASH\s*=\s*0x([0-9a-f]+)/i);
    return m ? m[1].toLowerCase() : null;
}

function expectVerifierLayout(src: string, userInputs: number) {
    const numberOfPublicInputs = Number(extractConst(src, "NUMBER_OF_PUBLIC_INPUTS"));
    expect(numberOfPublicInputs - PAIRING_POINTS_SIZE).to.equal(userInputs);
    expect(extractVkHash(src)).to.not.equal(null);
}

describe("Unit: HonkVerifier VK alignment (P7)", function () {
    it("P7-VK-01: plaintext and encrypted verifiers match engine public input counts", function () {
        expect(fs.existsSync(plaintextVerifier)).to.equal(true);
        expect(fs.existsSync(encryptedVerifier)).to.equal(true);

        const plaintextSrc = fs.readFileSync(plaintextVerifier, "utf8");
        const encryptedSrc = fs.readFileSync(encryptedVerifier, "utf8");
        expectVerifierLayout(plaintextSrc, ELIGIBILITY_PUBLIC_INPUT_COUNT);
        expectVerifierLayout(encryptedSrc, ELIGIBILITY_ENCRYPTED_PUBLIC_INPUT_COUNT);

        const engineSrc = fs.readFileSync(engineSol, "utf8");
        expect(Number(extractConst(engineSrc, "ELIGIBILITY_PUBLIC_INPUT_COUNT"))).to.equal(
            ELIGIBILITY_PUBLIC_INPUT_COUNT
        );
        expect(Number(extractConst(engineSrc, "ELIGIBILITY_ENCRYPTED_PUBLIC_INPUT_COUNT"))).to.equal(
            ELIGIBILITY_ENCRYPTED_PUBLIC_INPUT_COUNT
        );

        const generatedPlain = path.join(
            root,
            "circuits/eligibility_plaintext/target/HonkVerifier.sol"
        );
        if (fs.existsSync(generatedPlain)) {
            const generatedSrc = fs.readFileSync(generatedPlain, "utf8");
            expect(extractVkHash(generatedSrc)).to.equal(extractVkHash(plaintextSrc));
        }

        if (fs.existsSync(vkFingerprintPath)) {
            const fp = JSON.parse(fs.readFileSync(vkFingerprintPath, "utf8")) as {
                plaintext?: { sha256: string };
                encrypted?: { sha256: string };
            };
            expect(fp.plaintext?.sha256).to.be.a("string");
            expect(fp.encrypted?.sha256).to.be.a("string");
        }
    });

    it("P7-VK-02: verify-honk-verifier.mjs exits zero", function () {
        const out = execSync("node scripts/verify-honk-verifier.mjs", { encoding: "utf8" });
        expect(out).to.include("verify-honk-verifier: OK");
    });
});
