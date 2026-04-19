import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clubsRouter from "./clubs";
import clubCodesRouter from "./clubCodes";
import tournamentsRouter from "./tournaments";
import placesRouter from "./places";
import adminRouter from "./admin";
import feedbackRouter from "./feedback";
import tripsRouter from "./trips";
import watchesRouter from "./watches";
import pushTokensRouter from "./pushTokens";
import notificationsRouter from "./notifications";
import profileRouter from "./profile";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clubsRouter);
router.use(clubCodesRouter);
router.use(tournamentsRouter);
router.use(placesRouter);
router.use(feedbackRouter);
router.use(tripsRouter);
router.use(watchesRouter);
router.use(pushTokensRouter);
router.use(notificationsRouter);
router.use(profileRouter);
router.use(adminRouter);

export default router;
