import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Verifies the session userId exists and the account is still active in the DB.
 * Also refreshes session.role in case an admin changed it since last login.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session?.userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  try {
    const [user] = await db
      .select({ isActive: usersTable.isActive, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId))
      .limit(1);

    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Keep session role fresh so requireRole always uses current DB value
    if (req.session.role !== user.role) {
      req.session.role = user.role;
    }

    next();
  } catch {
    res.status(500).json({ message: "Internal server error" });
  }
}

export function requireRole(roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await requireAuth(req, res, async () => {
      if (!roles.includes(req.session.role ?? "")) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }
      next();
    });
  };
}
