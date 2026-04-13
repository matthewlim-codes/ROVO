import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clubsRouter from "./clubs";
import clubCodesRouter from "./clubCodes";
import tournamentsRouter from "./tournaments";
import placesRouter from "./places";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clubsRouter);
router.use(clubCodesRouter);
router.use(tournamentsRouter);
router.use(placesRouter);
router.use(adminRouter);

export default router;
