import { Resend } from "resend";
import { PRODUCT_NAME } from "../constants/brand";
import { logger } from "../lib/logger";
import {
  getIssueTypeLabel,
  type IssueAlertEntry,
} from "./issue-status";

const emailFrom = process.env.EMAIL_FROM ?? "alerts@sitewatch.io";

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }

  try {
    return new Resend(process.env.RESEND_API_KEY);
  } catch (err) {
    logger.error({ err }, "Failed to initialize Resend client");
    return null;
  }
}

/**
 * Send an issue alert email to the website owner.
 */
export async function sendIssueAlert(params: {
  to: string;
  websiteName: string;
  issues: IssueAlertEntry[];
}): Promise<boolean> {
  const { to, websiteName, issues } = params;

  const resend = getResendClient();
  if (!resend) {
    logger.warn("RESEND_API_KEY not set, skipping email alert");
    return false;
  }

  const urlList = issues
    .map((issue) => `- ${issue.url} (${getIssueTypeLabel(issue.issueType)})`)
    .join("\n");

  const appOrigin = process.env.APP_URL?.replace(/\/$/, "") ?? "";
  const brandingFooterHtml = appOrigin
    ? `This alert was sent by <a href="${appOrigin}">${PRODUCT_NAME}</a>.`
    : `This alert was sent by ${PRODUCT_NAME}.`;

  const subject = `Issue Alert: ${issues.length} issue URL${issues.length > 1 ? "s" : ""} detected on ${websiteName}`;

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Website Issues Detected</h2>
      <p>The following URL${issues.length > 1 ? "s" : ""} on <strong>${websiteName}</strong> ${issues.length > 1 ? "are" : "is"} returning tracked issue responses:</p>
      <ul style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 16px 16px 16px 32px;">
        ${issues
          .map(
            (issue) =>
              `<li style="margin-bottom: 8px;"><a href="${issue.url}" style="color: #dc2626;">${issue.url}</a> <span style="color:#7f1d1d;">(${getIssueTypeLabel(issue.issueType)})</span></li>`,
          )
          .join("")}
      </ul>
      <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
        ${brandingFooterHtml}
      </p>
    </div>
  `;

  const textBody = `Website Issues Detected\n\nThe following URLs on ${websiteName} are now returning tracked issue responses:\n\n${urlList}\n\nThis alert was sent by ${PRODUCT_NAME}${appOrigin ? ` (${appOrigin})` : ""}.`;

  try {
    const { error } = await resend.emails.send({
      from: emailFrom,
      to,
      subject,
      html: htmlBody,
      text: textBody,
    });

    if (error) {
      logger.error(
        { error, to, websiteName },
        "Failed to send alert email via Resend",
      );
      return false;
    } else {
      logger.info(
        { to, websiteName, count: issues.length },
        "Sent issue alert email",
      );
      return true;
    }
  } catch (err) {
    logger.error({ err, to, websiteName }, "Exception sending alert email");
    return false;
  }
}

/**
 * Send a per-run summary email so users know a check completed even when no
 * new breakages were detected.
 */
export async function sendCheckSummaryEmail(params: {
  to: string;
  websiteName: string;
  totalUrls: number;
  checkedUrls: number;
  notFoundUrls: string[];
  serverErrorUrls: string[];
  fixedUrls: string[];
  dashboardUrl?: string;
}): Promise<boolean> {
  const {
    to,
    websiteName,
    totalUrls,
    checkedUrls,
    notFoundUrls,
    serverErrorUrls,
    fixedUrls,
    dashboardUrl,
  } = params;

  const resend = getResendClient();
  if (!resend) {
    logger.warn("RESEND_API_KEY not set, skipping summary email");
    return false;
  }

  const totalIssues = notFoundUrls.length + serverErrorUrls.length;
  const notFoundPreview =
    notFoundUrls.length > 0
      ? `<ul>${notFoundUrls.slice(0, 10).map((url) => `<li><a href="${url}" style="color:#dc2626;">${url}</a></li>`).join("")}</ul>`
      : "<p style=\"color:#16a34a;\">No 404 URLs found in this run.</p>";
  const serverErrorPreview =
    serverErrorUrls.length > 0
      ? `<ul>${serverErrorUrls.slice(0, 10).map((url) => `<li><a href="${url}" style="color:#b45309;">${url}</a></li>`).join("")}</ul>`
      : "<p style=\"color:#16a34a;\">No 5xx URLs found in this run.</p>";
  const fixedPreview =
    fixedUrls.length > 0
      ? `<ul>${fixedUrls.slice(0, 10).map((url) => `<li><a href="${url}" style="color:#16a34a;">${url}</a></li>`).join("")}</ul>`
      : "";

  const subject =
    totalIssues > 0
      ? `${PRODUCT_NAME} summary: ${totalIssues} tracked issue URL(s) on ${websiteName}`
      : `${PRODUCT_NAME} summary: no tracked issues on ${websiteName}`;

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">Check Summary</h2>
      <p><strong>${websiteName}</strong> completed a monitoring run.</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding:8px; border:1px solid #e2e8f0;"><strong>Total URLs</strong></td>
          <td style="padding:8px; border:1px solid #e2e8f0;">${totalUrls}</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #e2e8f0;"><strong>Checked</strong></td>
          <td style="padding:8px; border:1px solid #e2e8f0;">${checkedUrls}</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #e2e8f0;"><strong>Tracked Issues</strong></td>
          <td style="padding:8px; border:1px solid #e2e8f0;">${totalIssues}</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #e2e8f0;"><strong>404 URLs</strong></td>
          <td style="padding:8px; border:1px solid #e2e8f0;">${notFoundUrls.length}</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #e2e8f0;"><strong>5xx URLs</strong></td>
          <td style="padding:8px; border:1px solid #e2e8f0;">${serverErrorUrls.length}</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #e2e8f0;"><strong>Recovered</strong></td>
          <td style="padding:8px; border:1px solid #e2e8f0;">${fixedUrls.length}</td>
        </tr>
      </table>
      <h3 style="margin-top:24px;">404 URLs in this summary</h3>
      ${notFoundPreview}
      <h3 style="margin-top:24px;">5xx URLs in this summary</h3>
      ${serverErrorPreview}
      ${
        fixedUrls.length > 0
          ? `<h3 style="margin-top:24px;">Recovered URLs</h3>${fixedPreview}`
          : ""
      }
      ${
        dashboardUrl
          ? `<p style="margin-top:24px;"><a href="${dashboardUrl}" style="display:inline-block; background:#0891b2; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold;">View Dashboard</a></p>`
          : ""
      }
    </div>
  `;

  const textBody = [
    "Check Summary",
    "",
    `${websiteName} completed a monitoring run.`,
    `Total URLs: ${totalUrls}`,
    `Checked: ${checkedUrls}`,
    `Tracked issues: ${totalIssues}`,
    `404 URLs: ${notFoundUrls.length}`,
    `5xx URLs: ${serverErrorUrls.length}`,
    `Recovered: ${fixedUrls.length}`,
    "",
    notFoundUrls.length > 0
      ? `404 URLs:\n${notFoundUrls.slice(0, 10).map((u) => `- ${u}`).join("\n")}`
      : "No 404 URLs found in this run.",
    serverErrorUrls.length > 0
      ? `\n5xx URLs:\n${serverErrorUrls.slice(0, 10).map((u) => `- ${u}`).join("\n")}`
      : "\nNo 5xx URLs found in this run.",
    fixedUrls.length > 0
      ? `\nRecovered URLs:\n${fixedUrls.slice(0, 10).map((u) => `- ${u}`).join("\n")}`
      : "",
    dashboardUrl ? `\nDashboard: ${dashboardUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { error } = await resend.emails.send({
      from: emailFrom,
      to,
      subject,
      html: htmlBody,
      text: textBody,
    });

    if (error) {
      logger.error(
        { error, to, websiteName },
        "Failed to send summary email via Resend",
      );
      return false;
    }

    logger.info({ to, websiteName }, "Sent check summary email");
    return true;
  } catch (err) {
    logger.error({ err, to, websiteName }, "Exception sending summary email");
    return false;
  }
}

/**
 * Send a password reset email.
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  userName: string;
  resetLink: string;
}): Promise<void> {
  const { to, userName, resetLink } = params;

  const resend = getResendClient();
  if (!resend) {
    logger.warn("RESEND_API_KEY not set, skipping password reset email");
    return;
  }

  const subject = `Reset your ${PRODUCT_NAME} password`;

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0891b2;">Reset Your Password</h2>
      <p>Hi ${userName},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}" style="display: inline-block; background: #0891b2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">
        — The ${PRODUCT_NAME} Team
      </p>
    </div>
  `;

  const textBody = `Reset Your Password\n\nHi ${userName},\n\nWe received a request to reset your password. Click the link below to create a new password:\n\n${resetLink}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.\n\n— The ${PRODUCT_NAME} Team`;

  try {
    const { error } = await resend.emails.send({
      from: `${PRODUCT_NAME} <${emailFrom}>`,
      to,
      subject,
      html: htmlBody,
      text: textBody,
    });

    if (error) {
      logger.error(
        { error, to },
        "Failed to send password reset email via Resend",
      );
    } else {
      logger.info({ to }, "Sent password reset email");
    }
  } catch (err) {
    logger.error({ err, to }, "Exception sending password reset email");
  }
}
