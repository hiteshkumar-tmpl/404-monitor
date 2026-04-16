import { logger } from "../lib/logger";

const SLACK_WEBHOOK_REGEX =
  /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[a-zA-Z0-9]+$/;

export function isSlackWebhookUrl(url: string): boolean {
  return SLACK_WEBHOOK_REGEX.test(url);
}

export interface SlackAlertPayload {
  websiteId: number;
  websiteName: string;
  brokenUrls: string[];
  fixedUrls: string[];
  totalUrls: number;
  checkedUrls: number;
  dashboardUrl?: string;
  currentStatus?: CurrentStatus;
  dayWiseBreakdown?: DayWiseBreakdown[];
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: Array<Record<string, unknown>>;
}

function formatBrokenUrlsList(urls: string[]): string {
  if (urls.length === 0) return "None";
  return urls.map((url) => `• \`${url}\``).join("\n");
}

function formatFixedUrlsList(urls: string[]): string {
  if (urls.length === 0) return "None";
  return urls.map((url) => `• \`${url}\``).join("\n");
}

interface DayWiseBreakdown {
  date: string;
  broke: number;
  fixed: number;
}

interface CurrentStatus {
  totalUrls: number;
  brokenUrls: number;
  okUrls: number;
}

function buildDayWiseSummarySlack(
  payload: SlackAlertPayload,
  currentStatus: CurrentStatus,
  dayWiseBreakdown: DayWiseBreakdown[],
): { blocks: SlackBlock[] } {
  const { websiteName, dashboardUrl } = payload;
  const blocks: SlackBlock[] = [];

  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `📊 ${websiteName} - Summary Report`,
      emoji: true,
    },
  });

  blocks.push({
    type: "divider",
  });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text:
        "*📍 CURRENT STATUS*\n" +
        `🔴 *${currentStatus.brokenUrls}* Broken  |  ` +
        `🟢 *${currentStatus.okUrls}* OK  |  ` +
        `📊 *${currentStatus.totalUrls}* Total`,
    },
  });

  blocks.push({
    type: "divider",
  });

  const recentBreakdown = dayWiseBreakdown.slice(0, 7);
  if (recentBreakdown.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*📅 DAY-WISE BREAKDOWN*",
      },
    });

    const breakdownLines = recentBreakdown
      .map((day) => {
        const d = new Date(day.date);
        const dateStr = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        const brokeEmoji = day.broke > 0 ? "🔴" : "⚪";
        const fixedEmoji = day.fixed > 0 ? "🟢" : "⚪";
        return `${dateStr}  │  ${brokeEmoji} *${day.broke}* broke  │  ${fixedEmoji} *${day.fixed}* fixed`;
      })
      .join("\n");

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: breakdownLines,
      },
    });
  }

  if (payload.brokenUrls.length > 0) {
    blocks.push({
      type: "divider",
    });

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🆕 NEWLY BROKEN (${payload.brokenUrls.length})*`,
      },
    });

    const brokenList = payload.brokenUrls.slice(0, 10);
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          brokenList
            .map(
              (url) =>
                `• \`${url.length > 60 ? url.substring(0, 60) + "..." : url}\``,
            )
            .join("\n") +
          (payload.brokenUrls.length > 10
            ? `\n_... and ${payload.brokenUrls.length - 10} more_`
            : ""),
      },
    });
  }

  if (payload.fixedUrls.length > 0) {
    blocks.push({
      type: "divider",
    });

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*✅ RECOVERED (${payload.fixedUrls.length})*`,
      },
    });

    const fixedList = payload.fixedUrls.slice(0, 10);
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          fixedList
            .map(
              (url) =>
                `• \`${url.length > 60 ? url.substring(0, 60) + "..." : url}\``,
            )
            .join("\n") +
          (payload.fixedUrls.length > 10
            ? `\n_... and ${payload.fixedUrls.length - 10} more_`
            : ""),
      },
    });
  }

  if (dashboardUrl) {
    blocks.push({
      type: "divider",
    });

    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🔗 View Dashboard",
          },
          url: dashboardUrl,
        },
      ],
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Sent by 404 Monitor`,
      },
    ],
  });

  return { blocks };
}

function buildSlackMessage(
  payload: SlackAlertPayload,
  alertType: "broken" | "fixed" | "summary",
): { blocks: SlackBlock[] } {
  const {
    websiteName,
    brokenUrls,
    fixedUrls,
    totalUrls,
    checkedUrls,
    dashboardUrl,
  } = payload;

  const blocks: SlackBlock[] = [];

  if (alertType === "broken") {
    blocks.push({
      type: "header",
      text: {
        type: "plain_text",
        text: `🚨 404 Alert: ${websiteName}`,
        emoji: true,
      },
    });

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*New broken URLs detected*\n${brokenUrls.length > 0 ? "" : "No new broken links."}`,
      },
    });

    if (brokenUrls.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: formatBrokenUrlsList(brokenUrls),
        },
      });
    }

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Checked ${checkedUrls} URLs | Found ${brokenUrls.length} broken`,
        },
      ],
    });
  } else if (alertType === "fixed") {
    blocks.push({
      type: "header",
      text: {
        type: "plain_text",
        text: `✅ Recovery Alert: ${websiteName}`,
        emoji: true,
      },
    });

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*URLs are now working again*\n${fixedUrls.length > 0 ? "" : "No URLs recovered."}`,
      },
    });

    if (fixedUrls.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: formatFixedUrlsList(fixedUrls),
        },
      });
    }
  } else {
    blocks.push({
      type: "header",
      text: {
        type: "plain_text",
        text: `📊 Check Summary: ${websiteName}`,
        emoji: true,
      },
    });

    const brokenCount = brokenUrls.length;
    const fixedCount = fixedUrls.length;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Summary*\n• Total URLs: ${totalUrls}\n• Checked: ${checkedUrls}\n• Broken: ${brokenCount}\n• Fixed: ${fixedCount}`,
      },
    });

    if (brokenUrls.length > 0 || fixedUrls.length > 0) {
      const changes: string[] = [];
      if (brokenUrls.length > 0) changes.push(`${brokenUrls.length} broken`);
      if (fixedUrls.length > 0) changes.push(`${fixedUrls.length} fixed`);

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Changes*\n• ${changes.join(", ")}`,
        },
      });
    }
  }

  if (dashboardUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Dashboard",
          },
          url: dashboardUrl,
        },
      ],
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Sent by 404 Monitor`,
      },
    ],
  });

  return { blocks };
}

export async function sendSlackAlert(
  webhookUrl: string,
  payload: SlackAlertPayload,
  alertType: "broken" | "fixed" | "summary" = "broken",
): Promise<void> {
  if (!isSlackWebhookUrl(webhookUrl)) {
    logger.warn({ webhookUrl }, "Invalid Slack webhook URL format");
    return;
  }

  let message: { blocks: SlackBlock[] };

  if (
    alertType === "summary" &&
    payload.dayWiseBreakdown &&
    payload.currentStatus
  ) {
    message = buildDayWiseSummarySlack(
      payload,
      payload.currentStatus,
      payload.dayWiseBreakdown,
    );
  } else {
    message = buildSlackMessage(payload, alertType);
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error(
        {
          status: response.status,
          response: text,
          websiteId: payload.websiteId,
        },
        "Failed to send Slack alert",
      );
    } else {
      logger.info(
        {
          websiteId: payload.websiteId,
          alertType,
          brokenCount: payload.brokenUrls.length,
          fixedCount: payload.fixedUrls.length,
        },
        "Sent Slack alert",
      );
    }
  } catch (err) {
    logger.error(
      { err, websiteId: payload.websiteId },
      "Exception sending Slack alert",
    );
  }
}
