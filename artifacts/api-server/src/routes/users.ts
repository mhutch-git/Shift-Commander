import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, shiftsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/users", requireAuth, async (req, res): Promise<void> => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        role: usersTable.role,
        shiftId: usersTable.shiftId,
        shiftName: shiftsTable.name,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .leftJoin(shiftsTable, eq(usersTable.shiftId, shiftsTable.id))
      .orderBy(desc(usersTable.createdAt));

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
    const [user] = await db
      .insert(usersTable)
      .values({
        email: email.toLowerCase().trim(),
        passwordHash,
        firstName,
        lastName,
        role,
        shiftId: shiftId || null,
        isActive: true,
      })
      .returning();

    res.status(201).json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      shiftId: user.shiftId,
      isActive: user.isActive,
    });
  } catch (err: any) {
    req.log.error(err);
    if (err.code === "23505") {
      res.status(409).json({ message: "Email already exists" });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
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
    if (shiftId !== undefined) updates.shiftId = shiftId || null;
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

router.delete("/users/:id", requireRole(["admin"]), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ message: "User deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
