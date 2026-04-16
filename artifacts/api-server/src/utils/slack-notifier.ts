import { PRODUCT_NAME } from "../constants/brand";
import { logger } from "../lib/logger";
import {
  getIssueTypeLabel,
  type IssueAlertEntry,
} from "./issue-status";

const SLACK_WEBHOOK_REGEX =
  /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[a-zA-Z0-9]+$/;

export function isSlackWebhookUrl(url: string): boolean {
  return SLACK_WEBHOOK_REGEX.test(url);
}

export interface SlackAlertPayload {
  websiteId: number;
  websiteName: string;
  issues: IssueAlertEntry[];
  notFoundUrls: string[];
  serverErrorUrls: string[];
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

interface DayWiseBreakdown {
  date: string;
  broke?: number;
  notFound: number;
  serverError: number;
  fixed: number;
}

interface CurrentStatus {
  totalUrls: number;
  trackedIssueUrls: number;
  notFoundUrls: number;
  serverErrorUrls: number;
  okUrls: number;
}

function formatIssueList(issues: IssueAlertEntry[]): string {
  if (issues.length === 0) return "None";
  return issues
    .map(
      (issue) =>
        `• \`${issue.url}\` (${issue.statusCode} ${getIssueTypeLabel(issue.issueType)})`,
    )
    .join("\n");
}

function formatUrlList(urls: string[]): string {
  if (urls.length === 0) return "None";
  return urls.map((url) => `• \`${url}\``).join("\n");
}

function buildDayWiseSummarySlack(
  payload: SlackAlertPayload,
  currentStatus: CurrentStatus,
  dayWiseBreakdown: DayWiseBreakdown[],
): { blocks: SlackBlock[] } {
  const { websiteName, dashboardUrl, notFoundUrls, serverErrorUrls, fixedUrls } =
    payload;
  const blocks: SlackBlock[] = [];

  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `📊 ${websiteName} - Summary Report`,
      emoji: true,
    },
  });

  blocks.push({ type: "divider" });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text:
        "*📍 CURRENT STATUS*\n" +
        `🚨 *${currentStatus.trackedIssueUrls}* Issues  |  ` +
        `🔴 *${currentStatus.notFoundUrls}* 404  |  ` +
        `🟠 *${currentStatus.serverErrorUrls}* 5xx  |  ` +
        `🟢 *${currentStatus.okUrls}* OK`,
    },
  });

  const recentBreakdown = dayWiseBreakdown.slice(0, 7);
  if (recentBreakdown.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "*📅 DAY-WISE BREAKDOWN*" },
    });

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: recentBreakdown
          .map((day) => {
            const d = new Date(day.date);
            const dateStr = d.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            return `${dateStr}  │  🔴 *${day.notFound}* 404  │  🟠 *${day.serverError}* 5xx  │  🟢 *${day.fixed}* fixed`;
          })
          .join("\n"),
      },
    });
  }

  if (notFoundUrls.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*404 URLS (${notFoundUrls.length})*\n${formatUrlList(notFoundUrls.slice(0, 10))}`,
      },
    });
  }

  if (serverErrorUrls.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*5xx URLS (${serverErrorUrls.length})*\n${formatUrlList(serverErrorUrls.slice(0, 10))}`,
      },
    });
  }

  if (fixedUrls.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*RECOVERED (${fixedUrls.length})*\n${formatUrlList(fixedUrls.slice(0, 10))}`,
      },
    });
  }

  if (dashboardUrl) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View Dashboard" },
          url: dashboardUrl,
        },
      ],
    });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `Sent by ${PRODUCT_NAME}` }],
  });

  return { blocks };
}

function buildSlackMessage(
  payload: SlackAlertPayload,
  alertType: "broken" | "fixed" | "summary",
): { blocks: SlackBlock[] } {
  const { websiteName, issues, fixedUrls, totalUrls, checkedUrls, dashboardUrl } =
    payload;
  const notFoundCount = payload.notFoundUrls.length;
  const serverErrorCount = payload.serverErrorUrls.length;
  const issueCount = issues.length;
  const blocks: SlackBlock[] = [];

  if (alertType === "broken") {
    blocks.push({
      type: "header",
      text: {
        type: "plain_text",
        text: `🚨 Issue Alert: ${websiteName}`,
        emoji: true,
      },
    });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*New tracked issues detected*\n` +
          `• 404 URLs: ${notFoundCount}\n` +
          `• 5xx URLs: ${serverErrorCount}`,
      },
    });
    if (issueCount > 0) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: formatIssueList(issues.slice(0, 10)) },
      });
    }
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Checked ${checkedUrls} URLs | Found ${issueCount} new tracked issue(s)`,
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
        text: { type: "mrkdwn", text: formatUrlList(fixedUrls.slice(0, 10)) },
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
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*Summary*\n• Total URLs: ${totalUrls}\n• Checked: ${checkedUrls}\n` +
          `• Tracked issues: ${notFoundCount + serverErrorCount}\n` +
          `• 404 URLs: ${notFoundCount}\n• 5xx URLs: ${serverErrorCount}\n• Fixed: ${fixedUrls.length}`,
      },
    });
  }

  if (dashboardUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View Dashboard" },
          url: dashboardUrl,
        },
      ],
    });
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `Sent by ${PRODUCT_NAME}` }],
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

  const message =
    alertType === "summary" && payload.dayWiseBreakdown && payload.currentStatus
      ? buildDayWiseSummarySlack(
          payload,
          payload.currentStatus,
          payload.dayWiseBreakdown,
        )
      : buildSlackMessage(payload, alertType);

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
          issueCount: payload.issues.length,
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
