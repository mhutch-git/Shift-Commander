import { Router } from "express";
import { db, shiftsTable, usersTable, shiftAssignmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/shifts", requireAuth, async (req, res): Promise<void> => {
  try {
    const shifts = await db.select().from(shiftsTable).orderBy(shiftsTable.id);

    const result = await Promise.all(
      shifts.map(async (shift) => {
        // Get sergeant name
        let sergeantFirstName: string | null = null;
        let sergeantLastName: string | null = null;
        if (shift.sergeantId) {
          const [sergeant] = await db
            .select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
            .from(usersTable)
            .where(eq(usersTable.id, shift.sergeantId))
            .limit(1);
          sergeantFirstName = sergeant?.firstName ?? null;
          sergeantLastName = sergeant?.lastName ?? null;
        }

        // Get members
        const members = await db
          .select({
            id: shiftAssignmentsTable.id,
            userId: usersTable.id,
            firstName: usersTable.firstName,
            lastName: usersTable.lastName,
            role: usersTable.role,
            email: usersTable.email,
          })
          .from(shiftAssignmentsTable)
          .innerJoin(usersTable, eq(shiftAssignmentsTable.userId, usersTable.id))
          .where(eq(shiftAssignmentsTable.shiftId, shift.id));

        return {
          ...shift,
          sergeantName: sergeantFirstName && sergeantLastName
            ? `${sergeantFirstName} ${sergeantLastName}`
            : null,
          members,
        };
      })
    );

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/shifts/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id)).limit(1);

    if (!shift) {
      res.status(404).json({ message: "Shift not found" });
      return;
    }

    let sergeantFirstName: string | null = null;
    let sergeantLastName: string | null = null;
    if (shift.sergeantId) {
      const [sergeant] = await db
        .select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
        .from(usersTable)
        .where(eq(usersTable.id, shift.sergeantId))
        .limit(1);
      sergeantFirstName = sergeant?.firstName ?? null;
      sergeantLastName = sergeant?.lastName ?? null;
    }

    const members = await db
      .select({
        id: shiftAssignmentsTable.id,
        userId: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        role: usersTable.role,
        email: usersTable.email,
      })
      .from(shiftAssignmentsTable)
      .innerJoin(usersTable, eq(shiftAssignmentsTable.userId, usersTable.id))
      .where(eq(shiftAssignmentsTable.shiftId, id));

    res.json({
      ...shift,
      sergeantName: sergeantFirstName && sergeantLastName
        ? `${sergeantFirstName} ${sergeantLastName}`
        : null,
      members,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/shifts/:id", requireRole(["admin", "sergeant"]), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const requesterId = req.session.userId!;
    const requesterRole = req.session.role ?? "";
    const { name, sergeantId } = req.body;

    const updates: Record<string, unknown> = {};

    if (requesterRole === "sergeant") {
      // Sergeants may only modify the shift they currently manage
      const [managedShift] = await db
        .select({ id: shiftsTable.id })
        .from(shiftsTable)
        .where(eq(shiftsTable.sergeantId, requesterId))
        .limit(1);

      if (!managedShift || managedShift.id !== id) {
        res.status(403).json({ message: "Sergeants can only modify their own managed shift" });
        return;
      }

      // Sergeants can only update the sergeant assignment — not rename the shift
      if (sergeantId !== undefined) updates.sergeantId = sergeantId || null;
    } else {
      // Admin: full update allowed
      if (name !== undefined) updates.name = name;
      if (sergeantId !== undefined) updates.sergeantId = sergeantId || null;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: "No valid fields to update" });
      return;
    }

    const [shift] = await db
      .update(shiftsTable)
      .set(updates)
      .where(eq(shiftsTable.id, id))
      .returning();

    if (!shift) {
      res.status(404).json({ message: "Shift not found" });
      return;
    }
    res.json({ ...shift, sergeantName: null, members: [] });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
