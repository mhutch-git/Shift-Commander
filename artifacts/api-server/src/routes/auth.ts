import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ message: "Email and password required" });
      return;
    }
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user || !user.isActive) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.shiftId = user.shiftId;

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

router.post("/auth/logout", (req, res): void => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ message: "Failed to logout" });
      return;
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out" });
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session?.userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId))
      .limit(1);

    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Get shift name if assigned
    let shiftName: string | null = null;
    if (user.shiftId) {
      const { shiftsTable } = await import("@workspace/db");
      const [shift] = await db
        .select({ name: shiftsTable.name })
        .from(shiftsTable)
        .where(eq(shiftsTable.id, user.shiftId))
        .limit(1);
      shiftName = shift?.name ?? null;
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      shiftId: user.shiftId,
      shiftName,
      isActive: user.isActive,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
