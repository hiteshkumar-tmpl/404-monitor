import { Resend } from "resend";
import { logger } from "../lib/logger";

const resend = new Resend(process.env.RESEND_API_KEY);
const emailFrom = process.env.EMAIL_FROM ?? "alerts@404monitor.com";

/**
 * Send a 404 alert email to the website owner.
 */
export async function send404Alert(params: {
  to: string;
  websiteName: string;
  brokenUrls: string[];
}): Promise<void> {
  const { to, websiteName, brokenUrls } = params;

  if (!process.env.RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY not set, skipping email alert");
    return;
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
      logger.error({ error, to, websiteName }, "Failed to send alert email via Resend");
    } else {
      logger.info({ to, websiteName, count: brokenUrls.length }, "Sent 404 alert email");
    }
  } catch (err) {
    logger.error({ err, to, websiteName }, "Exception sending alert email");
  }
}
