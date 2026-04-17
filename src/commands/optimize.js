import ora from "ora";
import { optimize, AuthError, NetworkError } from "../api.js";
import { getApiKey } from "../config.js";
import {
  readPrompt,
  formatOptimizeText,
  formatOptimizeJson,
  formatOptimizeMarkdown,
} from "../format.js";

export async function optimizeCommand(promptArg, opts = {}) {
  const format = opts.format || "text";
  if (!["text", "json", "markdown"].includes(format)) {
    process.stderr.write(
      `pqs optimize: unknown --format '${format}' (use text|json|markdown)\n`
    );
    process.exit(1);
  }

  let prompt;
  try {
    prompt = await readPrompt({ arg: promptArg, file: opts.file });
  } catch (err) {
    process.stderr.write(`pqs optimize: ${err.message}\n`);
    process.exit(1);
  }
  if (!prompt) {
    process.stderr.write(
      "pqs optimize: no prompt provided (pass as arg, --file <path>, or pipe via stdin)\n"
    );
    process.exit(1);
  }

  if (!getApiKey()) {
    process.stderr.write(
      "pqs optimize: not logged in. Run `pqs login` or set PQS_API_KEY.\n"
    );
    process.exit(3);
  }

  const useSpinner = format === "text" && !opts.quiet;
  const spinner = useSpinner
    ? ora({ text: "Optimizing prompt...", stream: process.stderr }).start()
    : null;

  try {
    const result = await optimize({ prompt, vertical: opts.vertical || "general" });
    if (spinner) spinner.stop();

    const out =
      format === "json"
        ? formatOptimizeJson(result)
        : format === "markdown"
          ? formatOptimizeMarkdown(result)
          : formatOptimizeText(result, { quiet: !!opts.quiet });

    process.stdout.write(out + "\n");
  } catch (err) {
    if (spinner) spinner.fail("Optimize failed");
    if (err instanceof AuthError) {
      process.stderr.write(`pqs optimize: ${err.message}\n`);
      process.exit(3);
    }
    if (err instanceof NetworkError) {
      process.stderr.write(`pqs optimize: ${err.message}\n`);
      process.exit(2);
    }
    process.stderr.write(`pqs optimize: ${err.message}\n`);
    process.exit(2);
  }
}
