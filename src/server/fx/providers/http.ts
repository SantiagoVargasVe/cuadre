import { ProviderRequestFailedError } from "./errors";

const REQUEST_TIMEOUT_MS = 5000;
/** One retry — enough that a single transient blip doesn't fail the request that fell through to the lazy path (currency.md § Lazy fallback), without turning a genuinely-down provider into a slow hang. */
const MAX_ATTEMPTS = 2;

async function fetchOnce(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** GETs `url`, retrying once on a network error, timeout, or non-2xx before giving up. */
export async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetchOnce(url);
      if (response.ok) return response;
      lastError = new ProviderRequestFailedError(url, new Error(`HTTP ${response.status}`));
    } catch (error) {
      lastError = new ProviderRequestFailedError(url, error);
    }
  }
  throw lastError;
}
