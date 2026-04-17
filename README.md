# pqs-cli

Score, optimize, and gate prompts from your terminal and CI.

## Quick start

```bash
npm install -g pqs-cli
```

```bash
# Sign up at https://pqs.onchainintel.net/pricing, then:
pqs login
```

```text
$ pqs score "explain machine learning"

PQS Score
  Grade:     F  9/80

Dimensions
  clarity         2/10  ██········
  specificity     1/10  █·········
  context         1/10  █·········
  ...
```

Requires Node 18+.

## Why PQS?

**A Quality Gate For Prompts.**
Before they break production. Paste yours below and see.

Where the web app lets you paste one prompt and watch it score, `pqs-cli` brings the same 8-dimension scorecard to your terminal and your pull requests. Use `pqs score` for a quick grade, `pqs optimize` to get the rewritten version, and `pqs check` as a GitHub Actions gate that fails the build when a prompt drops below your threshold.

## Commands

### `pqs login`

Prompts for your API key, validates it against production, and saves it to `~/.pqs/config.json`. The key is never logged.

```bash
pqs login
# Paste your API key (starts with pqs_live_): ********
# ✓ Logged in as tier: solo
```

You can skip `pqs login` entirely by exporting `PQS_API_KEY` in your shell or CI:

```bash
export PQS_API_KEY=pqs_live_...
```

The env var always takes precedence over the on-disk config.

### `pqs score [prompt]`

Score a single prompt on 8 dimensions (clarity, specificity, context, constraints, output format, role definition, examples, CoT structure). Output is a total out of 80 plus a letter grade.

```bash
# inline
pqs score "explain recursion to beginners"

# from a file
pqs score --file prompts/intro.md

# from stdin
cat prompt.md | pqs score

# one-line summary (good for shell pipelines)
pqs score "hello" --quiet
# → 9/80 F

# machine-readable output
pqs score "hello" --format json
pqs score "hello" --format markdown
```

Flags: `--file <path>`, `--format <text|json|markdown>`, `--vertical <general|software|crypto|content|business|education|science|research>`, `--quiet`.

### `pqs optimize [prompt]`

Score a prompt, then ask PQS to rewrite it — returns before/after scores plus the optimized prompt and a one-sentence explanation.

```bash
pqs optimize "write a blog post about ai"
pqs optimize --file prompts/weak.md --format markdown
cat prompt.md | pqs optimize --format json > optimized.json
```

Same flag set as `score`.

### `pqs check`

CI-focused. Scores prompt(s) and exits non-zero when any score falls below `--threshold`. Designed to be dropped into a pre-commit hook or a GitHub Actions job.

```bash
# single file
pqs check --file prompts/system.md --threshold 60

# recursive: scores every .md / .txt / .prompt under a directory
pqs check --dir ./prompts --threshold 60

# PR-comment-shaped output
pqs check --dir ./prompts --threshold 60 --format markdown
```

Flags: `--file <path>` or `--dir <path>` (exactly one required), `--threshold <0-80>` (default 60), `--format <text|json|markdown>`, `--vertical`, `--quiet`.

### `pqs history`

Reserved for v0.2. Currently prints a placeholder.

## Threshold conventions

Scores are out of 80 (eight dimensions × 10). The grade mapping matches the homepage:

| Score       | Grade |
|-------------|-------|
| 70 and up   | A     |
| 60–69       | B     |
| 50–59       | C     |
| 35–49       | D     |
| 34 or less  | F     |

Suggested thresholds for `pqs check`:

- **50** — block only the genuinely broken prompts. Good starting point.
- **60** — production-grade. Requires a B or better.
- **70** — elite. Only use when you've already invested in prompt hygiene.

## CI example — GitHub Actions

Gate your repo on prompt quality. Add `PQS_API_KEY` to your repo secrets, then drop this workflow in `.github/workflows/pqs-check.yml`:

```yaml
name: PQS check

on:
  pull_request:
    paths:
      - "prompts/**"
      - ".github/workflows/pqs-check.yml"

jobs:
  pqs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install -g pqs-cli
      - name: Run pqs check
        env:
          PQS_API_KEY: ${{ secrets.PQS_API_KEY }}
        run: pqs check --dir ./prompts --threshold 60
```

The job fails the PR when any prompt scores below 60. Swap in `--format markdown` and capture stdout to post a table as a PR comment.

## Environment variables

| Variable        | Purpose                                    |
|-----------------|--------------------------------------------|
| `PQS_API_KEY`   | API key. Overrides `~/.pqs/config.json`.   |
| `PQS_API_BASE`  | Override API host (default: production).   |
| `NO_COLOR=1`    | Disable terminal colors.                   |

## Config file

After `pqs login`, your key lives at `~/.pqs/config.json`. Delete the file to log out. The file is chmod'd by the host OS's config-dir conventions (via the [`conf`](https://github.com/sindresorhus/conf) module).

## Exit codes

| Code | Meaning                                          |
|------|--------------------------------------------------|
| 0    | Success / all prompts passed threshold           |
| 1    | Bad input (missing prompt, bad flag, threshold miss for `check`) |
| 2    | API or network error                             |
| 3    | Auth error (missing key, invalid key, wrong tier)|

## Development

```bash
git clone https://github.com/OnChainAIIntel/pqs-cli
cd pqs-cli
npm install
PQS_API_KEY=pqs_live_... npm test   # runs 6 smoke tests
```

Live tests (3, 5, 6) hit production; they're skipped automatically when `PQS_API_KEY` is unset.

## License

MIT © Ken Burbary
