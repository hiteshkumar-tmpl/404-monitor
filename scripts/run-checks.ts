import axios from "axios";

const API_URL = process.env.API_URL || "http://localhost:3000";
const API_KEY = process.env.CRON_API_KEY || "dev-cron-secret";

async function runAllChecks() {
  console.log(`🔄 Triggering checks at ${new Date().toISOString()}`);

  try {
    const response = await axios.post(
      `${API_URL}/api/cron/check-all`,
      {},
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
        timeout: 300000, // 5 minutes
      },
    );

    console.log("✅ Checks completed:", response.data);
  } catch (error: any) {
    console.error("❌ Failed to run checks:", error.message);
    if (error.response) {
      console.error("Response:", error.response.data);
    }
    process.exit(1);
  }
}

runAllChecks();
