import { USER_AGENT } from "./version.js";
import { getApiKey } from "./config.js";

const DEFAULT_BASE = "https://pqs.onchainintel.net";

export function getApiBase() {
  return process.env.PQS_API_BASE || DEFAULT_BASE;
}

export class ApiError extends Error {
  constructor(message, { status, code, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export class AuthError extends ApiError {
  constructor(message, opts) {
    super(message, opts);
    this.name = "AuthError";
  }
}

export class NetworkError extends ApiError {
  constructor(message, opts) {
    super(message, opts);
    this.name = "NetworkError";
  }
}

export async function request(
  path,
  { method = "POST", body, apiKey, signal, timeoutMs = 60_000 } = {}
) {
  const url = `${getApiBase()}${path}`;
  const key = apiKey ?? getApiKey();

  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (key) headers["Authorization"] = `Bearer ${key}`;

  // Wire an AbortController for timeout unless caller passed their own signal.
  const controller = signal ? null : new AbortController();
  const timer = controller
    ? setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs)
    : null;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: signal || controller?.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new NetworkError(`request timed out after ${timeoutMs}ms`, { code: "timeout" });
    }
    throw new NetworkError(`network error: ${err?.message || err}`, { code: "network_error" });
  } finally {
    if (timer) clearTimeout(timer);
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && data.error) ||
      res.statusText ||
      "request failed";
    const code = (data && typeof data === "object" && data.code) || null;
    const opts = { status: res.status, code, body: data };
    if (res.status === 401 || res.status === 402) throw new AuthError(msg, opts);
    throw new ApiError(msg, opts);
  }

  return data;
}

// High-level endpoint wrappers — keep handlers skinny in src/commands/.

export async function optimize({ prompt, vertical = "general", apiKey, signal } = {}) {
  return request("/api/v1/optimize", {
    method: "POST",
    body: { prompt, vertical },
    apiKey,
    signal,
  });
}
