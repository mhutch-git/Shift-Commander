import { Router } from "express";
import { db, shiftAssignmentsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/shift-assignments", requireAuth, async (req, res): Promise<void> => {
  try {
    const { shiftId, userId } = req.query;

    let query = db
      .select({
        id: shiftAssignmentsTable.id,
        userId: shiftAssignmentsTable.userId,
        shiftId: shiftAssignmentsTable.shiftId,
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
    const { userId, shiftId } = req.body;
    if (!userId || !shiftId) {
      res.status(400).json({ message: "userId and shiftId required" });
      return;
    }

    // Update user's shiftId
    await db
      .update(usersTable)
      .set({ shiftId: parseInt(shiftId) })
      .where(eq(usersTable.id, parseInt(userId)));

    // Remove any existing assignment for this user
    await db
      .delete(shiftAssignmentsTable)
      .where(eq(shiftAssignmentsTable.userId, parseInt(userId)));

    const [assignment] = await db
      .insert(shiftAssignmentsTable)
      .values({ userId: parseInt(userId), shiftId: parseInt(shiftId) })
      .returning();

    res.status(201).json(assignment);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/shift-assignments/:id", requireRole(["admin"]), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    // Get the assignment to clear user's shiftId
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
    }

    await db.delete(shiftAssignmentsTable).where(eq(shiftAssignmentsTable.id, id));

    res.json({ message: "Assignment removed" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
