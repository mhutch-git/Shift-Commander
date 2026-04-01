import { Router } from "express";
import { db, notificationLogsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.session.userId!;
    const notifications = await db
      .select()
      .from(notificationLogsTable)
      .where(eq(notificationLogsTable.recipientId, userId))
      .orderBy(desc(notificationLogsTable.createdAt))
      .limit(50);

    res.json(notifications);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH read-all MUST come before PATCH :id/read to avoid "read-all" matching as an id
router.patch("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = req.session.userId!;
    await db
      .update(notificationLogsTable)
      .set({ isRead: true })
      .where(eq(notificationLogsTable.recipientId, userId));

    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    const userId = req.session.userId!;

    const [notification] = await db
      .update(notificationLogsTable)
      .set({ isRead: true })
      .where(
        and(
          eq(notificationLogsTable.id, id),
          eq(notificationLogsTable.recipientId, userId)
        )
      )
      .returning();

    if (!notification) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }
    res.json(notification);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
