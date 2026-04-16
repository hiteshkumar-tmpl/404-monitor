import {
  sendTeamsAlert,
  type TeamsAlertPayload,
} from "../artifacts/api-server/src/utils/teams-notifier";
import { sendIssueAlert } from "../artifacts/api-server/src/utils/emailer";

const testTeamsPayload: TeamsAlertPayload = {
  websiteId: 1,
  websiteName: "Test Website - SiteWatch",
  issues: [
    {
      url: "https://example.com/broken-page-1",
      statusCode: 404,
      issueType: "not_found",
    },
    {
      url: "https://example.com/broken-page-2",
      statusCode: 500,
      issueType: "server_error",
    },
    {
      url: "https://example.com/broken-page-3",
      statusCode: 503,
      issueType: "server_error",
    },
  ],
  notFoundUrls: ["https://example.com/broken-page-1"],
  serverErrorUrls: [
    "https://example.com/broken-page-2",
    "https://example.com/broken-page-3",
  ],
  fixedUrls: [
    "https://example.com/fixed-page-1",
    "https://example.com/fixed-page-2",
  ],
  totalUrls: 250,
  checkedUrls: 250,
  dashboardUrl: "https://sitewatch.io/dashboard",
  currentStatus: {
    totalUrls: 250,
    trackedIssueUrls: 5,
    notFoundUrls: 2,
    serverErrorUrls: 3,
    okUrls: 245,
  },
  dayWiseBreakdown: [
    {
      date: new Date().toISOString().split("T")[0],
      notFound: 1,
      serverError: 1,
      fixed: 1,
    },
    {
      date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
      notFound: 1,
      serverError: 0,
      fixed: 0,
    },
    {
      date: new Date(Date.now() - 172800000).toISOString().split("T")[0],
      notFound: 1,
      serverError: 2,
      fixed: 2,
    },
    {
      date: new Date(Date.now() - 259200000).toISOString().split("T")[0],
      notFound: 0,
      serverError: 0,
      fixed: 1,
    },
    {
      date: new Date(Date.now() - 345600000).toISOString().split("T")[0],
      notFound: 0,
      serverError: 1,
      fixed: 3,
    },
  ],
};

const testEmailData = (to: string) => ({
  to,
  websiteName: "Test Website - SiteWatch",
  issues: [
    {
      url: "https://example.com/broken-page-1",
      statusCode: 404,
      issueType: "not_found" as const,
    },
    {
      url: "https://example.com/broken-page-2",
      statusCode: 500,
      issueType: "server_error" as const,
    },
    {
      url: "https://example.com/broken-page-3",
      statusCode: 503,
      issueType: "server_error" as const,
    },
  ],
});

async function runTest() {
  const teamsWebhookUrl = process.env.TEAMS_TEST_WEBHOOK_URL;
  const testEmailTo = process.env.TEST_ALERT_EMAIL;

  console.log("🧪 Sending test Teams summary alert...");
  if (!teamsWebhookUrl) {
    console.warn("Skipping Teams: set TEAMS_TEST_WEBHOOK_URL to a valid webhook URL.");
  } else {
    try {
      await sendTeamsAlert(teamsWebhookUrl, testTeamsPayload, "summary");
      console.log("✅ Teams summary sent!");
    } catch (err) {
      console.error("❌ Teams summary failed:", err);
    }
  }

  console.log("\n📧 Sending test email alert...");
  if (!testEmailTo) {
    console.warn("Skipping email: set TEST_ALERT_EMAIL to a recipient address.");
  } else {
    try {
      await sendIssueAlert(testEmailData(testEmailTo));
      console.log("✅ Email alert sent!");
    } catch (err) {
      console.error("❌ Email alert failed:", err);
    }
  }
}

runTest();
