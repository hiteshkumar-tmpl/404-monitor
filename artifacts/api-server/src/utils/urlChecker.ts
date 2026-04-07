import axios from "axios";
import { logger } from "../lib/logger";

export interface UrlCheckResult {
  url: string;
  statusCode: number | null;
  errorMessage: string | null;
}

/**
 * Check a single URL and return its HTTP status code.
 * Retries up to 2 times on failure with exponential backoff.
 */
async function checkUrl(url: string, retries = 2): Promise<UrlCheckResult> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        maxRedirects: 5,
        validateStatus: () => true, // Don't throw on non-2xx
        headers: { "User-Agent": "404Monitor/1.0" },
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
  concurrency = 5
): Promise<UrlCheckResult[]> {
  const results: UrlCheckResult[] = [];

  // Process in chunks of `concurrency`
  for (let i = 0; i < urls.length; i += concurrency) {
    const chunk = urls.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map((url) => checkUrl(url)));
    results.push(...chunkResults);
  }

  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
