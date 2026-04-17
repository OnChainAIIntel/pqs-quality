import readline from "node:readline";
import { optimize, AuthError, NetworkError } from "../api.js";
import { setApiKey, getConfigPath } from "../config.js";

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export async function loginCommand() {
  process.stderr.write("\npqs login\n\n");
  const raw = await ask("Paste your API key (starts with pqs_live_): ");
  const key = (raw || "").trim();

  if (!key) {
    process.stderr.write("\nerror: no key entered\n");
    process.exit(1);
  }

  process.stderr.write("\nValidating key against production (may take ~30s)...\n");

  try {
    const result = await optimize({ prompt: "ping", apiKey: key });
    setApiKey(key);
    process.stderr.write(`\n✓ Logged in as tier: ${result.tier || "unknown"}\n`);
    process.stderr.write(`  Config saved to ${getConfigPath()}\n`);
  } catch (err) {
    if (err instanceof AuthError) {
      // 401 → invalid key; 402 → valid key but wrong tier.
      if (err.status === 402) {
        process.stderr.write(
          `\n✗ Key is valid but on the free tier. Paid tier required to use pqs score/optimize.\n` +
            `  Upgrade at https://pqs.onchainintel.net/pricing\n`
        );
      } else {
        process.stderr.write(`\n✗ Invalid API key\n`);
      }
      process.exit(1);
    }
    if (err instanceof NetworkError) {
      process.stderr.write(`\n✗ ${err.message}\n`);
      process.exit(2);
    }
    process.stderr.write(`\n✗ ${err.message}\n`);
    process.exit(2);
  }
}
