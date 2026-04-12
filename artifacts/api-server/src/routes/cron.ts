import { Router, type RequestHandler } from "express";
import type { Request, Response, NextFunction } from "express";
import { checkAllWebsites } from "../utils/checker";

const router = Router();

router.post("/cron/check-all", async (req, res) => {
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.CRON_API_KEY || "dev-cron-secret";

  if (authHeader !== `Bearer ${expectedKey}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await checkAllWebsites();
    res.json({ success: true, message: "All website checks completed" });
  } catch (err) {
    req.log.error({ err }, "Failed to run website checks");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
