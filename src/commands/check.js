import { readFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import ora from "ora";
import chalk from "chalk";
import { optimize, AuthError, NetworkError } from "../api.js";
import { getApiKey } from "../config.js";
import { grade, gradeColor } from "../grade.js";

const PROMPT_EXTENSIONS = [".md", ".txt", ".prompt"];
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage"]);

async function findPromptFiles(dir) {
  const found = [];
  async function walk(d) {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch (err) {
      throw new Error(`cannot read directory '${d}': ${err.message}`);
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      if (SKIP_DIRS.has(e.name)) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) {
        await walk(p);
      } else if (PROMPT_EXTENSIONS.some((ext) => e.name.toLowerCase().endsWith(ext))) {
        found.push(p);
      }
    }
  }
  await walk(dir);
  return found.sort();
}

function renderText(results, threshold, { quiet = false } = {}) {
  const outOf = 80;
  const failed = results.filter((r) => !r.passed);
  const lines = [];

  if (!quiet) {
    lines.push("");
    lines.push(chalk.bold(`PQS Check (threshold: ${threshold}/${outOf})`));
    lines.push(chalk.dim("─".repeat(50)));
  }

  const rows = quiet ? failed : results;
  for (const r of rows) {
    const color = gradeColor(r.total);
    const mark = r.passed ? chalk.green("✓") : chalk.red("✗");
    const score = color(`${String(r.total).padStart(2)}/${outOf} ${grade(r.total)}`);
    lines.push(`  ${mark}  ${r.file.padEnd(42)} ${score}`);
  }

  if (!quiet) {
    lines.push("");
    if (failed.length === 0) {
      lines.push(chalk.green(`  All ${results.length} prompt(s) pass threshold ${threshold}.`));
    } else {
      lines.push(chalk.red(`  ${failed.length} of ${results.length} prompt(s) below threshold ${threshold}.`));
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderMarkdown(results, threshold) {
  const outOf = 80;
  const failed = results.filter((r) => !r.passed);
  const rows = results.map((r) => {
    const status = r.passed ? "✅ pass" : "❌ fail";
    return `| \`${r.file}\` | ${r.total}/${outOf} | ${grade(r.total)} | ${status} |`;
  });
  const summary =
    failed.length === 0
      ? `**All ${results.length} prompt(s) pass threshold ${threshold}.**`
      : `**${failed.length} of ${results.length} prompt(s) below threshold ${threshold}.**`;
  return [
    `### PQS Check`,
    ``,
    `Threshold: **${threshold}/${outOf}**`,
    ``,
    `| File | Score | Grade | Status |`,
    `|------|-------|-------|--------|`,
    ...rows,
    ``,
    summary,
  ].join("\n");
}

function renderJson(results, threshold) {
  return JSON.stringify(
    {
      threshold,
      out_of: 80,
      total_checked: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      results: results.map((r) => ({
        file: r.file,
        total: r.total,
        grade: grade(r.total),
        passed: r.passed,
      })),
    },
    null,
    2
  );
}

export async function checkCommand(opts = {}) {
  const format = opts.format || "text";
  if (!["text", "json", "markdown"].includes(format)) {
    process.stderr.write(
      `pqs check: unknown --format '${format}' (use text|json|markdown)\n`
    );
    process.exit(1);
  }

  const threshold = Number(opts.threshold);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 80) {
    process.stderr.write(
      `pqs check: --threshold must be 0-80, got '${opts.threshold}'\n`
    );
    process.exit(1);
  }

  if (!opts.file && !opts.dir) {
    process.stderr.write("pqs check: must provide --file or --dir\n");
    process.exit(1);
  }
  if (opts.file && opts.dir) {
    process.stderr.write("pqs check: pass --file or --dir, not both\n");
    process.exit(1);
  }

  if (!getApiKey()) {
    process.stderr.write(
      "pqs check: not logged in. Run `pqs login` or set PQS_API_KEY.\n"
    );
    process.exit(3);
  }

  // --- Collect files ------------------------------------------------------
  let files;
  try {
    if (opts.file) {
      await stat(opts.file);
      files = [opts.file];
    } else {
      files = await findPromptFiles(opts.dir);
    }
  } catch (err) {
    process.stderr.write(`pqs check: ${err.message}\n`);
    process.exit(1);
  }

  if (files.length === 0) {
    process.stderr.write(
      `pqs check: no prompt files found under '${opts.dir}' (looking for ${PROMPT_EXTENSIONS.join(", ")})\n`
    );
    process.exit(1);
  }

  // --- Score each sequentially -------------------------------------------
  // Each score hits /api/v1/optimize which is billable. Running in serial
  // keeps cost predictable and avoids upstream rate limits.
  const useSpinner = format === "text" && !opts.quiet;
  const spinner = useSpinner
    ? ora({ text: `Scoring ${files.length} prompt(s)...`, stream: process.stderr }).start()
    : null;

  const results = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (spinner) spinner.text = `Scoring ${i + 1}/${files.length}: ${relative(process.cwd(), file)}`;
      const prompt = readFileSync(file, "utf8").trim();
      if (!prompt) {
        results.push({ file, total: 0, passed: 0 >= threshold });
        continue;
      }
      const result = await optimize({ prompt, vertical: opts.vertical || "general" });
      const total = result.before?.total ?? 0;
      results.push({ file, total, passed: total >= threshold });
    }
    if (spinner) spinner.stop();
  } catch (err) {
    if (spinner) spinner.fail("Check failed");
    if (err instanceof AuthError) {
      process.stderr.write(`pqs check: ${err.message}\n`);
      process.exit(3);
    }
    if (err instanceof NetworkError) {
      process.stderr.write(`pqs check: ${err.message}\n`);
      process.exit(2);
    }
    process.stderr.write(`pqs check: ${err.message}\n`);
    process.exit(2);
  }

  // --- Emit output --------------------------------------------------------
  const out =
    format === "json"
      ? renderJson(results, threshold)
      : format === "markdown"
        ? renderMarkdown(results, threshold)
        : renderText(results, threshold, { quiet: !!opts.quiet });
  process.stdout.write(out + "\n");

  const anyFailed = results.some((r) => !r.passed);
  process.exit(anyFailed ? 1 : 0);
}
