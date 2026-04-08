import { pgTable, serial, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shiftAssignmentsTable = pgTable("shift_assignments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  shiftId: integer("shift_id").notNull(),
  effectiveDate: date("effective_date").notNull().$default(() => new Date().toISOString().split("T")[0]!),
  endDate: date("end_date"),  // null = currently active; set to yesterday when removed
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertShiftAssignmentSchema = createInsertSchema(shiftAssignmentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertShiftAssignment = z.infer<typeof insertShiftAssignmentSchema>;
export type ShiftAssignment = typeof shiftAssignmentsTable.$inferSelect;
