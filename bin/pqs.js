#!/usr/bin/env node
import { run } from "../src/index.js";

run(process.argv).catch((err) => {
  process.stderr.write(`pqs: ${err?.message || err}\n`);
  process.exit(1);
});
