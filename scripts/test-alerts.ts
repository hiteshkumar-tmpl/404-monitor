import {
  sendTeamsAlert,
  type TeamsAlertPayload,
} from "../artifacts/api-server/src/utils/teams-notifier";
import { send404Alert } from "../artifacts/api-server/src/utils/emailer";

const testTeamsPayload: TeamsAlertPayload = {
  websiteId: 1,
  websiteName: "Test Website - 404 Monitor",
  brokenUrls: [
    "https://example.com/broken-page-1",
    "https://example.com/broken-page-2",
    "https://example.com/broken-page-3",
  ],
  fixedUrls: [
    "https://example.com/fixed-page-1",
    "https://example.com/fixed-page-2",
  ],
  totalUrls: 250,
  checkedUrls: 250,
  dashboardUrl: "https://404monitor.com/dashboard",
  currentStatus: {
    totalUrls: 250,
    brokenUrls: 5,
    okUrls: 245,
  },
  dayWiseBreakdown: [
    { date: new Date().toISOString().split("T")[0], broke: 2, fixed: 1 },
    {
      date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
      broke: 1,
      fixed: 0,
    },
    {
      date: new Date(Date.now() - 172800000).toISOString().split("T")[0],
      broke: 3,
      fixed: 2,
    },
    {
      date: new Date(Date.now() - 259200000).toISOString().split("T")[0],
      broke: 0,
      fixed: 1,
    },
    {
      date: new Date(Date.now() - 345600000).toISOString().split("T")[0],
      broke: 1,
      fixed: 3,
    },
  ],
};

const testEmailData = {
  to: "hitesh.k@tunica.tech",
  websiteName: "Test Website - 404 Monitor",
  brokenUrls: [
    "https://example.com/broken-page-1",
    "https://example.com/broken-page-2",
    "https://example.com/broken-page-3",
  ],
};

async function runTest() {
  console.log("🧪 Sending test Teams summary alert...");

  // Replace with your actual Teams webhook URL
  const teamsWebhookUrl =
    "https://tunicatech.webhook.office.com/webhookb2/2b150d38-6a7b-43a9-9724-22cdd351dd89@0ef620cd-8aef-49f2-a2c8-5f9f5ea4f607/IncomingWebhook/7783c7f7a6224eb08eeff461f9595704/63175fc8-f0dc-48ba-aaf4-436aede02f01";

  try {
    await sendTeamsAlert(teamsWebhookUrl, testTeamsPayload, "summary");
    console.log("✅ Teams summary sent!");
  } catch (err) {
    console.error("❌ Teams summary failed:", err);
  }

  console.log("\n📧 Sending test email alert...");
  try {
    await send404Alert(testEmailData);
    console.log("✅ Email alert sent!");
  } catch (err) {
    console.error("❌ Email alert failed:", err);
  }
}

runTest();
