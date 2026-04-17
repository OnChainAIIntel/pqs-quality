import chalk from "chalk";

// Matches GRADE_LABEL in pages/index.js of the main PQS repo. Keep in sync.
export function grade(score) {
  if (score >= 70) return "A";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

// Coarser palette than GRADE_COLOR on the homepage — terminal colors only
// have a few reliable values. A/B green, C/D yellow, F red.
export function gradeColor(score) {
  if (score >= 60) return chalk.green;
  if (score >= 35) return chalk.yellow;
  return chalk.red;
}
