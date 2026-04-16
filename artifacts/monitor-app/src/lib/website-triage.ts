export interface TriageUrl {
  id: number;
  url: string;
  isBroken: boolean;
  lastStatus?: number | null;
  previousStatus?: number | null;
  lastCheckedAt?: string | null;
  errorMessage?: string | null;
}

export interface WebsiteSummaryData {
  currentStatus: {
    totalUrls: number;
    brokenUrls: number;
    okUrls: number;
  };
  recentlyBrokenUrls: string[];
  recentlyFixedUrls: string[];
}

export type WebsiteFilter =
  | "all"
  | "broken"
  | "ok"
  | "new"
  | "resolved"
  | "recent"
  | "trends";

export function buildTriageSets(summary?: WebsiteSummaryData) {
  return {
    newlyBroken: new Set(summary?.recentlyBrokenUrls ?? []),
    recentlyFixed: new Set(summary?.recentlyFixedUrls ?? []),
  };
}

export function getUrlChangeLabel(
  url: Pick<TriageUrl, "url" | "isBroken">,
  summary?: WebsiteSummaryData,
): string | null {
  const triage = buildTriageSets(summary);

  if (url.isBroken && triage.newlyBroken.has(url.url)) {
    return "New issue";
  }

  if (!url.isBroken && triage.recentlyFixed.has(url.url)) {
    return "Recovered";
  }

  if (triage.newlyBroken.has(url.url) || triage.recentlyFixed.has(url.url)) {
    return "Changed recently";
  }

  return null;
}

export function filterUrlsForView(
  urls: TriageUrl[],
  filter: WebsiteFilter,
  searchQuery: string,
  summary?: WebsiteSummaryData,
): TriageUrl[] {
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const triage = buildTriageSets(summary);

  return urls.filter((url) => {
    if (
      normalizedSearch &&
      !url.url.toLowerCase().includes(normalizedSearch)
    ) {
      return false;
    }

    switch (filter) {
      case "broken":
        return url.isBroken;
      case "ok":
        return !url.isBroken;
      case "new":
        return url.isBroken && triage.newlyBroken.has(url.url);
      case "resolved":
        return !url.isBroken && triage.recentlyFixed.has(url.url);
      case "recent":
        return (
          triage.newlyBroken.has(url.url) || triage.recentlyFixed.has(url.url)
        );
      case "trends":
        return false;
      case "all":
      default:
        return true;
    }
  });
}
