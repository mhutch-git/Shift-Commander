import { pgTable, serial, integer, timestamp, text, varchar, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dayOffRequestsTable = pgTable("day_off_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  requestedDate: date("requested_date").notNull(),
  requestType: varchar("request_type", { length: 30 }).notNull().default("pto"), // pto, training, sick_leave
  reason: text("reason").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, approved, denied
  createdById: integer("created_by_id"),
  reviewedById: integer("reviewed_by_id"),
  reviewNotes: text("review_notes"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDayOffRequestSchema = createInsertSchema(dayOffRequestsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDayOffRequest = z.infer<typeof insertDayOffRequestSchema>;
export type DayOffRequest = typeof dayOffRequestsTable.$inferSelect;
