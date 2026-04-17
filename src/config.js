import { homedir } from "node:os";
import { join } from "node:path";
import Conf from "conf";

// Storage: ~/.pqs/config.json (conf writes atomically and handles perms).
const store = new Conf({
  projectName: "pqs",
  configName: "config",
  cwd: join(homedir(), ".pqs"),
  fileExtension: "json",
  clearInvalidConfig: true,
});

export function getApiKey() {
  // PQS_API_KEY env var always wins over the on-disk config.
  if (process.env.PQS_API_KEY) return process.env.PQS_API_KEY;
  return store.get("apiKey") || null;
}

export function setApiKey(key) {
  store.set("apiKey", key);
}

export function clearApiKey() {
  store.delete("apiKey");
}

export function getConfigPath() {
  return store.path;
}
