import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import tournamentsRouter from "./tournaments";
import registrationsRouter from "./registrations";
import notificationsRouter from "./notifications";
import resultsRouter from "./results";
import feedbackRouter from "./feedback";
import statsRouter, { historyRouter } from "./stats";

const router: IRouter = Router();

router.use("/healthz", healthRouter);
router.use(authRouter);
router.use("/tournaments", tournamentsRouter);
router.use("/registrations", registrationsRouter);
router.use("/notifications", notificationsRouter);
router.use("/results", resultsRouter);
router.use(feedbackRouter);
router.use("/stats", statsRouter);
router.use("/history", historyRouter);

export default router;
