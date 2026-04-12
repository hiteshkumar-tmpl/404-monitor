import { logger } from "../lib/logger";

/** Classic Microsoft Teams Incoming Webhook (connector). */
const TEAMS_INCOMING_WEBHOOK_REGEX =
  /^https:\/\/[\w.-]+\.webhook\.office\.com\/webhook\/[^/]+\/IncomingWebhook\/[^/]+$/i;

/**
 * Power Platform workflow invoke URLs (incl. Teams Workflows "webhook" links).
 * Teams expects an Office 365 **MessageCard** or Adaptive Card body here — not arbitrary JSON.
 */
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
  brokenUrls: string[];
  fixedUrls: string[];
  totalUrls: number;
  checkedUrls: number;
  dashboardUrl?: string;
  currentStatus?: {
    totalUrls: number;
    brokenUrls: number;
    okUrls: number;
  };
  dayWiseBreakdown?: Array<{
    date: string;
    broke: number;
    fixed: number;
  }>;
}

/** Adaptive Card elements allow many type-specific fields (TextBlock, FactSet, Container, …). */
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

function buildBrokenMessage(payload: TeamsAlertPayload): TeamsCard {
  const { websiteName, brokenUrls, checkedUrls, dashboardUrl } = payload;

  return {
    type: "AdaptiveCard",
    version: "1.0",
    body: [
      {
        type: "Container",
        items: [
          {
            type: "TextBlock",
            text: `🚨 404 Alert: ${websiteName}`,
            weight: "bolder",
            size: "large",
            color: "attention",
          },
        ],
      },
      {
        type: "Container",
        items: [
          {
            type: "TextBlock",
            text: "New broken URLs detected",
            weight: "bolder",
          },
        ],
      },
      ...(brokenUrls.length > 0
        ? [
            {
              type: "Container",
              items: [
                {
                  type: "FactSet",
                  facts: brokenUrls.slice(0, 10).map((url) => ({
                    title: "Broken URL",
                    value: url,
                  })),
                },
              ],
            },
          ]
        : [
            {
              type: "Container",
              items: [
                {
                  type: "TextBlock",
                  text: "No new broken links.",
                },
              ],
            },
          ]),
      {
        type: "Container",
        items: [
          {
            type: "TextBlock",
            text: `Checked ${checkedUrls} URLs | Found ${brokenUrls.length} broken`,
            size: "small",
            color: "accent",
          },
        ],
      },
    ],
    actions: dashboardUrl
      ? [
          {
            type: "Action.OpenUrl",
            title: "View Dashboard",
            url: dashboardUrl,
          },
        ]
      : [],
  };
}

function buildFixedMessage(payload: TeamsAlertPayload): TeamsCard {
  const { websiteName, fixedUrls, dashboardUrl } = payload;

  return {
    type: "Message",
    version: "1.0",
    body: [
      {
        type: "Container",
        items: [
          {
            type: "TextBlock",
            text: `✅ Recovery Alert: ${websiteName}`,
            weight: "bolder",
            size: "large",
            color: "good",
          },
        ],
      },
      {
        type: "Container",
        items: [
          {
            type: "TextBlock",
            text: "URLs are now working again",
            weight: "bolder",
          },
        ],
      },
      ...(fixedUrls.length > 0
        ? [
            {
              type: "Container",
              items: [
                {
                  type: "FactSet",
                  facts: fixedUrls.slice(0, 10).map((url) => ({
                    title: "Fixed URL",
                    value: url,
                  })),
                },
              ],
            },
          ]
        : [
            {
              type: "Container",
              items: [
                {
                  type: "TextBlock",
                  text: "No URLs recovered.",
                },
              ],
            },
          ]),
    ],
    actions: dashboardUrl
      ? [
          {
            type: "Action.OpenUrl",
            title: "View Dashboard",
            url: dashboardUrl,
          },
        ]
      : [],
  };
}

/**
 * Root **Adaptive Card** JSON for Teams Workflows + "Post card in a chat or channel".
 * That action deserializes with AdaptiveCard.FromJson and requires `type: "AdaptiveCard"`.
 * @see https://adaptivecards.io/explorer/AdaptiveCard.html
 */
function buildTeamsWorkflowAdaptiveCard(
  payload: TeamsAlertPayload,
  alertType: "broken" | "fixed" | "summary",
): Record<string, unknown> {
  const {
    websiteName,
    brokenUrls,
    fixedUrls,
    totalUrls,
    checkedUrls,
    dashboardUrl,
  } = payload;

  let headerColor = "attention";
  let headerText = "404 Monitor - Broken URLs Detected";
  if (alertType === "fixed") {
    headerColor = "good";
    headerText = "404 Monitor - URLs Recovered";
  } else if (alertType === "summary") {
    headerColor = "accent";
    headerText = "404 Monitor - Check Summary";
  }

  const body: Record<string, unknown>[] = [
    {
      type: "Container",
      style: headerColor,
      items: [
        {
          type: "TextBlock",
          text: headerText,
          weight: "bolder",
          size: "large",
          color: headerColor,
          wrap: true,
        },
      ],
    },
    {
      type: "TextBlock",
      text: websiteName,
      weight: "bolder",
      size: "medium",
      wrap: true,
    },
  ];

  if (alertType === "broken" || alertType === "fixed") {
    const urls = alertType === "broken" ? brokenUrls : fixedUrls;
    body.push({
      type: "TextBlock",
      text: `${checkedUrls} URL(s) checked. ${urls.length} ${alertType === "broken" ? "broken" : "recovered"}.`,
      wrap: true,
      isSubtle: true,
      spacing: "small",
    });

    if (urls.length > 0) {
      body.push({
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: "stretch",
            items: urls.slice(0, 20).map((url) => ({
              type: "TextBlock",
              text: `• ${url.length > 80 ? url.substring(0, 80) + "..." : url}`,
              wrap: true,
              size: "small",
              color: alertType === "broken" ? "attention" : "good",
            })),
          },
        ],
      });

      if (urls.length > 20) {
        body.push({
          type: "TextBlock",
          text: `... and ${urls.length - 20} more`,
          wrap: true,
          isSubtle: true,
          size: "small",
        });
      }
    }
  } else {
    body.push({
      type: "FactSet",
      facts: [
        { title: "Total URLs", value: String(totalUrls) },
        { title: "Checked", value: String(checkedUrls) },
        { title: "Broken", value: String(brokenUrls.length) },
        { title: "Fixed", value: String(fixedUrls.length) },
      ],
    });
  }

  const card: Record<string, unknown> = {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.4",
    body,
  };

  if (dashboardUrl) {
    card.actions = [
      {
        type: "Action.OpenUrl",
        title: "View Dashboard",
        url: dashboardUrl,
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

function buildDayWiseSummaryAdaptiveCard(
  payload: TeamsAlertPayload,
  currentStatus: { totalUrls: number; brokenUrls: number; okUrls: number },
  dayWiseBreakdown: Array<{ date: string; broke: number; fixed: number }>,
): Record<string, unknown> {
  const { websiteName, brokenUrls, fixedUrls, dashboardUrl } = payload;

  const body: Record<string, unknown>[] = [
    {
      type: "Container",
      style: "attention",
      items: [
        {
          type: "TextBlock",
          text: `📊 ${websiteName} - Summary Report`,
          weight: "bolder",
          size: "large",
          color: "accent",
          wrap: true,
        },
      ],
    },
    {
      type: "TextBlock",
      text: "📍 CURRENT STATUS",
      weight: "bolder",
      size: "small",
      isSubtle: true,
      spacing: "medium",
    },
    {
      type: "FactSet",
      facts: [
        { title: "🔴 Broken", value: String(currentStatus.brokenUrls) },
        { title: "🟢 OK", value: String(currentStatus.okUrls) },
        { title: "📊 Total", value: String(currentStatus.totalUrls) },
      ],
    },
    {
      type: "TextBlock",
      text: "📅 DAY-WISE BREAKDOWN",
      weight: "bolder",
      size: "small",
      isSubtle: true,
      spacing: "medium",
    },
  ];

  const recentBreakdown = dayWiseBreakdown.slice(0, 7);
  for (const day of recentBreakdown) {
    const d = new Date(day.date);
    const dateStr = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    body.push({
      type: "ColumnSet",
      columns: [
        {
          type: "Column",
          width: "stretch",
          items: [
            {
              type: "TextBlock",
              text: dateStr,
              size: "small",
            },
          ],
        },
        {
          type: "Column",
          width: "auto",
          items: [
            {
              type: "TextBlock",
              text: day.broke > 0 ? `🔴 ${day.broke} broke` : "⚪ 0 broke",
              size: "small",
              color: day.broke > 0 ? "attention" : undefined,
            },
          ],
        },
        {
          type: "Column",
          width: "auto",
          items: [
            {
              type: "TextBlock",
              text: day.fixed > 0 ? `🟢 ${day.fixed} fixed` : "⚪ 0 fixed",
              size: "small",
              color: day.fixed > 0 ? "good" : undefined,
            },
          ],
        },
      ],
    });
  }

  if (brokenUrls.length > 0) {
    body.push({
      type: "TextBlock",
      text: `🆕 NEWLY BROKEN (${brokenUrls.length})`,
      weight: "bolder",
      size: "small",
      isSubtle: true,
      spacing: "medium",
    });

    const brokenList = brokenUrls.slice(0, 10);
    body.push({
      type: "TextBlock",
      text:
        brokenList
          .map(
            (url) =>
              `• ${url.length > 60 ? url.substring(0, 60) + "..." : url}`,
          )
          .join("\n") +
        (brokenUrls.length > 10
          ? `\n_... and ${brokenUrls.length - 10} more_`
          : ""),
      wrap: true,
      size: "small",
    });
  }

  if (fixedUrls.length > 0) {
    body.push({
      type: "TextBlock",
      text: `✅ RECOVERED (${fixedUrls.length})`,
      weight: "bolder",
      size: "small",
      isSubtle: true,
      spacing: "medium",
    });

    const fixedList = fixedUrls.slice(0, 10);
    body.push({
      type: "TextBlock",
      text:
        fixedList
          .map(
            (url) =>
              `• ${url.length > 60 ? url.substring(0, 60) + "..." : url}`,
          )
          .join("\n") +
        (fixedUrls.length > 10
          ? `\n_... and ${fixedUrls.length - 10} more_`
          : ""),
      wrap: true,
      size: "small",
    });
  }

  const card: Record<string, unknown> = {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.4",
    body,
  };

  if (dashboardUrl) {
    card.actions = [
      {
        type: "Action.OpenUrl",
        title: "🔗 View Dashboard",
        url: dashboardUrl,
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

function buildSummaryMessage(payload: TeamsAlertPayload): TeamsCard {
  const {
    websiteName,
    brokenUrls,
    fixedUrls,
    totalUrls,
    checkedUrls,
    dashboardUrl,
  } = payload;
  const brokenCount = brokenUrls.length;
  const fixedCount = fixedUrls.length;
  const hasChanges = brokenCount > 0 || fixedCount > 0;

  return {
    type: "Message",
    version: "1.0",
    body: [
      {
        type: "Container",
        items: [
          {
            type: "TextBlock",
            text: `📊 Check Summary: ${websiteName}`,
            weight: "bolder",
            size: "large",
          },
        ],
      },
      {
        type: "Container",
        items: [
          {
            type: "FactSet",
            facts: [
              { title: "Total URLs", value: String(totalUrls) },
              { title: "Checked", value: String(checkedUrls) },
              { title: "Broken", value: String(brokenCount) },
              { title: "Fixed", value: String(fixedCount) },
            ],
          },
        ],
      },
      ...(hasChanges
        ? [
            {
              type: "Container",
              items: [
                {
                  type: "TextBlock",
                  text: `Changes: ${brokenCount > 0 ? `${brokenCount} broken` : ""}${brokenCount > 0 && fixedCount > 0 ? ", " : ""}${fixedCount > 0 ? `${fixedCount} fixed` : ""}`,
                  color: brokenCount > 0 ? "attention" : "good",
                },
              ],
            },
          ]
        : []),
    ],
    actions: dashboardUrl
      ? [
          {
            type: "Action.OpenUrl",
            title: "View Dashboard",
            url: dashboardUrl,
          },
        ]
      : [],
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

  const usePlatformWorkflowWebhook =
    isPowerAutomateOrLogicAppsWebhookUrl(webhookUrl);

  let body: unknown;

  if (
    usePlatformWorkflowWebhook &&
    alertType === "summary" &&
    payload.dayWiseBreakdown &&
    payload.currentStatus
  ) {
    body = buildDayWiseSummaryAdaptiveCard(
      payload,
      payload.currentStatus,
      payload.dayWiseBreakdown,
    );
  } else if (usePlatformWorkflowWebhook) {
    body = buildTeamsWorkflowAdaptiveCard(payload, alertType);
  } else {
    let card: TeamsCard;
    switch (alertType) {
      case "broken":
        card = buildBrokenMessage(payload);
        break;
      case "fixed":
        card = buildFixedMessage(payload);
        break;
      default:
        card = buildSummaryMessage(payload);
    }
    body = card;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    const responsePreview =
      responseText.length > 500
        ? `${responseText.slice(0, 500)}…`
        : responseText;

    if (!response.ok) {
      logger.error(
        {
          status: response.status,
          response: responsePreview,
          websiteId: payload.websiteId,
          adaptiveCardPayload: usePlatformWorkflowWebhook,
        },
        "Failed to send Teams alert",
      );
    } else {
      logger.info(
        {
          websiteId: payload.websiteId,
          alertType,
          brokenCount: payload.brokenUrls.length,
          fixedCount: payload.fixedUrls.length,
          adaptiveCardPayload: usePlatformWorkflowWebhook,
          httpStatus: response.status,
          ...(usePlatformWorkflowWebhook && responsePreview
            ? { responsePreview }
            : {}),
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
