import { Router } from "express";
import { db, shiftAssignmentsTable, usersTable, shiftsTable, notificationLogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { sendEmail } from "../lib/email";

const router = Router();

// Helper: get the shift id that the logged-in sergeant manages (null if not a sergeant or no shift)
async function getSergeantShiftId(userId: number): Promise<number | null> {
  const [shift] = await db
    .select({ id: shiftsTable.id })
    .from(shiftsTable)
    .where(eq(shiftsTable.sergeantId, userId))
    .limit(1);
  return shift?.id ?? null;
}

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

// Admin OR sergeant (scoped to their own shift)
router.post("/shift-assignments", requireRole(["admin", "sergeant"]), async (req, res): Promise<void> => {
  try {
    const { userId, shiftId, effectiveDate } = req.body;
    if (!userId || !shiftId) {
      res.status(400).json({ message: "userId and shiftId required" });
      return;
    }

    const parsedUserId = parseInt(userId);
    const parsedShiftId = parseInt(shiftId);
    const assignedDate = effectiveDate || new Date().toISOString().split("T")[0];
    const requesterId = req.session.userId!;
    const requesterRole = req.session.role ?? "";

    // Sergeants may only assign personnel to their own shift
    if (requesterRole === "sergeant") {
      const sergeantShiftId = await getSergeantShiftId(requesterId);
      if (sergeantShiftId !== parsedShiftId) {
        res.status(403).json({ message: "Sergeants can only assign personnel to their own shift" });
        return;
      }
    }

    // Get user info for notification and response
    const [user] = await db
      .select({ firstName: usersTable.firstName, lastName: usersTable.lastName, shiftId: usersTable.shiftId, email: usersTable.email, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, parsedUserId))
      .limit(1);

    // Get new shift info
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

      // Notify new shift's sergeant if different from requester
      if (newShift?.sergeantId && newShift.sergeantId !== parsedUserId && newShift.sergeantId !== requesterId) {
        await db.insert(notificationLogsTable).values({
          recipientId: newShift.sergeantId,
          type: "shift_assigned",
          message: `${user.firstName} ${user.lastName} has been assigned to your shift (${newShift.name}), effective ${assignedDate}.`,
          isRead: false,
        });
      }
    }

    // Return the full ShiftAssignment shape including user fields (as per OpenAPI spec)
    res.status(201).json({
      ...assignment,
      firstName: user?.firstName ?? null,
      lastName: user?.lastName ?? null,
      email: user?.email ?? null,
      role: user?.role ?? null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Admin OR sergeant (scoped to their own shift)
router.delete("/shift-assignments/:id", requireRole(["admin", "sergeant"]), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const requesterId = req.session.userId!;
    const requesterRole = req.session.role ?? "";

    const [assignment] = await db
      .select()
      .from(shiftAssignmentsTable)
      .where(eq(shiftAssignmentsTable.id, id))
      .limit(1);

    if (!assignment) {
      res.status(404).json({ message: "Assignment not found" });
      return;
    }

    // Sergeants may only remove personnel from their own shift
    if (requesterRole === "sergeant") {
      const sergeantShiftId = await getSergeantShiftId(requesterId);
      if (sergeantShiftId !== assignment.shiftId) {
        res.status(403).json({ message: "Sergeants can only remove assignments from their own shift" });
        return;
      }
    }

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
      const removalMessage = "Your shift assignment has been removed. Please contact your supervisor for details.";

      await db.insert(notificationLogsTable).values({
        recipientId: assignment.userId,
        type: "shift_assigned",
        message: removalMessage,
        isRead: false,
      });

      await sendEmail(
        user.email,
        "Shift Assignment Removed",
        `${user.firstName} ${user.lastName},\n\n${removalMessage}\n\nPlease log in to the Shift Scheduler to view your current status.`
      );
    }

    await db.delete(shiftAssignmentsTable).where(eq(shiftAssignmentsTable.id, id));

    res.json({ message: "Assignment removed" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
