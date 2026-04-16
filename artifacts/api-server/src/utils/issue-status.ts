export type TrackedIssueType = "not_found" | "server_error";

export interface IssueAlertEntry {
  url: string;
  statusCode: number;
  issueType: TrackedIssueType;
}

type StoredUrlStatus = {
  issueType?: string | null;
  lastStatus?: number | null;
  isTrackedIssue?: boolean;
  isBroken?: boolean;
};

type HistoryStatus = {
  previousIssueType?: string | null;
  newIssueType?: string | null;
  previousStatus?: number | null;
  newStatus?: number | null;
  wasBroken?: boolean;
  becameFixed?: boolean;
};

export function classifyIssueType(
  statusCode: number | null | undefined,
): TrackedIssueType | null {
  if (statusCode === 404) {
    return "not_found";
  }

  if (
    statusCode !== null &&
    statusCode !== undefined &&
    statusCode >= 500 &&
    statusCode < 600
  ) {
    return "server_error";
  }

  return null;
}

export function deriveStoredIssueType(
  url: StoredUrlStatus,
): TrackedIssueType | null {
  if (url.issueType === "not_found" || url.issueType === "server_error") {
    return url.issueType;
  }

  if (url.isBroken) {
    return "not_found";
  }

  if (url.isTrackedIssue) {
    return classifyIssueType(url.lastStatus);
  }

  return classifyIssueType(url.lastStatus);
}

export function deriveHistoryIssueTypes(entry: HistoryStatus): {
  previousIssueType: TrackedIssueType | null;
  newIssueType: TrackedIssueType | null;
} {
  const previousIssueType =
    entry.previousIssueType === "not_found" ||
    entry.previousIssueType === "server_error"
      ? entry.previousIssueType
      : entry.wasBroken
        ? "not_found"
        : classifyIssueType(entry.previousStatus);

  const newIssueType =
    entry.newIssueType === "not_found" || entry.newIssueType === "server_error"
      ? entry.newIssueType
      : entry.becameFixed
        ? null
        : classifyIssueType(entry.newStatus);

  return { previousIssueType, newIssueType };
}

export function getIssueTypeLabel(
  issueType: TrackedIssueType | null | undefined,
): string {
  switch (issueType) {
    case "not_found":
      return "404 not found";
    case "server_error":
      return "5xx server error";
    default:
      return "healthy";
  }
}

export function getIssueTypeBadgeLabel(
  issueType: TrackedIssueType | null | undefined,
): string {
  switch (issueType) {
    case "not_found":
      return "404";
    case "server_error":
      return "5xx";
    default:
      return "OK";
  }
}
