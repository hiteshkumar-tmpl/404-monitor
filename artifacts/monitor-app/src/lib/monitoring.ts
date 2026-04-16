import { z } from "zod";

export const INTERVAL_OPTIONS = [
  { label: "Every 5 minutes", value: 5 },
  { label: "Every 15 minutes", value: 15 },
  { label: "Every 30 minutes", value: 30 },
  { label: "Every 1 hour", value: 60 },
  { label: "Every 2 hours", value: 120 },
  { label: "Every 6 hours", value: 360 },
  { label: "Every 12 hours", value: 720 },
  { label: "Every 24 hours", value: 1440 },
] as const;

export const SUMMARY_INTERVAL_OPTIONS = [
  { label: "Only when something changes", value: "none" },
  { label: "Every check with a digest", value: "realtime" },
  { label: "Daily summary", value: "daily" },
  { label: "Every 3 days", value: "3days" },
  { label: "Every 5 days", value: "5days" },
  { label: "Every 7 days", value: "7days" },
  { label: "Every 14 days", value: "14days" },
  { label: "Every 30 days", value: "30days" },
  { label: "Custom cadence", value: "custom" },
] as const;

const SLACK_WEBHOOK_REGEX =
  /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[a-zA-Z0-9]+$/;
const TEAMS_INCOMING_WEBHOOK_REGEX =
  /^https:\/\/[\w.-]+\.webhook\.office\.com\/webhook\/[^/]+\/IncomingWebhook\/[^/]+$/i;

function isPowerAutomateOrLogicAppsWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;

    const host = parsed.hostname.toLowerCase();
    return (
      host.endsWith(".powerplatform.com") ||
      host.endsWith(".powerautomate.com") ||
      host.endsWith(".logic.azure.com") ||
      parsed.pathname.includes("/powerautomate/") ||
      parsed.pathname.includes("@")
    );
  } catch {
    return false;
  }
}

export function isSlackWebhookUrl(url: string): boolean {
  return SLACK_WEBHOOK_REGEX.test(url.trim());
}

export function isTeamsWebhookUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    TEAMS_INCOMING_WEBHOOK_REGEX.test(trimmed) ||
    isPowerAutomateOrLogicAppsWebhookUrl(trimmed)
  );
}

export function intervalLabel(minutes: number): string {
  const option = INTERVAL_OPTIONS.find((candidate) => candidate.value === minutes);
  if (option) return option.label;
  if (minutes < 60) return `Every ${minutes} min`;
  if (minutes < 1440) return `Every ${Math.round(minutes / 60)}h`;
  return `Every ${Math.round(minutes / 1440)}d`;
}

export function getAlertCadenceDescription(
  interval: string,
  realtimeEnabled: boolean,
): string {
  if (interval === "none" && realtimeEnabled) {
    return "Immediate alerts when something breaks or recovers.";
  }
  if (interval === "none") {
    return "Only sends alerts when something changes.";
  }
  if (interval === "realtime" && realtimeEnabled) {
    return "Sends a digest every check and immediate alerts for urgent changes.";
  }
  if (interval === "realtime") {
    return "Sends a digest after every scheduled check.";
  }
  if (interval === "custom") {
    return realtimeEnabled
      ? "Sends a custom summary plus immediate alerts for new issues."
      : "Sends a custom summary on your chosen cadence.";
  }

  const label =
    SUMMARY_INTERVAL_OPTIONS.find((option) => option.value === interval)?.label ??
    "Scheduled summary";

  return realtimeEnabled
    ? `${label} with immediate alerts for new issues.`
    : `${label} with no extra realtime noise.`;
}

export const propertyFormSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters."),
    ownerName: z.string().optional(),
    priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
    tags: z.string().optional(),
    notes: z.string().optional(),
    sitemapUrl: z
      .string()
      .url("Must be a valid URL starting with http:// or https://"),
    alertEmail: z.string().email("Must be a valid email address."),
    checkIntervalMinutes: z.coerce.number().int().min(5),
    slackWebhookUrl: z
      .string()
      .optional()
      .refine((value) => !value || isSlackWebhookUrl(value), {
        message: "Enter a valid Slack incoming webhook URL.",
      }),
    slackAlertEnabled: z.boolean().optional().default(false),
    slackRealtimeAlerts: z.boolean().optional().default(true),
    teamsWebhookUrl: z
      .string()
      .optional()
      .refine((value) => !value || isTeamsWebhookUrl(value), {
        message: "Enter a valid Microsoft Teams or Power Automate webhook URL.",
      }),
    teamsAlertEnabled: z.boolean().optional().default(false),
    teamsRealtimeAlerts: z.boolean().optional().default(true),
    alertSummaryInterval: z
      .enum([
        "none",
        "realtime",
        "daily",
        "3days",
        "5days",
        "7days",
        "14days",
        "30days",
        "custom",
      ])
      .optional()
      .default("none"),
    customSummaryDays: z.coerce.number().int().min(2).max(90).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.slackAlertEnabled && !value.slackWebhookUrl) {
      ctx.addIssue({
        code: "custom",
        message: "Add a Slack webhook URL before enabling Slack alerts.",
        path: ["slackWebhookUrl"],
      });
    }

    if (value.teamsAlertEnabled && !value.teamsWebhookUrl) {
      ctx.addIssue({
        code: "custom",
        message: "Add a Teams webhook URL before enabling Teams alerts.",
        path: ["teamsWebhookUrl"],
      });
    }

    if (value.alertSummaryInterval === "custom" && !value.customSummaryDays) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a custom summary cadence between 2 and 90 days.",
        path: ["customSummaryDays"],
      });
    }
  });

export type PropertyFormValues = z.infer<typeof propertyFormSchema>;

export const PROPERTY_SETUP_NOTICE_KEY = "property-setup-notice";

export interface PropertySetupNotice {
  websiteId: number;
  propertyName: string;
  alertDestinations: string[];
  checkIntervalMinutes: number;
}
