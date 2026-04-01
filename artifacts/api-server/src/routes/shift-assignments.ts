import { Router } from "express";
import { db, shiftAssignmentsTable, usersTable, shiftsTable, notificationLogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { sendEmail } from "../lib/email";

const router = Router();

router.get("/shift-assignments", requireAuth, async (req, res): Promise<void> => {
  try {
    const { shiftId, userId } = req.query;

    const query = db
      .select({
        id: shiftAssignmentsTable.id,
        userId: shiftAssignmentsTable.userId,
        shiftId: shiftAssignmentsTable.shiftId,
        effectiveDate: shiftAssignmentsTable.effectiveDate,
        createdAt: shiftAssignmentsTable.createdAt,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        email: usersTable.email,
        role: usersTable.role,
      })
      .from(shiftAssignmentsTable)
      .innerJoin(usersTable, eq(shiftAssignmentsTable.userId, usersTable.id));

    const conditions = [];
    if (shiftId) conditions.push(eq(shiftAssignmentsTable.shiftId, parseInt(shiftId as string)));
    if (userId) conditions.push(eq(shiftAssignmentsTable.userId, parseInt(userId as string)));

    const assignments = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    res.json(assignments);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/shift-assignments", requireRole(["admin"]), async (req, res): Promise<void> => {
  try {
    const { userId, shiftId, effectiveDate } = req.body;
    if (!userId || !shiftId) {
      res.status(400).json({ message: "userId and shiftId required" });
      return;
    }

    const parsedUserId = parseInt(userId);
    const parsedShiftId = parseInt(shiftId);
    const assignedDate = effectiveDate || new Date().toISOString().split("T")[0];

    // Get previous shift info for notification context
    const [user] = await db
      .select({ firstName: usersTable.firstName, lastName: usersTable.lastName, shiftId: usersTable.shiftId, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, parsedUserId))
      .limit(1);

    // Get new shift name
    const [newShift] = await db
      .select({ name: shiftsTable.name, sergeantId: shiftsTable.sergeantId })
      .from(shiftsTable)
      .where(eq(shiftsTable.id, parsedShiftId))
      .limit(1);

    // Update user's shiftId
    await db
      .update(usersTable)
      .set({ shiftId: parsedShiftId })
      .where(eq(usersTable.id, parsedUserId));

    // Remove any existing assignment for this user
    await db
      .delete(shiftAssignmentsTable)
      .where(eq(shiftAssignmentsTable.userId, parsedUserId));

    const [assignment] = await db
      .insert(shiftAssignmentsTable)
      .values({ userId: parsedUserId, shiftId: parsedShiftId, effectiveDate: assignedDate })
      .returning();

    // Notify the affected user
    if (user) {
      const notificationMessage = `You have been assigned to ${newShift?.name ?? "a new shift"}, effective ${assignedDate}.`;

      await db.insert(notificationLogsTable).values({
        recipientId: parsedUserId,
        type: "shift_assigned",
        message: notificationMessage,
        isRead: false,
      });

      await sendEmail(
        user.email,
        "Shift Assignment Updated",
        `${user.firstName} ${user.lastName},\n\nYou have been assigned to ${newShift?.name ?? "a new shift"}, effective ${assignedDate}.\n\nPlease log in to the Shift Scheduler to view your schedule.`
      );

      // Also notify new shift's sergeant if there is one
      if (newShift?.sergeantId && newShift.sergeantId !== parsedUserId) {
        await db.insert(notificationLogsTable).values({
          recipientId: newShift.sergeantId,
          type: "shift_assigned",
          message: `${user.firstName} ${user.lastName} has been assigned to your shift (${newShift.name}), effective ${assignedDate}.`,
          isRead: false,
        });
      }
    }

    res.status(201).json(assignment);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/shift-assignments/:id", requireRole(["admin"]), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);

    const [assignment] = await db
      .select()
      .from(shiftAssignmentsTable)
      .where(eq(shiftAssignmentsTable.id, id))
      .limit(1);

    if (assignment) {
      await db
        .update(usersTable)
        .set({ shiftId: null })
        .where(eq(usersTable.id, assignment.userId));

      // Notify the affected user
      const [user] = await db
        .select({ firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, assignment.userId))
        .limit(1);

      if (user) {
        await db.insert(notificationLogsTable).values({
          recipientId: assignment.userId,
          type: "shift_assigned",
          message: "Your shift assignment has been removed. Please contact your supervisor for details.",
          isRead: false,
        });
      }
    }

    await db.delete(shiftAssignmentsTable).where(eq(shiftAssignmentsTable.id, id));

    res.json({ message: "Assignment removed" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
