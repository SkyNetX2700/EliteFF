import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import tournamentsRouter from "./tournaments";
import registrationsRouter from "./registrations";
import notificationsRouter from "./notifications";
import resultsRouter from "./results";
import feedbackRouter from "./feedback";
import statsRouter from "./stats";
import storageRouter from "./storage";
import adminRouter from "./admin";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/tournaments", tournamentsRouter);
router.use("/registrations", registrationsRouter);
router.use("/notifications", notificationsRouter);
router.use("/results", resultsRouter);
router.use("/feedback", feedbackRouter);
router.use("/stats", statsRouter);
router.use(storageRouter);
router.use("/admin", adminRouter);
router.use("/settings", settingsRouter);

export default router;
