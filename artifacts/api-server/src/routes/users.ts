import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, shiftsTable, shiftAssignmentsTable, notificationLogsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { sendEmail } from "../lib/email";

async function syncShiftAssignment(userId: number, shiftId: number | null, effectiveDate?: string): Promise<void> {
  await db.delete(shiftAssignmentsTable).where(eq(shiftAssignmentsTable.userId, userId));
  if (shiftId !== null) {
    await db.insert(shiftAssignmentsTable).values({
      userId,
      shiftId,
      effectiveDate: effectiveDate ?? new Date().toISOString().split("T")[0],
    });
  }
}

const router = Router();

// Helper: get the shift id that a sergeant manages
async function getSergeantShiftId(userId: number): Promise<number | null> {
  const [shift] = await db
    .select({ id: shiftsTable.id })
    .from(shiftsTable)
    .where(eq(shiftsTable.sergeantId, userId))
    .limit(1);
  return shift?.id ?? null;
}

router.get("/users", requireAuth, async (req, res): Promise<void> => {
  try {
    const requesterId = req.session.userId!;
    const requesterRole = req.session.role ?? "";

    const baseSelect = {
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      role: usersTable.role,
      shiftId: usersTable.shiftId,
      shiftName: shiftsTable.name,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    };

    if (requesterRole === "admin") {
      // Admins see everyone
      const users = await db
        .select(baseSelect)
        .from(usersTable)
        .leftJoin(shiftsTable, eq(usersTable.shiftId, shiftsTable.id))
        .orderBy(desc(usersTable.createdAt));
      res.json(users);
      return;
    }

    if (requesterRole === "sergeant") {
      // Sergeants see their own shift members + themselves (if not in a shift)
      const shiftId = await getSergeantShiftId(requesterId);
      const users = shiftId
        ? await db
            .select(baseSelect)
            .from(usersTable)
            .leftJoin(shiftsTable, eq(usersTable.shiftId, shiftsTable.id))
            .where(eq(usersTable.shiftId, shiftId))
            .orderBy(desc(usersTable.createdAt))
        : await db
            .select(baseSelect)
            .from(usersTable)
            .leftJoin(shiftsTable, eq(usersTable.shiftId, shiftsTable.id))
            .where(eq(usersTable.id, requesterId))
            .orderBy(desc(usersTable.createdAt));
      res.json(users);
      return;
    }

    // Deputies see only themselves
    const users = await db
      .select(baseSelect)
      .from(usersTable)
      .leftJoin(shiftsTable, eq(usersTable.shiftId, shiftsTable.id))
      .where(eq(usersTable.id, requesterId));
    res.json(users);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/users", requireRole(["admin"]), async (req, res): Promise<void> => {
  try {
    const { email, password, firstName, lastName, role, shiftId } = req.body;
    if (!email || !password || !firstName || !lastName || !role) {
      res.status(400).json({ message: "Missing required fields" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const parsedShiftId = shiftId ? parseInt(shiftId) : null;
    const [user] = await db
      .insert(usersTable)
      .values({
        email: email.toLowerCase().trim(),
        passwordHash,
        firstName,
        lastName,
        role,
        shiftId: parsedShiftId,
        isActive: true,
      })
      .returning();

    // Keep shift_assignments in sync — used by rosters, schedule, and dashboard
    await syncShiftAssignment(user.id, parsedShiftId);

    res.status(201).json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      shiftId: user.shiftId,
      isActive: user.isActive,
    });
  } catch (err: unknown) {
    req.log.error(err);
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      res.status(409).json({ message: "Email already exists" });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const requesterId = req.session.userId!;
    const requesterRole = req.session.role ?? "";

    // Access control: deputies can only view themselves; sergeants can view their shift; admins can view anyone
    if (requesterRole === "deputy" && id !== requesterId) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    if (requesterRole === "sergeant" && id !== requesterId) {
      const shiftId = await getSergeantShiftId(requesterId);
      if (shiftId) {
        const [target] = await db
          .select({ shiftId: usersTable.shiftId })
          .from(usersTable)
          .where(eq(usersTable.id, id))
          .limit(1);
        if (target?.shiftId !== shiftId) {
          res.status(403).json({ message: "Access denied" });
          return;
        }
      } else if (id !== requesterId) {
        res.status(403).json({ message: "Access denied" });
        return;
      }
    }

    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        role: usersTable.role,
        shiftId: usersTable.shiftId,
        shiftName: shiftsTable.name,
        isActive: usersTable.isActive,
      })
      .from(usersTable)
      .leftJoin(shiftsTable, eq(usersTable.shiftId, shiftsTable.id))
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/users/:id", requireRole(["admin"]), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const { firstName, lastName, role, shiftId, isActive, password } = req.body;

    const updates: Record<string, unknown> = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (role !== undefined) updates.role = role;
    const newShiftId = shiftId !== undefined ? (shiftId || null) : undefined;
    if (newShiftId !== undefined) updates.shiftId = newShiftId;
    if (isActive !== undefined) updates.isActive = isActive;
    if (password) updates.passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, id))
      .returning();

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Keep shift_assignments in sync and notify the affected user when shiftId changes
    if (newShiftId !== undefined) {
      await syncShiftAssignment(id, newShiftId);

      if (newShiftId !== null) {
        const effectiveDate = new Date().toISOString().split("T")[0];
        const [newShift] = await db
          .select({ name: shiftsTable.name, sergeantId: shiftsTable.sergeantId })
          .from(shiftsTable)
          .where(eq(shiftsTable.id, newShiftId))
          .limit(1);

        const notificationMessage = `You have been assigned to ${newShift?.name ?? "a new shift"}, effective ${effectiveDate}.`;

        await db.insert(notificationLogsTable).values({
          recipientId: id,
          type: "shift_assigned",
          message: notificationMessage,
          isRead: false,
        });

        await sendEmail(
          user.email,
          "Shift Assignment Updated",
          `${user.firstName} ${user.lastName},\n\nYou have been assigned to ${newShift?.name ?? "a new shift"}, effective ${effectiveDate}.\n\nPlease log in to the Shift Scheduler to view your schedule.`
        );

        // Also notify the shift's sergeant (if different from the affected user)
        const requesterId = req.session.userId!;
        if (newShift?.sergeantId && newShift.sergeantId !== id && newShift.sergeantId !== requesterId) {
          await db.insert(notificationLogsTable).values({
            recipientId: newShift.sergeantId,
            type: "shift_assigned",
            message: `${user.firstName} ${user.lastName} has been assigned to your shift (${newShift.name}), effective ${effectiveDate}.`,
            isRead: false,
          });
        }
      }
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      shiftId: user.shiftId,
      isActive: user.isActive,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Soft delete — deactivate the user rather than hard-deleting
router.delete("/users/:id", requireRole(["admin"]), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);

    // Prevent self-deactivation
    if (id === req.session.userId) {
      res.status(400).json({ message: "Cannot deactivate your own account" });
      return;
    }

    const [user] = await db
      .update(usersTable)
      .set({ isActive: false })
      .where(and(eq(usersTable.id, id), eq(usersTable.isActive, true)))
      .returning();

    if (!user) {
      res.status(404).json({ message: "User not found or already deactivated" });
      return;
    }

    res.json({ message: "User deactivated", id: user.id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
