import { pgTable, text, serial, timestamp, integer, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shiftsTable = pgTable("shifts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  shiftType: varchar("shift_type", { length: 10 }).notNull(), // day, night
  shiftLetter: varchar("shift_letter", { length: 1 }).notNull(), // a, b
  sergeantId: integer("sergeant_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertShiftSchema = createInsertSchema(shiftsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shiftsTable.$inferSelect;
