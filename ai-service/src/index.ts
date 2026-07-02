import { loadAiConfig } from "./config.js";
import { createAiServiceApp, startAiService } from "./server.js";

async function main(): Promise<void> {
  const config = loadAiConfig();
  const app = createAiServiceApp(config);
  startAiService(app, config.port);
}

main().catch((err) => {
  console.error("[@medvault/ai] fatal", err);
  process.exit(1);
});
