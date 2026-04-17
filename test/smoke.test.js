import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, "..", "bin", "pqs.js");

// Spawn the CLI in a fully controlled env. Tests that need to prove "no key
// on disk" pass a throwaway HOME so the `conf` store can't find the caller's
// real ~/.pqs/config.json.
function run(args, { env = {}, input = null, timeoutMs = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [CLI, ...args], {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`timed out after ${timeoutMs}ms: pqs ${args.join(" ")}`));
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    if (input !== null) child.stdin.write(input);
    child.stdin.end();
  });
}

function isolatedEnv(extra = {}) {
  const home = mkdtempSync(join(tmpdir(), "pqs-smoke-"));
  return { HOME: home, PQS_API_KEY: "", ...extra };
}

// ---- 1. --version -------------------------------------------------------

test("1. pqs --version prints a version", async () => {
  const { code, stdout } = await run(["--version"]);
  assert.equal(code, 0);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+/, "version should look like x.y.z");
});

// ---- 2. --help ----------------------------------------------------------

test("2. pqs --help lists all commands", async () => {
  const { code, stdout } = await run(["--help"]);
  assert.equal(code, 0);
  for (const cmd of ["login", "score", "optimize", "check", "history"]) {
    assert.match(stdout, new RegExp(`\\b${cmd}\\b`), `help should list '${cmd}'`);
  }
});

// ---- 3. login with bogus key rejects ------------------------------------
//
// Hits prod. Requires outbound network. Does NOT require PQS_API_KEY — the
// key comes from stdin — but the CLI talks to the real server to validate.

test("3. pqs login with bogus key is rejected", async () => {
  const { code, stderr } = await run(["login"], {
    env: isolatedEnv(),
    input: "pqs_live_definitely_not_a_real_key_xxxxxxxxxxxx\n",
    timeoutMs: 60_000,
  });
  assert.equal(code, 1, `expected exit 1, got ${code}. stderr: ${stderr}`);
  assert.match(stderr, /Invalid/i, "stderr should mention invalid key");
});

// ---- 4. score without auth gives a clear error --------------------------

test("4. pqs score without auth prints a clear error and exits 3", async () => {
  const { code, stderr } = await run(["score", "test"], { env: isolatedEnv() });
  assert.equal(code, 3, `expected exit 3 (auth), got ${code}`);
  assert.match(stderr, /not logged in/i, "stderr should mention not logged in");
});

// ---- 5. score JSON shape ------------------------------------------------
//
// Live API call. Skipped if PQS_API_KEY not present.

test("5. pqs score --format json returns a valid scored payload", async (t) => {
  if (!process.env.PQS_API_KEY) {
    t.skip("PQS_API_KEY not set; skipping live test");
    return;
  }
  const { code, stdout, stderr } = await run(
    ["score", "explain recursion to beginners", "--format", "json"],
    { timeoutMs: 120_000 }
  );
  assert.equal(code, 0, `expected exit 0, got ${code}. stderr: ${stderr}`);
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (err) {
    assert.fail(`stdout is not valid JSON: ${err.message}\nstdout was:\n${stdout}`);
  }
  assert.ok(parsed.pqs_version, "payload.pqs_version");
  assert.ok(parsed.before && typeof parsed.before.total === "number", "payload.before.total");
  assert.ok(parsed.after && typeof parsed.after.total === "number", "payload.after.total");
  assert.equal(typeof parsed.out_of, "number", "payload.out_of");
  assert.ok(parsed.original_prompt, "payload.original_prompt");
  assert.ok(parsed.optimized_prompt, "payload.optimized_prompt");
});

// ---- 6. check on fixtures returns a valid exit code ---------------------

test("6. pqs check on ./test/fixtures with threshold 50 exits 0 or 1", async (t) => {
  if (!process.env.PQS_API_KEY) {
    t.skip("PQS_API_KEY not set; skipping live test");
    return;
  }
  const { code, stderr } = await run(
    ["check", "--dir", "./test/fixtures", "--threshold", "50"],
    { timeoutMs: 180_000 }
  );
  assert.ok([0, 1].includes(code), `expected 0 or 1, got ${code}. stderr: ${stderr}`);
});
