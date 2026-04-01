import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shiftAssignmentsTable = pgTable("shift_assignments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  shiftId: integer("shift_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertShiftAssignmentSchema = createInsertSchema(shiftAssignmentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertShiftAssignment = z.infer<typeof insertShiftAssignmentSchema>;
export type ShiftAssignment = typeof shiftAssignmentsTable.$inferSelect;
