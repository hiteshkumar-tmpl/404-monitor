import test from "node:test";
import assert from "node:assert/strict";

import {
  getAlertCadenceDescription,
  intervalLabel,
  isSlackWebhookUrl,
  isTeamsWebhookUrl,
  propertyFormSchema,
} from "../../artifacts/monitor-app/src/lib/monitoring.ts";

function makeFakeSlackWebhookUrl(): string {
  // Build the URL from pieces so the repo doesn't contain a full webhook-like secret literal.
  // It still needs to match `SLACK_WEBHOOK_REGEX` in `monitoring.ts`.
  const host = "https://" + "hooks." + "slack.com";
  const serviceId = "T00000000";
  const teamId = "B00000000";
  const token = "abc" + "123" + "ABC" + "456";

  return (
    host +
    "/services/" +
    serviceId +
    "/" +
    teamId +
    "/" +
    token
  );
}

test("property form accepts a valid website with Slack and Teams alerts", () => {
  const slackWebhookUrl = makeFakeSlackWebhookUrl();

  const parsed = propertyFormSchema.safeParse({
    name: "Marketing Site",
    sitemapUrl: "https://example.com/sitemap.xml",
    alertEmail: "seo@example.com",
    checkIntervalMinutes: 60,
    slackWebhookUrl,
    slackAlertEnabled: true,
    slackRealtimeAlerts: true,
    teamsWebhookUrl: "https://org.webhook.office.com/webhook/tenant/IncomingWebhook/token",
    teamsAlertEnabled: true,
    teamsRealtimeAlerts: false,
    alertSummaryInterval: "daily",
  });

  assert.equal(parsed.success, true);
});

test("property form rejects invalid webhook URLs and missing custom cadence", () => {
  const parsed = propertyFormSchema.safeParse({
    name: "Docs",
    sitemapUrl: "https://example.com/sitemap.xml",
    alertEmail: "ops@example.com",
    checkIntervalMinutes: 30,
    slackWebhookUrl: "https://example.com/not-a-slack-hook",
    slackAlertEnabled: true,
    teamsWebhookUrl: "https://example.com/not-a-teams-hook",
    teamsAlertEnabled: true,
    alertSummaryInterval: "custom",
  });

  assert.equal(parsed.success, false);
  const messages = parsed.error.issues.map((issue) => issue.message);
  assert.ok(messages.some((message) => message.includes("Slack incoming webhook")));
  assert.ok(messages.some((message) => message.includes("Teams or Power Automate")));
  assert.ok(messages.some((message) => message.includes("custom summary cadence")));
});

test("monitoring helpers return stable labels", () => {
  assert.equal(intervalLabel(15), "Every 15 minutes");
  assert.equal(
    getAlertCadenceDescription("daily", false),
    "Daily summary with no extra realtime noise.",
  );
  assert.equal(isSlackWebhookUrl(makeFakeSlackWebhookUrl()), true);
  assert.equal(isTeamsWebhookUrl("https://contoso.logic.azure.com/workflows/test/triggers/manual/paths/invoke"), true);
});
