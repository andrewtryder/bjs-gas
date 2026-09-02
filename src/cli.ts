#!/usr/bin/env node
import {
  runDiscoverClubsOnly,
  runDiscoverGasFromExisting,
  runFullDiscover,
} from "./discover.js";

async function main(): Promise<void> {
  const command = process.argv[2] ?? "discover";

  switch (command) {
    case "discover": {
      const summary = await runFullDiscover();
      console.log(JSON.stringify(summary, null, 2));
      break;
    }
    case "discover:clubs": {
      const summary = await runDiscoverClubsOnly();
      console.log(JSON.stringify(summary, null, 2));
      break;
    }
    case "discover:gas": {
      const summary = await runDiscoverGasFromExisting();
      console.log(JSON.stringify(summary, null, 2));
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Usage: tsx src/cli.ts [discover|discover:clubs|discover:gas]");
      process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
