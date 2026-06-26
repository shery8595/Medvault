#!/usr/bin/env node
import { MedVaultMcpContext } from "./context.js";
import { runDoctor } from "./diagnostics.js";

async function main() {
  const ctx = new MedVaultMcpContext();
  const report = await runDoctor(ctx);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    console.error("\nDoctor found issues. Run npm run mcp:build && npm run mcp:export-config");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
