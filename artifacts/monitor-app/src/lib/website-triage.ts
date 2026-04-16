export interface TriageUrl {
  id: number;
  url: string;
  isBroken: boolean;
  issueType?: "not_found" | "server_error" | null;
  isTrackedIssue?: boolean;
  lastStatus?: number | null;
  previousStatus?: number | null;
  lastCheckedAt?: string | null;
  errorMessage?: string | null;
}

export interface WebsiteSummaryData {
  currentStatus: {
    totalUrls: number;
    brokenUrls: number;
    trackedIssueUrls?: number;
    notFoundUrls?: number;
    serverErrorUrls?: number;
    okUrls: number;
  };
  recentlyBrokenUrls: string[];
  recentlyNotFoundUrls?: string[];
  recentlyServerErrorUrls?: string[];
  recentlyFixedUrls: string[];
  openIssues?: Array<{
    url: string;
    issueType: "not_found" | "server_error" | null;
    currentStatus?: number | null;
    previousStatus?: number | null;
    lastCheckedAt?: string | null;
    enteredIssueAt?: string | null;
    ageHours?: number | null;
    errorMessage?: string | null;
  }>;
  recentTransitions?: Array<{
    url: string;
    changedAt?: string | null;
    previousStatus?: number | null;
    newStatus?: number | null;
    previousIssueType?: "not_found" | "server_error" | null;
    newIssueType?: "not_found" | "server_error" | null;
    changeType?: string;
  }>;
  recentIssues?: {
    notFoundUrls: string[];
    serverErrorUrls: string[];
  };
  recoveredIssues?: string[];
}

export type WebsiteFilter =
  | "all"
  | "broken"
  | "not_found"
  | "server_error"
  | "ok"
  | "new"
  | "resolved"
  | "recent"
  | "trends";

export function buildTriageSets(summary?: WebsiteSummaryData) {
  return {
    newlyBroken: new Set(
      summary?.recentlyNotFoundUrls ?? summary?.recentlyBrokenUrls ?? [],
    ),
    newlyServerErrors: new Set(summary?.recentlyServerErrorUrls ?? []),
    recentlyFixed: new Set(summary?.recentlyFixedUrls ?? []),
  };
}

export function getUrlChangeLabel(
  url: Pick<TriageUrl, "url" | "isBroken" | "issueType">,
  summary?: WebsiteSummaryData,
): string | null {
  const triage = buildTriageSets(summary);

  if (url.issueType === "not_found" && triage.newlyBroken.has(url.url)) {
    return "New 404";
  }

  if (
    url.issueType === "server_error" &&
    triage.newlyServerErrors.has(url.url)
  ) {
    return "New 5xx";
  }

  if (!url.isBroken && triage.recentlyFixed.has(url.url)) {
    return "Recovered";
  }

  if (
    triage.newlyBroken.has(url.url) ||
    triage.newlyServerErrors.has(url.url) ||
    triage.recentlyFixed.has(url.url)
  ) {
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
      case "not_found":
        return url.issueType === "not_found";
      case "server_error":
        return url.issueType === "server_error";
      case "ok":
        return !url.isTrackedIssue;
      case "new":
        return (
          (url.issueType === "not_found" && triage.newlyBroken.has(url.url)) ||
          (url.issueType === "server_error" &&
            triage.newlyServerErrors.has(url.url))
        );
      case "resolved":
        return !url.isTrackedIssue && triage.recentlyFixed.has(url.url);
      case "recent":
        return (
          triage.newlyBroken.has(url.url) ||
          triage.newlyServerErrors.has(url.url) ||
          triage.recentlyFixed.has(url.url)
        );
      case "trends":
        return false;
      case "all":
      default:
        return true;
    }
  });
}
