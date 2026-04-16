import axios from "axios";
import { parseStringPromise } from "xml2js";
import { logger } from "../lib/logger";

/**
 * Fetches and parses a sitemap XML, returning all URLs found in <loc> tags.
 * Handles both sitemap index files (sitemapindex) and regular sitemaps (urlset).
 */
export async function parseSitemap(sitemapUrl: string): Promise<string[]> {
  logger.info({ sitemapUrl }, "Fetching sitemap");

  const response = await axios.get(sitemapUrl, {
    timeout: 10000,
    headers: { "User-Agent": "SiteWatch/1.0" },
    responseType: "text",
  });

  const xml = response.data as string;
  const parsed = await parseStringPromise(xml);

  const urls: string[] = [];

  // Handle sitemap index — a sitemap of sitemaps
  if (parsed.sitemapindex?.sitemap) {
    const childSitemaps: string[] = parsed.sitemapindex.sitemap
      .map((s: { loc?: string[] }) => s.loc?.[0])
      .filter(Boolean);

    logger.info({ count: childSitemaps.length }, "Found sitemap index, recursing into child sitemaps");

    // Fetch child sitemaps concurrently (limit to 5 at a time)
    const chunks = chunkArray(childSitemaps, 5);
    for (const chunk of chunks) {
      const results = await Promise.allSettled(chunk.map(parseSitemap));
      for (const result of results) {
        if (result.status === "fulfilled") {
          urls.push(...result.value);
        } else {
          logger.error({ error: result.reason }, "Failed to parse child sitemap");
        }
      }
    }
  }

  // Handle regular sitemap urlset
  if (parsed.urlset?.url) {
    const locs: string[] = parsed.urlset.url
      .map((u: { loc?: string[] }) => u.loc?.[0])
      .filter(Boolean);
    urls.push(...locs);
  }

  // Deduplicate
  return [...new Set(urls)];
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
