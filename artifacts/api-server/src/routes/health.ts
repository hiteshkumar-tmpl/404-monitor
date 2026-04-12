import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/test", (_req, res) => {
  res.json({
    message: "Backend is working!",
    timestamp: new Date().toISOString(),
    data: {
      websites: [
        { id: 1, name: "Example Site", brokenUrls: 3, totalUrls: 100 },
        { id: 2, name: "Test Site", brokenUrls: 0, totalUrls: 50 },
      ],
      stats: {
        totalWebsites: 2,
        totalUrls: 150,
        totalBroken: 3,
      },
    },
  });
});

export default router;
