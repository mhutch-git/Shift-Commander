import { Router } from "express";
import { db, shiftsTable, shiftAssignmentsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  getWorkingShiftLetter,
  getDayName,
  formatDate,
  addDays,
} from "../lib/schedule";

const router = Router();

type ShiftSummary = {
  id: number;
  name: string;
  shiftType: string;
  shiftLetter: string;
  sergeantName: string | null;
  memberCount: number;
};

/**
 * Fetch all shifts with their sergeant name and total member count in two queries.
 * This avoids N+1 patterns when building schedule days.
 */
async function fetchShiftSummaries(): Promise<ShiftSummary[]> {
  const shifts = await db
    .select({
      id: shiftsTable.id,
      name: shiftsTable.name,
      shiftType: shiftsTable.shiftType,
      shiftLetter: shiftsTable.shiftLetter,
      sergeantName: sql<string | null>`concat(${usersTable.firstName}, ' ', ${usersTable.lastName})`,
    })
    .from(shiftsTable)
    .leftJoin(usersTable, eq(shiftsTable.sergeantId, usersTable.id))
    .orderBy(shiftsTable.id);

  // Batch member counts in a single query
  const countRows = await db
    .select({
      shiftId: shiftAssignmentsTable.shiftId,
      count: sql<number>`count(*)::int`,
    })
    .from(shiftAssignmentsTable)
    .groupBy(shiftAssignmentsTable.shiftId);

  const countMap = new Map(countRows.map((r) => [r.shiftId, r.count]));

  return shifts.map((s) => ({
    ...s,
    sergeantName: s.sergeantName?.trim() || null,
    memberCount: countMap.get(s.id) ?? 0,
  }));
}

function buildScheduleDay(date: Date, shiftSummaries: ShiftSummary[]) {
  const workingLetter = getWorkingShiftLetter(date);
  const dayOfWeek = date.getUTCDay();

  const shiftsForDay = shiftSummaries.map((shift) => ({
    id: shift.id,
    name: shift.name,
    shiftType: shift.shiftType,
    shiftLetter: shift.shiftLetter,
    isWorking: shift.shiftLetter === workingLetter,
    memberCount: shift.shiftLetter === workingLetter ? shift.memberCount : 0,
    sergeantName: shift.sergeantName,
  }));

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

    const clampedEnd = endDate > addDays(startDate, MAX_SCHEDULE_DAYS - 1)
      ? addDays(startDate, MAX_SCHEDULE_DAYS - 1)
      : endDate;

    // Fetch shift data once, then reuse across all days
    const shiftSummaries = await fetchShiftSummaries();

    const days = [];
    let current = startDate;
    while (current <= clampedEnd) {
      days.push(buildScheduleDay(current, shiftSummaries));
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

    const shiftSummaries = await fetchShiftSummaries();

    const workingShifts = shiftSummaries
      .filter((s) => s.shiftLetter === workingLetter)
      .map((s) => ({ ...s, isWorking: true }));

    const offShifts = shiftSummaries
      .filter((s) => s.shiftLetter !== workingLetter)
      .map((s) => ({ ...s, memberCount: 0, isWorking: false }));

    res.json({
      date: formatDate(today),
      dayOfWeek: getDayName(today.getUTCDay()),
      workingShiftLetter: workingLetter,
      workingShifts,
      offShifts,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
