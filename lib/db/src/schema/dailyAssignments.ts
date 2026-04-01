import { pgTable, serial, integer, timestamp, text, varchar, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyAssignmentsTable = pgTable("daily_assignments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  assignedDate: date("assigned_date").notNull(),
  shiftType: varchar("shift_type", { length: 10 }).notNull(), // 'day' | 'night'
  notes: text("notes"),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDailyAssignmentSchema = createInsertSchema(dailyAssignmentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDailyAssignment = z.infer<typeof insertDailyAssignmentSchema>;
export type DailyAssignment = typeof dailyAssignmentsTable.$inferSelect;
