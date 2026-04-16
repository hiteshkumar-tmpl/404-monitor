import { logger } from "../lib/logger";
import {
  getIssueTypeLabel,
  type IssueAlertEntry,
} from "./issue-status";

/** Classic Microsoft Teams Incoming Webhook (connector). */
const TEAMS_INCOMING_WEBHOOK_REGEX =
  /^https:\/\/[\w.-]+\.webhook\.office\.com\/webhook\/[^/]+\/IncomingWebhook\/[^/]+$/i;

function isPowerAutomateOrLogicAppsWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (
      host.endsWith(".powerplatform.com") ||
      host.endsWith(".powerautomate.com")
    )
      return true;
    if (host.endsWith(".logic.azure.com")) return true;
    if (u.pathname.includes("/powerautomate/")) return true;
    if (u.pathname.includes("@")) return true;
    return false;
  } catch {
    return false;
  }
}

export function isTeamsWebhookUrl(url: string): boolean {
  return (
    TEAMS_INCOMING_WEBHOOK_REGEX.test(url) ||
    isPowerAutomateOrLogicAppsWebhookUrl(url)
  );
}

export interface TeamsAlertPayload {
  websiteId: number;
  websiteName: string;
  issues: IssueAlertEntry[];
  notFoundUrls: string[];
  serverErrorUrls: string[];
  fixedUrls: string[];
  totalUrls: number;
  checkedUrls: number;
  dashboardUrl?: string;
  currentStatus?: {
    totalUrls: number;
    trackedIssueUrls: number;
    notFoundUrls: number;
    serverErrorUrls: number;
    okUrls: number;
  };
  dayWiseBreakdown?: Array<{
    date: string;
    broke?: number;
    notFound: number;
    serverError: number;
    fixed: number;
  }>;
}

type TeamsCardElement = Record<string, unknown> & { type: string };

interface TeamsCard {
  type: string;
  version: string;
  body: TeamsCardElement[];
  actions?: TeamsCardAction[];
}

interface TeamsCardAction {
  type: string;
  title: string;
  url?: string;
}

function buildFactSet(
  payload: TeamsAlertPayload,
): Array<{ title: string; value: string }> {
  return [
    { title: "Total URLs", value: String(payload.totalUrls) },
    { title: "Checked", value: String(payload.checkedUrls) },
    {
      title: "Tracked Issues",
      value: String(payload.notFoundUrls.length + payload.serverErrorUrls.length),
    },
    { title: "404 URLs", value: String(payload.notFoundUrls.length) },
    { title: "5xx URLs", value: String(payload.serverErrorUrls.length) },
    { title: "Recovered", value: String(payload.fixedUrls.length) },
  ];
}

function buildIssueFacts(issues: IssueAlertEntry[]) {
  return issues.slice(0, 10).map((issue) => ({
    title: `${issue.statusCode}`,
    value: `${issue.url} (${getIssueTypeLabel(issue.issueType)})`,
  }));
}

function buildMessageCard(
  payload: TeamsAlertPayload,
  alertType: "broken" | "fixed" | "summary",
): TeamsCard {
  const title =
    alertType === "broken"
      ? `🚨 Issue Alert: ${payload.websiteName}`
      : alertType === "fixed"
        ? `✅ Recovery Alert: ${payload.websiteName}`
        : `📊 Check Summary: ${payload.websiteName}`;

  const body: TeamsCardElement[] = [
    {
      type: "Container",
      items: [{ type: "TextBlock", text: title, weight: "bolder", size: "large" }],
    },
  ];

  if (alertType === "broken") {
    body.push({
      type: "Container",
      items: [
        {
          type: "TextBlock",
          text: `New tracked issues detected: ${payload.notFoundUrls.length} 404 URL(s), ${payload.serverErrorUrls.length} 5xx URL(s)`,
          weight: "bolder",
        },
      ],
    });
    if (payload.issues.length > 0) {
      body.push({
        type: "Container",
        items: [{ type: "FactSet", facts: buildIssueFacts(payload.issues) }],
      });
    }
  } else if (alertType === "fixed") {
    body.push({
      type: "Container",
      items: [
        {
          type: "TextBlock",
          text: "URLs are now working again",
          weight: "bolder",
        },
        {
          type: "FactSet",
          facts: payload.fixedUrls.slice(0, 10).map((url) => ({
            title: "Recovered",
            value: url,
          })),
        },
      ],
    });
  } else {
    body.push({
      type: "Container",
      items: [{ type: "FactSet", facts: buildFactSet(payload) }],
    });

    if (payload.dayWiseBreakdown?.length) {
      body.push({
        type: "Container",
        items: [
          {
            type: "TextBlock",
            text: "Day-wise breakdown",
            weight: "bolder",
          },
          {
            type: "FactSet",
            facts: payload.dayWiseBreakdown.slice(0, 7).map((day) => ({
              title: day.date,
              value: `404 ${day.notFound} | 5xx ${day.serverError} | fixed ${day.fixed}`,
            })),
          },
        ],
      });
    }
  }

  return {
    type: "Message",
    version: "1.0",
    body,
    actions: payload.dashboardUrl
      ? [
          {
            type: "Action.OpenUrl",
            title: "View Dashboard",
            url: payload.dashboardUrl,
          },
        ]
      : [],
  };
}

function buildAdaptiveCard(
  payload: TeamsAlertPayload,
  alertType: "broken" | "fixed" | "summary",
): Record<string, unknown> {
  const body: Record<string, unknown>[] = [
    {
      type: "TextBlock",
      text:
        alertType === "broken"
          ? `🚨 Issue Alert: ${payload.websiteName}`
          : alertType === "fixed"
            ? `✅ Recovery Alert: ${payload.websiteName}`
            : `📊 Check Summary: ${payload.websiteName}`,
      weight: "Bolder",
      size: "Large",
      wrap: true,
    },
  ];

  if (alertType === "broken") {
    body.push({
      type: "TextBlock",
      text: `New tracked issues: ${payload.notFoundUrls.length} 404 URL(s), ${payload.serverErrorUrls.length} 5xx URL(s)`,
      wrap: true,
    });
    if (payload.issues.length > 0) {
      body.push({
        type: "FactSet",
        facts: buildIssueFacts(payload.issues),
      });
    }
  } else if (alertType === "fixed") {
    body.push({
      type: "FactSet",
      facts: payload.fixedUrls.slice(0, 10).map((url) => ({
        title: "Recovered",
        value: url,
      })),
    });
  } else {
    body.push({
      type: "FactSet",
      facts: buildFactSet(payload),
    });
    if (payload.dayWiseBreakdown?.length) {
      body.push({
        type: "FactSet",
        facts: payload.dayWiseBreakdown.slice(0, 7).map((day) => ({
          title: day.date,
          value: `404 ${day.notFound} | 5xx ${day.serverError} | fixed ${day.fixed}`,
        })),
      });
    }
  }

  const card: Record<string, unknown> = {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.4",
    body,
  };

  if (payload.dashboardUrl) {
    card.actions = [
      {
        type: "Action.OpenUrl",
        title: "View Dashboard",
        url: payload.dashboardUrl,
      },
    ];
  }

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: card,
      },
    ],
  };
}

export async function sendTeamsAlert(
  webhookUrl: string,
  payload: TeamsAlertPayload,
  alertType: "broken" | "fixed" | "summary" = "broken",
): Promise<void> {
  if (!isTeamsWebhookUrl(webhookUrl)) {
    logger.warn({ webhookUrl }, "Invalid Teams webhook URL format");
    return;
  }

  const body = isPowerAutomateOrLogicAppsWebhookUrl(webhookUrl)
    ? buildAdaptiveCard(payload, alertType)
    : buildMessageCard(payload, alertType);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    if (!response.ok) {
      logger.error(
        {
          status: response.status,
          response: responseText,
          websiteId: payload.websiteId,
        },
        "Failed to send Teams alert",
      );
    } else {
      logger.info(
        {
          websiteId: payload.websiteId,
          alertType,
          issueCount: payload.issues.length,
          fixedCount: payload.fixedUrls.length,
        },
        "Sent Teams alert",
      );
    }
  } catch (err) {
    logger.error(
      { err, websiteId: payload.websiteId },
      "Exception sending Teams alert",
    );
  }
}
