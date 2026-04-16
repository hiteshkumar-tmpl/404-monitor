import { Resend } from "resend";
import { logger } from "../lib/logger";

const emailFrom = process.env.EMAIL_FROM ?? "alerts@404monitor.com";

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
 * Send a 404 alert email to the website owner.
 */
export async function send404Alert(params: {
  to: string;
  websiteName: string;
  brokenUrls: string[];
}): Promise<boolean> {
  const { to, websiteName, brokenUrls } = params;

  const resend = getResendClient();
  if (!resend) {
    logger.warn("RESEND_API_KEY not set, skipping email alert");
    return false;
  }

  const urlList = brokenUrls.map((u) => `- ${u}`).join("\n");

  const subject = `404 Alert: ${brokenUrls.length} broken page${brokenUrls.length > 1 ? "s" : ""} detected on ${websiteName}`;

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">404 Alert Detected</h2>
      <p>The following page${brokenUrls.length > 1 ? "s" : ""} on <strong>${websiteName}</strong> ${brokenUrls.length > 1 ? "are" : "is"} now returning 404 errors:</p>
      <ul style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 6px; padding: 16px 16px 16px 32px;">
        ${brokenUrls.map((u) => `<li style="margin-bottom: 8px;"><a href="${u}" style="color: #dc2626;">${u}</a></li>`).join("")}
      </ul>
      <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
        This alert was sent by <a href="https://404monitor.replit.app">404 Monitor</a>.
      </p>
    </div>
  `;

  const textBody = `404 Alert Detected\n\nThe following pages on ${websiteName} are now returning 404 errors:\n\n${urlList}\n\nThis alert was sent by 404 Monitor.`;

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
        { to, websiteName, count: brokenUrls.length },
        "Sent 404 alert email",
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
  brokenUrls: string[];
  fixedUrls: string[];
  dashboardUrl?: string;
}): Promise<boolean> {
  const {
    to,
    websiteName,
    totalUrls,
    checkedUrls,
    brokenUrls,
    fixedUrls,
    dashboardUrl,
  } = params;

  const resend = getResendClient();
  if (!resend) {
    logger.warn("RESEND_API_KEY not set, skipping summary email");
    return false;
  }

  const brokenPreview =
    brokenUrls.length > 0
      ? `<ul>${brokenUrls.slice(0, 10).map((url) => `<li><a href="${url}" style="color:#dc2626;">${url}</a></li>`).join("")}</ul>`
      : "<p style=\"color:#16a34a;\">No broken URLs found in this run.</p>";
  const fixedPreview =
    fixedUrls.length > 0
      ? `<ul>${fixedUrls.slice(0, 10).map((url) => `<li><a href="${url}" style="color:#16a34a;">${url}</a></li>`).join("")}</ul>`
      : "";

  const subject =
    brokenUrls.length > 0
      ? `404 Monitor summary: ${brokenUrls.length} broken URL(s) on ${websiteName}`
      : `404 Monitor summary: no broken URLs on ${websiteName}`;

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
          <td style="padding:8px; border:1px solid #e2e8f0;"><strong>Broken</strong></td>
          <td style="padding:8px; border:1px solid #e2e8f0;">${brokenUrls.length}</td>
        </tr>
        <tr>
          <td style="padding:8px; border:1px solid #e2e8f0;"><strong>Recovered</strong></td>
          <td style="padding:8px; border:1px solid #e2e8f0;">${fixedUrls.length}</td>
        </tr>
      </table>
      <h3 style="margin-top:24px;">Broken URLs in this summary</h3>
      ${brokenPreview}
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
    `Broken: ${brokenUrls.length}`,
    `Recovered: ${fixedUrls.length}`,
    "",
    brokenUrls.length > 0
      ? `Broken URLs:\n${brokenUrls.slice(0, 10).map((u) => `- ${u}`).join("\n")}`
      : "No broken URLs found in this run.",
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

  const subject = "Reset your 404 Monitor password";

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
        — The 404 Monitor Team
      </p>
    </div>
  `;

  const textBody = `Reset Your Password\n\nHi ${userName},\n\nWe received a request to reset your password. Click the link below to create a new password:\n\n${resetLink}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.\n\n— The 404 Monitor Team`;

  try {
    const { error } = await resend.emails.send({
      from: `404 Monitor <${emailFrom}>`,
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
