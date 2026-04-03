import { Router } from "express";
import { db, dailyAssignmentsTable, usersTable, shiftsTable, notificationLogsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { requireAuth, requireRole } from "../middlewares/auth";
import { sendEmail } from "../lib/email";

const router = Router();
const creatorUsersTable = alias(usersTable, "creator");

router.get("/daily-assignments", requireAuth, async (req, res): Promise<void> => {
  try {
    const { date, start, end, shiftType } = req.query;

    const conditions = [];
    if (date) {
      conditions.push(eq(dailyAssignmentsTable.assignedDate, date as string));
    } else {
      if (start) conditions.push(gte(dailyAssignmentsTable.assignedDate, start as string));
      if (end) conditions.push(lte(dailyAssignmentsTable.assignedDate, end as string));
    }
    if (shiftType) {
      conditions.push(eq(dailyAssignmentsTable.shiftType, shiftType as string));
    }

    const rows = await db
      .select({
        id: dailyAssignmentsTable.id,
        userId: dailyAssignmentsTable.userId,
        assignedDate: dailyAssignmentsTable.assignedDate,
        shiftType: dailyAssignmentsTable.shiftType,
        notes: dailyAssignmentsTable.notes,
        createdById: dailyAssignmentsTable.createdById,
        createdByFirstName: creatorUsersTable.firstName,
        createdByLastName: creatorUsersTable.lastName,
        createdAt: dailyAssignmentsTable.createdAt,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        role: usersTable.role,
        email: usersTable.email,
      })
      .from(dailyAssignmentsTable)
      .innerJoin(usersTable, eq(dailyAssignmentsTable.userId, usersTable.id))
      .leftJoin(creatorUsersTable, eq(dailyAssignmentsTable.createdById, creatorUsersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : sql`1=1`)
      .orderBy(dailyAssignmentsTable.assignedDate, usersTable.lastName);

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/daily-assignments", requireAuth, async (req, res): Promise<void> => {
  try {
    const { userId, assignedDate, shiftType, notes } = req.body;
    if (!userId || !assignedDate || !shiftType) {
      res.status(400).json({ message: "userId, assignedDate, and shiftType are required" });
      return;
    }
    if (!["day", "night"].includes(shiftType)) {
      res.status(400).json({ message: "shiftType must be 'day' or 'night'" });
      return;
    }

    const parsedUserId = parseInt(userId);
    const createdById = req.session.userId!;
    const requesterRole = req.session.role ?? "";

    // Deputies and reserves can only assign themselves
    if (requesterRole !== "admin" && requesterRole !== "sergeant" && parsedUserId !== createdById) {
      res.status(403).json({ message: "You can only assign yourself to a shift" });
      return;
    }

    const [user] = await db
      .select({ firstName: usersTable.firstName, lastName: usersTable.lastName, role: usersTable.role, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, parsedUserId))
      .limit(1);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const [assignment] = await db
      .insert(dailyAssignmentsTable)
      .values({ userId: parsedUserId, assignedDate, shiftType, notes: notes ?? null, createdById })
      .returning();

    // Fetch creator name
    const [creator] = createdById !== parsedUserId
      ? await db.select({ firstName: usersTable.firstName, lastName: usersTable.lastName }).from(usersTable).where(eq(usersTable.id, createdById)).limit(1)
      : [{ firstName: user.firstName, lastName: user.lastName }];

    // Notify the sergeant of the assigned user's shift
    const [assignedUser] = await db
      .select({ shiftId: usersTable.shiftId })
      .from(usersTable)
      .where(eq(usersTable.id, parsedUserId))
      .limit(1);

    if (assignedUser?.shiftId) {
      const [shift] = await db
        .select({ sergeantId: shiftsTable.sergeantId })
        .from(shiftsTable)
        .where(eq(shiftsTable.id, assignedUser.shiftId))
        .limit(1);

      if (shift?.sergeantId && shift.sergeantId !== parsedUserId) {
        const assignedByName = createdById === parsedUserId
          ? `${user.firstName} ${user.lastName}`
          : `${creator?.firstName ?? ""} ${creator?.lastName ?? ""}`.trim();

        await db.insert(notificationLogsTable).values({
          recipientId: shift.sergeantId,
          type: "general",
          message: `${user.firstName} ${user.lastName} has been assigned to the ${shiftType} shift on ${assignedDate}${createdById !== parsedUserId ? ` by ${assignedByName}` : ""}.`,
          isRead: false,
        });

        const [sergeant] = await db
          .select({ email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.id, shift.sergeantId))
          .limit(1);

        if (sergeant) {
          await sendEmail(
            sergeant.email,
            "New Shift Assignment",
            `${user.firstName} ${user.lastName} has been assigned to the ${shiftType} shift on ${assignedDate}${createdById !== parsedUserId ? ` by ${assignedByName}` : ""}.`
          );
        }
      }
    }

    res.status(201).json({
      ...assignment,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      email: user.email,
      createdByFirstName: creator?.firstName ?? null,
      createdByLastName: creator?.lastName ?? null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/daily-assignments/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const requesterId = req.session.userId!;
    const requesterRole = req.session.role ?? "";

    const [existing] = await db
      .select({
        id: dailyAssignmentsTable.id,
        userId: dailyAssignmentsTable.userId,
        assignedDate: dailyAssignmentsTable.assignedDate,
        shiftType: dailyAssignmentsTable.shiftType,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        shiftId: usersTable.shiftId,
      })
      .from(dailyAssignmentsTable)
      .innerJoin(usersTable, eq(dailyAssignmentsTable.userId, usersTable.id))
      .where(eq(dailyAssignmentsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "Assignment not found" });
      return;
    }

    // Regular users can only delete their own assignments
    if (requesterRole !== "admin" && requesterRole !== "sergeant" && existing.userId !== requesterId) {
      res.status(403).json({ message: "You can only remove your own assignments" });
      return;
    }

    await db.delete(dailyAssignmentsTable).where(eq(dailyAssignmentsTable.id, id));

    // Notify the sergeant of the removed user's shift
    if (existing.shiftId) {
      const [shift] = await db
        .select({ sergeantId: shiftsTable.sergeantId })
        .from(shiftsTable)
        .where(eq(shiftsTable.id, existing.shiftId))
        .limit(1);

      if (shift?.sergeantId && shift.sergeantId !== existing.userId) {
        const removedByName = requesterId === existing.userId
          ? `${existing.firstName} ${existing.lastName}`
          : null;

        await db.insert(notificationLogsTable).values({
          recipientId: shift.sergeantId,
          type: "general",
          message: `${existing.firstName} ${existing.lastName}'s assignment on the ${existing.shiftType} shift on ${existing.assignedDate} has been removed${removedByName ? "" : " by a supervisor"}.`,
          isRead: false,
        });

        const [sergeant] = await db
          .select({ email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.id, shift.sergeantId))
          .limit(1);

        if (sergeant) {
          await sendEmail(
            sergeant.email,
            "Shift Assignment Removed",
            `${existing.firstName} ${existing.lastName}'s assignment on the ${existing.shiftType} shift on ${existing.assignedDate} has been removed.`
          );
        }
      }
    }

    res.json({ message: "Assignment removed" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
