import { Router } from "express";
import { db, shiftsTable, shiftAssignmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  getWorkingShiftLetter,
  getDayName,
  formatDate,
  addDays,
} from "../lib/schedule";

const router = Router();

async function buildScheduleDay(date: Date) {
  const workingLetter = getWorkingShiftLetter(date);
  const dayOfWeek = date.getUTCDay();

  const shifts = await db.select().from(shiftsTable).orderBy(shiftsTable.id);

  const shiftsForDay = await Promise.all(
    shifts.map(async (shift) => {
      const isWorking = shift.shiftLetter === workingLetter;
      const memberCount = isWorking
        ? (
            await db
              .select()
              .from(shiftAssignmentsTable)
              .where(eq(shiftAssignmentsTable.shiftId, shift.id))
          ).length
        : 0;

      return {
        id: shift.id,
        name: shift.name,
        shiftType: shift.shiftType,
        shiftLetter: shift.shiftLetter,
        isWorking,
        memberCount,
        sergeantId: shift.sergeantId,
      };
    })
  );

  return {
    date: formatDate(date),
    dayOfWeek: getDayName(dayOfWeek),
    workingShiftLetter: workingLetter,
    shifts: shiftsForDay,
  };
}

const MAX_SCHEDULE_DAYS = 62;

router.get("/schedule", requireAuth, async (req, res): Promise<void> => {
  try {
    const { start, end } = req.query;

    const startDate = start
      ? new Date(`${start}T00:00:00.000Z`)
      : new Date();
    const endDate = end
      ? new Date(`${end}T00:00:00.000Z`)
      : addDays(startDate, 27);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      res.status(400).json({ message: "Invalid start or end date" });
      return;
    }
    if (endDate < startDate) {
      res.status(400).json({ message: "end must be on or after start" });
      return;
    }

    // Clamp range to avoid unbounded per-day DB calls
    const clampedEnd = endDate > addDays(startDate, MAX_SCHEDULE_DAYS - 1)
      ? addDays(startDate, MAX_SCHEDULE_DAYS - 1)
      : endDate;

    const days = [];
    let current = startDate;
    while (current <= clampedEnd) {
      days.push(await buildScheduleDay(current));
      current = addDays(current, 1);
    }

    res.json(days);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/schedule/today", requireAuth, async (req, res): Promise<void> => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const workingLetter = getWorkingShiftLetter(today);

    const shifts = await db.select().from(shiftsTable).orderBy(shiftsTable.id);

    const workingShifts = shifts.filter((s) => s.shiftLetter === workingLetter);
    const offShifts = shifts.filter((s) => s.shiftLetter !== workingLetter);

    const workingWithMembers = await Promise.all(
      workingShifts.map(async (shift) => {
        const members = await db
          .select()
          .from(shiftAssignmentsTable)
          .where(eq(shiftAssignmentsTable.shiftId, shift.id));
        return { ...shift, memberCount: members.length };
      })
    );

    res.json({
      date: formatDate(today),
      dayOfWeek: getDayName(today.getUTCDay()),
      workingShiftLetter: workingLetter,
      workingShifts: workingWithMembers,
      offShifts: offShifts.map((s) => ({ ...s, memberCount: 0 })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
