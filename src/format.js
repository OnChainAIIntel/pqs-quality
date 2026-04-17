import { readFileSync } from "node:fs";
import chalk from "chalk";
import { grade, gradeColor } from "./grade.js";

// --- Input ----------------------------------------------------------------
//
// Priority: explicit prompt arg > --file > piped stdin. Returns "" when
// nothing is provided; caller decides whether that's an error.

export async function readPrompt({ arg, file } = {}) {
  if (arg && String(arg).trim()) return String(arg).trim();
  if (file) return readFileSync(file, "utf8").trim();
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    return Buffer.concat(chunks).toString("utf8").trim();
  }
  return "";
}

// --- Output ---------------------------------------------------------------

const DIM_LABELS = {
  clarity: "clarity",
  specificity: "specificity",
  context: "context",
  constraints: "constraints",
  output_format: "output format",
  role_definition: "role definition",
  examples: "examples",
  cot_structure: "CoT structure",
};
const DIM_KEYS = Object.keys(DIM_LABELS);
const LABEL_PAD = Math.max(...Object.values(DIM_LABELS).map((l) => l.length));

function dimLine(k, v) {
  const bar = "█".repeat(v) + "·".repeat(Math.max(0, 10 - v));
  const label = DIM_LABELS[k].padEnd(LABEL_PAD);
  return `  ${label}  ${String(v).padStart(2)}/10  ${chalk.dim(bar)}`;
}

function rule(w = 40) {
  return chalk.dim("─".repeat(w));
}

// --- Score ----------------------------------------------------------------

export function formatScoreText(result, { quiet = false } = {}) {
  const b = result.before || {};
  const total = b.total ?? 0;
  const outOf = result.out_of ?? 80;
  const g = grade(total);
  const color = gradeColor(total);

  if (quiet) {
    return color(`${total}/${outOf} ${g}`);
  }

  const lines = [
    "",
    chalk.bold("PQS Score"),
    rule(),
    `  Grade:     ${color.bold(g)}  ${color(`${total}/${outOf}`)}`,
  ];
  if (result.tier) lines.push(`  Tier:      ${result.tier}`);
  lines.push("", chalk.bold("Dimensions"), rule());
  for (const k of DIM_KEYS) lines.push(dimLine(k, b[k] ?? 0));
  lines.push("");
  return lines.join("\n");
}

export function formatScoreJson(result) {
  return JSON.stringify(result, null, 2);
}

export function formatScoreMarkdown(result) {
  const b = result.before || {};
  const total = b.total ?? 0;
  const outOf = result.out_of ?? 80;
  const g = grade(total);
  const rows = DIM_KEYS.map((k) => `| ${DIM_LABELS[k]} | ${b[k] ?? 0}/10 |`);
  return [
    `## PQS Score: ${g} (${total}/${outOf})`,
    "",
    "| Dimension | Score |",
    "|-----------|-------|",
    ...rows,
  ].join("\n");
}

// --- Optimize -------------------------------------------------------------

export function formatOptimizeText(result, { quiet = false } = {}) {
  const b = result.before || {};
  const a = result.after || {};
  const outOf = result.out_of ?? 80;
  const bColor = gradeColor(b.total ?? 0);
  const aColor = gradeColor(a.total ?? 0);
  const bGrade = grade(b.total ?? 0);
  const aGrade = grade(a.total ?? 0);

  if (quiet) {
    return `${b.total ?? 0}/${outOf} ${bGrade} → ${a.total ?? 0}/${outOf} ${aGrade} (+${result.improvement_pct ?? 0}%)`;
  }

  return [
    "",
    chalk.bold("PQS Optimize"),
    rule(),
    `  Before:    ${bColor.bold(bGrade)}  ${bColor(`${b.total ?? 0}/${outOf}`)}`,
    `  After:     ${aColor.bold(aGrade)}  ${aColor(`${a.total ?? 0}/${outOf}`)}`,
    `  Lift:      ${chalk.green("+" + (result.improvement_pct ?? 0) + "%")}`,
    "",
    chalk.bold("Optimized prompt"),
    rule(),
    result.optimized_prompt || "",
    "",
    chalk.bold("Why"),
    rule(),
    result.explanation || "",
    "",
  ].join("\n");
}

export function formatOptimizeJson(result) {
  return JSON.stringify(result, null, 2);
}

export function formatOptimizeMarkdown(result) {
  const b = result.before || {};
  const a = result.after || {};
  const outOf = result.out_of ?? 80;
  const rows = DIM_KEYS.map(
    (k) => `| ${DIM_LABELS[k]} | ${b[k] ?? 0}/10 | ${a[k] ?? 0}/10 |`
  );
  return [
    `## PQS Optimize: ${b.total ?? 0}/${outOf} → ${a.total ?? 0}/${outOf} (+${result.improvement_pct ?? 0}%)`,
    "",
    "### Before vs After",
    "",
    "| Dimension | Before | After |",
    "|-----------|--------|-------|",
    ...rows,
    "",
    "### Optimized prompt",
    "",
    "```",
    result.optimized_prompt || "",
    "```",
    "",
    "### Why",
    "",
    result.explanation || "",
  ].join("\n");
}
