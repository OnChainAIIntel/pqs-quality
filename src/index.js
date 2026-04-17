import { Command } from "commander";
import { VERSION } from "./version.js";

function notImplemented(name) {
  return () => {
    process.stderr.write(`pqs ${name}: not implemented yet\n`);
    process.exit(1);
  };
}

export async function run(argv) {
  const program = new Command();

  program
    .name("pqs")
    .description(
      "PQS CLI — score, optimize, and gate prompts from your terminal and CI."
    )
    .version(VERSION, "-v, --version", "output the version number");

  program
    .command("login")
    .description("Save your PQS API key (validates against production)")
    .action(async () => {
      const { loginCommand } = await import("./commands/login.js");
      await loginCommand();
    });

  program
    .command("score [prompt]")
    .description("Score a prompt (reads stdin or --file if no arg)")
    .option("-f, --file <path>", "read prompt from file")
    .option("--format <fmt>", "output format: text|json|markdown", "text")
    .option("--vertical <vertical>", "vertical context hint", "general")
    .option("--quiet", "print only the total score")
    .action(async (promptArg, opts) => {
      const { scoreCommand } = await import("./commands/score.js");
      await scoreCommand(promptArg, opts);
    });

  program
    .command("optimize [prompt]")
    .description("Score + rewrite a prompt")
    .option("-f, --file <path>", "read prompt from file")
    .option("--format <fmt>", "output format: text|json|markdown", "text")
    .option("--vertical <vertical>", "vertical context hint", "general")
    .option("--quiet", "minimal output")
    .action(async (promptArg, opts) => {
      const { optimizeCommand } = await import("./commands/optimize.js");
      await optimizeCommand(promptArg, opts);
    });

  program
    .command("check")
    .description("Score prompt(s) and exit non-zero if below threshold (CI gate)")
    .option("-f, --file <path>", "score a single file")
    .option("-d, --dir <path>", "score every .md / .txt / .prompt file under a directory")
    .option("--threshold <n>", "fail if total score < n (out of 80)", "60")
    .option("--format <fmt>", "output format: text|json|markdown", "text")
    .option("--vertical <vertical>", "vertical context hint", "general")
    .option("--quiet", "print only failures")
    .action(async (opts) => {
      const { checkCommand } = await import("./commands/check.js");
      await checkCommand(opts);
    });

  program
    .command("history")
    .description("Show your recent scoring history (coming soon)")
    .action(async () => {
      const { historyCommand } = await import("./commands/history.js");
      await historyCommand();
    });

  await program.parseAsync(argv);
}
