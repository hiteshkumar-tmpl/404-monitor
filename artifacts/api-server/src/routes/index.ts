import { Router, type IRouter } from "express";
import healthRouter from "./health";
import websitesRouter from "./websites";

const router: IRouter = Router();

router.use(healthRouter);
router.use(websitesRouter);

export default router;
