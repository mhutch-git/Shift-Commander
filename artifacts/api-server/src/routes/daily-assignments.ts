import { Router } from "express";
import { db, dailyAssignmentsTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

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
        createdAt: dailyAssignmentsTable.createdAt,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        role: usersTable.role,
        email: usersTable.email,
      })
      .from(dailyAssignmentsTable)
      .innerJoin(usersTable, eq(dailyAssignmentsTable.userId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : sql`1=1`)
      .orderBy(dailyAssignmentsTable.assignedDate, usersTable.lastName);

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/daily-assignments", requireRole(["admin", "sergeant"]), async (req, res): Promise<void> => {
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

    res.status(201).json({
      ...assignment,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      email: user.email,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/daily-assignments/:id", requireRole(["admin", "sergeant"]), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db
      .select()
      .from(dailyAssignmentsTable)
      .where(eq(dailyAssignmentsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "Assignment not found" });
      return;
    }

    await db.delete(dailyAssignmentsTable).where(eq(dailyAssignmentsTable.id, id));
    res.json({ message: "Assignment removed" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
