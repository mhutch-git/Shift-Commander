import { Router } from "express";
import { db, usersTable, shiftsTable, shiftAssignmentsTable, dayOffRequestsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getWorkingShiftLetter } from "../lib/schedule";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  try {
    const allUsers = await db.select().from(usersTable);
    const totalPersonnel = allUsers.length;
    const activePersonnel = allUsers.filter((u) => u.isActive).length;

    const pendingRequests = await db
      .select()
      .from(dayOffRequestsTable)
      .where(eq(dayOffRequestsTable.status, "pending"));

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayWorkingShift = getWorkingShiftLetter(today);

    const shifts = await db.select().from(shiftsTable).orderBy(shiftsTable.id);
    const shiftCounts = await Promise.all(
      shifts.map(async (shift) => {
        const assignments = await db
          .select()
          .from(shiftAssignmentsTable)
          .where(eq(shiftAssignmentsTable.shiftId, shift.id));
        return {
          shiftId: shift.id,
          shiftName: shift.name,
          count: assignments.length,
        };
      })
    );

    const recentRequests = await db
      .select({
        id: dayOffRequestsTable.id,
        userId: dayOffRequestsTable.userId,
        requestedDate: dayOffRequestsTable.requestedDate,
        reason: dayOffRequestsTable.reason,
        status: dayOffRequestsTable.status,
        createdAt: dayOffRequestsTable.createdAt,
        requesterFirstName: usersTable.firstName,
        requesterLastName: usersTable.lastName,
      })
      .from(dayOffRequestsTable)
      .innerJoin(usersTable, eq(dayOffRequestsTable.userId, usersTable.id))
      .orderBy(desc(dayOffRequestsTable.createdAt))
      .limit(5);

    res.json({
      totalPersonnel,
      activePersonnel,
      pendingRequests: pendingRequests.length,
      todayWorkingShift,
      shiftCounts,
      recentRequests,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
