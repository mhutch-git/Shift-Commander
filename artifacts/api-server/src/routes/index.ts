import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import shiftsRouter from "./shifts";
import shiftAssignmentsRouter from "./shift-assignments";
import dailyAssignmentsRouter from "./daily-assignments";
import scheduleRouter from "./schedule";
import dayOffRequestsRouter from "./day-off-requests";
import dashboardRouter from "./dashboard";
import notificationsRouter from "./notifications";
import publicCalendarRouter from "./public-calendar";

const router: IRouter = Router();

router.use(publicCalendarRouter); // no auth — token-validated
router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(shiftsRouter);
router.use(shiftAssignmentsRouter);
router.use(dailyAssignmentsRouter);
router.use(scheduleRouter);
router.use(dayOffRequestsRouter);
router.use(dashboardRouter);
router.use(notificationsRouter);

export default router;
