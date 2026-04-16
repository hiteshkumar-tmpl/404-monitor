import axios from "axios";
import { logger } from "../lib/logger";

export interface UrlCheckResult {
  url: string;
  statusCode: number | null;
  errorMessage: string | null;
}

const DEFAULT_TIMEOUT_MS = Number(process.env.URL_CHECK_TIMEOUT_MS || 5000);
const DEFAULT_MAX_REDIRECTS = Number(process.env.URL_CHECK_MAX_REDIRECTS || 5);
const DEFAULT_RETRIES = Number(process.env.URL_CHECK_RETRIES || 2);
const MIN_CONCURRENCY = Number(process.env.URL_CHECK_MIN_CONCURRENCY || 5);
const MAX_CONCURRENCY = Number(process.env.URL_CHECK_MAX_CONCURRENCY || 20);

/**
 * Check a single URL and return its HTTP status code.
 * Retries up to 2 times on failure with exponential backoff.
 */
async function checkUrl(
  url: string,
  retries = DEFAULT_RETRIES,
): Promise<UrlCheckResult> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout: DEFAULT_TIMEOUT_MS,
        maxRedirects: DEFAULT_MAX_REDIRECTS,
        validateStatus: () => true, // Don't throw on non-2xx
        headers: { "User-Agent": "SiteWatch/1.0" },
      });
      return { url, statusCode: response.status, errorMessage: null };
    } catch (err: unknown) {
      const isLastAttempt = attempt === retries;
      const errMsg = err instanceof Error ? err.message : String(err);

      if (!isLastAttempt) {
        // Wait before retrying: 1s, 2s
        await sleep((attempt + 1) * 1000);
        logger.warn({ url, attempt, errMsg }, "URL check failed, retrying");
      } else {
        logger.error({ url, errMsg }, "URL check failed after all retries");
        return { url, statusCode: null, errorMessage: errMsg };
      }
    }
  }
  // Should never reach here
  return { url, statusCode: null, errorMessage: "Unknown error" };
}

/**
 * Check a batch of URLs concurrently, limited to `concurrency` at a time.
 */
export async function checkUrlsBatch(
  urls: string[],
  concurrency?: number,
): Promise<UrlCheckResult[]> {
  const effectiveConcurrency = resolveConcurrency(urls.length, concurrency);
  const results = new Array<UrlCheckResult>(urls.length);
  let nextIndex = 0;

  const workers = Array.from({ length: effectiveConcurrency }, async () => {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= urls.length) return;
      results[currentIndex] = await checkUrl(urls[currentIndex]);
    }
  });

  await Promise.all(workers);

  logger.info(
    { totalUrls: urls.length, concurrency: effectiveConcurrency },
    "Completed URL check batch",
  );

  return results;
}

function resolveConcurrency(totalUrls: number, explicit?: number): number {
  if (explicit && explicit > 0) {
    return Math.max(MIN_CONCURRENCY, Math.min(MAX_CONCURRENCY, explicit));
  }

  if (totalUrls >= 2000) return MAX_CONCURRENCY;
  if (totalUrls >= 1000) return Math.min(MAX_CONCURRENCY, 15);
  if (totalUrls >= 400) return Math.min(MAX_CONCURRENCY, 10);
  if (totalUrls >= 100) return Math.min(MAX_CONCURRENCY, 8);
  return MIN_CONCURRENCY;
}

export function getRecommendedConcurrency(totalUrls: number): number {
  return resolveConcurrency(totalUrls);
}

export function getUrlCheckerConfig() {
  return {
    timeoutMs: DEFAULT_TIMEOUT_MS,
    retries: DEFAULT_RETRIES,
    maxRedirects: DEFAULT_MAX_REDIRECTS,
    minConcurrency: MIN_CONCURRENCY,
    maxConcurrency: MAX_CONCURRENCY,
  };
}

export async function runInBatches<T>(
  items: T[],
  batchSize: number,
  handler: (item: T) => Promise<void>,
): Promise<void> {
  const safeBatchSize = Math.max(1, batchSize);
  for (let i = 0; i < items.length; i += safeBatchSize) {
    const chunk = items.slice(i, i + safeBatchSize);
    await Promise.all(chunk.map(handler));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
