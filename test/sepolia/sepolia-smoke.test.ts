import { expect } from "chai";
import { spawnSync } from "node:child_process";
import path from "node:path";

const RPC = process.env.SEPOLIA_RPC_URL || process.env.VERIFY_DEPLOY_RPC_URL || "";
const DEMO_KEY = process.env.SEPOLIA_DEMO_PRIVATE_KEY || process.env.DEMO_PRIVATE_KEY || "";
const ENABLED = Boolean(RPC);

(ENABLED ? describe : describe.skip)("Sepolia: on-chain smoke", function () {
    this.timeout(600_000);

    it("SEP-01: demo:fhe --smoke health + FHE encrypt", function () {
        const script = path.join(process.cwd(), "scripts", "demo-fhe-lifecycle.mjs");
        const result = spawnSync(process.execPath, [script, "--smoke"], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                SEPOLIA_RPC_URL: RPC,
                DEMO_PRIVATE_KEY: DEMO_KEY || process.env.PRIVATE_KEY || "",
            },
            stdio: "inherit",
            shell: false,
        });
        expect(result.status, "demo:fhe --smoke should exit 0").to.equal(0);
    });

    it("SEP-02: demo:fhe --smoke with DEMO_RUN_TXS when key present", function () {
        if (!DEMO_KEY) {
            this.skip();
        }
        const script = path.join(process.cwd(), "scripts", "demo-fhe-lifecycle.mjs");
        const result = spawnSync(process.execPath, [script, "--smoke"], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                SEPOLIA_RPC_URL: RPC,
                DEMO_PRIVATE_KEY: DEMO_KEY,
                DEMO_RUN_TXS: "1",
            },
            stdio: "inherit",
            shell: false,
        });
        expect(result.status, "demo:fhe --smoke with txs should exit 0").to.equal(0);
    });
});
