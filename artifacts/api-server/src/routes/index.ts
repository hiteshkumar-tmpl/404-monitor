import { Router, type IRouter } from "express";
import healthRouter from "./health";
import websitesRouter from "./websites";
import authRouter from "./auth";
import usersRouter from "./users";
import cronRouter from "./cron";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(websitesRouter);
router.use(usersRouter);
router.use(cronRouter);

export default router;
