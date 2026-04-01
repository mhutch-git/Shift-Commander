import { pgTable, serial, integer, timestamp, text, boolean, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationLogsTable = pgTable("notification_logs", {
  id: serial("id").primaryKey(),
  recipientId: integer("recipient_id").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // day_off_submitted, day_off_approved, day_off_denied, assignment_changed
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotificationLogSchema = createInsertSchema(notificationLogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertNotificationLog = z.infer<typeof insertNotificationLogSchema>;
export type NotificationLog = typeof notificationLogsTable.$inferSelect;
