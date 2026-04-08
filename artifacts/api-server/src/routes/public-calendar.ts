import { Router, type Request, type Response, type NextFunction } from "express";
import { db, shiftsTable, shiftAssignmentsTable, usersTable, dayOffRequestsTable, dailyAssignmentsTable } from "@workspace/db";
import { eq, and, lte, or, isNull, sql, gte } from "drizzle-orm";
import { getWorkingShiftLetter, getDayName, formatDate, addDays } from "../lib/schedule";

const router = Router();

// ── Token middleware ──────────────────────────────────────────────────────────
// Uses timing-safe comparison to prevent timing attacks on the token.
function requireCalendarToken(req: Request, res: Response, next: NextFunction): void {
  const token = process.env.PUBLIC_CALENDAR_TOKEN;
  if (!token) {
    res.status(503).json({ message: "Public calendar is not configured" });
    return;
  }
  const provided = String(req.query.token ?? "");
  if (provided.length !== token.length) {
    res.status(401).json({ message: "Invalid token" });
    return;
  }
  // Timing-safe byte comparison
  const a = Buffer.from(provided);
  const b = Buffer.from(token);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  if (diff !== 0) {
    res.status(401).json({ message: "Invalid token" });
    return;
  }
  next();
}

// ── Shared schedule helpers (mirrors schedule.ts) ─────────────────────────────
type MemberRow = {
  shiftId: number;
  userId: number;
  role: string;
  firstName: string | null;
  lastName: string | null;
  effectiveDate: string;
  endDate: string | null;
};

type ShiftRow = {
  id: number;
  name: string;
  shiftType: string;
  shiftLetter: string;
  sergeantId: number | null;
  sergeantFirstName: string | null;
  sergeantLastName: string | null;
};

async function fetchShiftData(rangeStart: string, rangeEnd: string) {
  const shifts = await db
    .select({
      id: shiftsTable.id,
      name: shiftsTable.name,
      shiftType: shiftsTable.shiftType,
      shiftLetter: shiftsTable.shiftLetter,
      sergeantId: shiftsTable.sergeantId,
      sergeantFirstName: usersTable.firstName,
      sergeantLastName: usersTable.lastName,
    })
    .from(shiftsTable)
    .leftJoin(usersTable, eq(shiftsTable.sergeantId, usersTable.id))
    .orderBy(shiftsTable.id);

  const memberRows: MemberRow[] = await db
    .select({
      shiftId: shiftAssignmentsTable.shiftId,
      userId: usersTable.id,
      role: usersTable.role,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      effectiveDate: shiftAssignmentsTable.effectiveDate,
      endDate: shiftAssignmentsTable.endDate,
    })
    .from(shiftAssignmentsTable)
    .innerJoin(usersTable, eq(shiftAssignmentsTable.userId, usersTable.id))
    .where(
      and(
        lte(shiftAssignmentsTable.effectiveDate, rangeEnd),
        or(isNull(shiftAssignmentsTable.endDate), sql`${shiftAssignmentsTable.endDate} >= ${rangeStart}`)
      )
    )
    .orderBy(usersTable.lastName);

  return { shifts, memberRows };
}

function buildScheduleDay(date: Date, shifts: ShiftRow[], memberRows: MemberRow[]) {
  const dateStr = formatDate(date);
  const workingLetter = getWorkingShiftLetter(date);
  const dayOfWeek = date.getUTCDay();

  const activeMemberRows = memberRows.filter(
    (r) => r.effectiveDate <= dateStr && (r.endDate === null || r.endDate >= dateStr)
  );

  const membersMap = new Map<number, string[]>();
  for (const row of activeMemberRows) {
    if (!membersMap.has(row.shiftId)) membersMap.set(row.shiftId, []);
    const initial = row.firstName ? row.firstName.charAt(0).toUpperCase() + "." : "";
    const displayName = initial ? `${initial} ${row.lastName ?? ""}` : (row.lastName ?? "");
    if (row.role === "sergeant") {
      membersMap.get(row.shiftId)!.unshift(displayName);
    } else {
      membersMap.get(row.shiftId)!.push(displayName);
    }
  }

  const shiftsForDay = shifts.map((s) => {
    const sgtInitial = s.sergeantFirstName ? s.sergeantFirstName.charAt(0).toUpperCase() + "." : "";
    const sergeantName = s.sergeantLastName
      ? (sgtInitial ? `${sgtInitial} ${s.sergeantLastName}` : s.sergeantLastName)
      : null;
    const names = membersMap.get(s.id) ?? [];
    const isWorking = s.shiftLetter === workingLetter;
    return {
      id: s.id,
      name: s.name,
      shiftType: s.shiftType,
      shiftLetter: s.shiftLetter,
      isWorking,
      memberCount: isWorking ? names.length : 0,
      memberNames: isWorking ? names : [],
      sergeantName,
    };
  });

  return {
    date: dateStr,
    dayOfWeek: getDayName(dayOfWeek),
    workingShiftLetter: workingLetter,
    shifts: shiftsForDay,
  };
}

const MAX_SCHEDULE_DAYS = 62;

// GET /api/public/schedule?token=xxx&start=YYYY-MM-DD&end=YYYY-MM-DD
router.get("/public/schedule", requireCalendarToken, async (req, res): Promise<void> => {
  try {
    const { start, end } = req.query;
    const startDate = start ? new Date(`${start}T00:00:00.000Z`) : new Date();
    const endDate = end ? new Date(`${end}T00:00:00.000Z`) : addDays(startDate, 27);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      res.status(400).json({ message: "Invalid start or end date" });
      return;
    }

    const clampedEnd = endDate > addDays(startDate, MAX_SCHEDULE_DAYS - 1)
      ? addDays(startDate, MAX_SCHEDULE_DAYS - 1)
      : endDate;

    const { shifts, memberRows } = await fetchShiftData(formatDate(startDate), formatDate(clampedEnd));

    const days = [];
    let current = startDate;
    while (current <= clampedEnd) {
      days.push(buildScheduleDay(current, shifts, memberRows));
      current = addDays(current, 1);
    }

    res.json(days);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/public/day-off-requests?token=xxx&start=YYYY-MM-DD&end=YYYY-MM-DD
router.get("/public/day-off-requests", requireCalendarToken, async (req, res): Promise<void> => {
  try {
    const { start, end } = req.query;

    const conditions = [eq(dayOffRequestsTable.status, "approved")];
    if (start) conditions.push(gte(dayOffRequestsTable.requestedDate, start as string));
    if (end) conditions.push(lte(dayOffRequestsTable.requestedDate, end as string));

    const rows = await db
      .select({
        id: dayOffRequestsTable.id,
        requestedDate: dayOffRequestsTable.requestedDate,
        isPartialDay: dayOffRequestsTable.isPartialDay,
        partialStartTime: dayOffRequestsTable.partialStartTime,
        partialEndTime: dayOffRequestsTable.partialEndTime,
        requesterFirstName: usersTable.firstName,
        requesterLastName: usersTable.lastName,
      })
      .from(dayOffRequestsTable)
      .innerJoin(usersTable, eq(dayOffRequestsTable.userId, usersTable.id))
      .where(and(...conditions));

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/public/daily-assignments?token=xxx&start=YYYY-MM-DD&end=YYYY-MM-DD
router.get("/public/daily-assignments", requireCalendarToken, async (req, res): Promise<void> => {
  try {
    const { start, end } = req.query;

    const conditions = [];
    if (start) conditions.push(gte(dailyAssignmentsTable.assignedDate, start as string));
    if (end) conditions.push(lte(dailyAssignmentsTable.assignedDate, end as string));

    const rows = await db
      .select({
        id: dailyAssignmentsTable.id,
        assignedDate: dailyAssignmentsTable.assignedDate,
        shiftType: dailyAssignmentsTable.shiftType,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      })
      .from(dailyAssignmentsTable)
      .innerJoin(usersTable, eq(dailyAssignmentsTable.userId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
