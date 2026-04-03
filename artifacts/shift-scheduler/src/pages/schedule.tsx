import { useState, useMemo } from "react";
import {
  useGetSchedule, getGetScheduleQueryKey, type ScheduleDay, type ScheduleShift,
  useListDayOffRequests,
  useListDailyAssignments,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChevronLeft, ChevronRight, Sun, Moon, Clock3, CalendarDays, CalendarRange } from "lucide-react";

// ── Partial-day helpers ──────────────────────────────────────────────────────

function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${displayH}${period}` : `${displayH}:${m.toString().padStart(2, "0")}${period}`;
}

function getWorkingHours(shiftType: "day" | "night", offStart: string, offEnd: string): string {
  const segments: string[] = [];
  if (shiftType === "day") {
    if (offStart > "05:00") segments.push(`${fmtTime("05:00")}–${fmtTime(offStart)}`);
    if (offEnd < "17:00") segments.push(`${fmtTime(offEnd)}–${fmtTime("17:00")}`);
  } else {
    const ord = (t: string) => { const h = parseInt(t); return h >= 17 ? h - 17 : h + 7; };
    if (ord(offStart) > 0) segments.push(`${fmtTime("17:00")}–${fmtTime(offStart)}`);
    if (ord(offEnd) < 12) segments.push(`${fmtTime(offEnd)}–${fmtTime("05:00")}`);
  }
  return segments.length > 0 ? segments.join(" & ") : "—";
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function getMonthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    start: start.toISOString().split("T")[0]!,
    end: end.toISOString().split("T")[0]!,
  };
}

// For Date objects created with Date.UTC (calendar/schedule dates) — use UTC getters
function toDateStr(d: Date) {
  return d.toISOString().split("T")[0]!;
}

// For local wall-clock dates (today, viewDate) — use local getters
function localDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDaysInMonth(year: number, month: number) {
  const days: Date[] = [];
  const date = new Date(Date.UTC(year, month, 1));
  while (date.getUTCMonth() === month) {
    days.push(new Date(date));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return days;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function isMobile() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

// ── Types ────────────────────────────────────────────────────────────────────

type DayOffInfo = {
  isPartialDay: boolean;
  partialStartTime?: string | null;
  partialEndTime?: string | null;
};

type ViewMode = "month" | "5days";

// ── Shared day-detail sheet ───────────────────────────────────────────────────

function DaySheet({
  selectedDay,
  onClose,
  dayOffMap,
  dailyMap,
}: {
  selectedDay: ScheduleDay | null;
  onClose: () => void;
  dayOffMap: Record<string, Record<string, DayOffInfo>>;
  dailyMap: Record<string, { day: { id: number; name: string }[]; night: { id: number; name: string }[] }>;
}) {
  return (
    <Sheet open={!!selectedDay} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {selectedDay && (
          <>
            <SheetHeader>
              <SheetTitle>
                {new Date(selectedDay.date + "T00:00:00Z").toLocaleDateString("en-US", {
                  weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC"
                })}
              </SheetTitle>
              {selectedDay.workingShiftLetter && (
                <p className="text-sm text-muted-foreground">
                  Shift {selectedDay.workingShiftLetter?.toUpperCase()} on duty
                </p>
              )}
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {[
                { icon: Sun, label: "Day Shift", type: "day", color: "text-amber-600" },
                { icon: Moon, label: "Night Shift", type: "night", color: "text-primary" },
              ].map(({ icon: Icon, label, type, color }) => {
                const shift = selectedDay.shifts?.find((s: ScheduleShift) => s.shiftType === type && s.isWorking)
                  ?? selectedDay.shifts?.find((s: ScheduleShift) => s.shiftType === type);
                const dayOffForDay = dayOffMap[selectedDay.date] ?? {};
                const additionalForType = dailyMap[selectedDay.date]?.[type as "day" | "night"] ?? [];

                if (!shift && additionalForType.length === 0) return null;

                const offCount = (shift?.memberNames ?? []).filter((n) => {
                  const i = dayOffForDay[n];
                  return !!i && !i.isPartialDay;
                }).length;
                const effectiveCount = ((shift?.memberCount ?? 0) - offCount) + additionalForType.length;
                return (
                  <div
                    key={type}
                    className={`p-4 rounded-md border ${shift?.isWorking || additionalForType.length > 0 ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border opacity-60"}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <p className="font-semibold text-sm text-foreground">{label}</p>
                      {shift?.isWorking || additionalForType.length > 0 ? (
                        <span className="ml-auto text-xs font-medium text-primary">{effectiveCount} on duty</span>
                      ) : (
                        <span className="ml-auto text-xs text-muted-foreground">Off duty</span>
                      )}
                    </div>
                    {shift?.isWorking && shift.memberNames && shift.memberNames.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                        {shift.memberNames.map((name: string) => {
                          const offInfo = dayOffForDay[name];
                          const isFullOff = !!offInfo && !offInfo.isPartialDay;
                          const isPartial = !!offInfo?.isPartialDay;
                          const isSgt = name === shift.sergeantName;
                          const workingHours = isPartial && offInfo?.partialStartTime && offInfo?.partialEndTime
                            ? getWorkingHours(type as "day" | "night", offInfo.partialStartTime, offInfo.partialEndTime)
                            : null;
                          return (
                            <div key={name} className="flex flex-col gap-0">
                              <span
                                className={`text-sm ${
                                  isFullOff ? "text-red-600 line-through"
                                  : isPartial ? "text-amber-700 font-medium"
                                  : isSgt ? "font-bold text-foreground"
                                  : "text-foreground"
                                }`}
                              >
                                {name}
                              </span>
                              {isPartial && workingHours && (
                                <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                                  <Clock3 className="w-2.5 h-2.5" />
                                  {workingHours}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {offCount > 0 && shift?.isWorking && (
                      <p className="text-xs text-red-500 mt-2">{offCount} on approved day off</p>
                    )}
                    {additionalForType.length > 0 && (
                      <div className={`${shift?.isWorking && shift.memberNames?.length ? "mt-3 pt-3 border-t border-border/50" : "mt-1"}`}>
                        <p className="text-xs font-semibold text-green-700 mb-1.5">Additional Personnel</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {additionalForType.map((a) => (
                            <span key={a.id} className="text-sm text-green-700">{a.name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 mb-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5"><Sun className="w-3 h-3 text-amber-500" /><span>Day</span></div>
      <div className="flex items-center gap-1.5"><Moon className="w-3 h-3 text-primary" /><span>Night</span></div>
      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-primary/20 border border-primary/40" /><span>Shift A</span></div>
      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-accent/20 border border-accent/40" /><span>Shift B</span></div>
      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-100 border border-red-300" /><span className="text-red-600">Day Off</span></div>
      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300" /><span className="text-amber-700">Partial</span></div>
      <div className="flex items-center gap-1.5"><span className="text-green-700 font-bold">+</span><span className="text-green-700">Additional</span></div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => isMobile() ? "5days" : "month");
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<ScheduleDay | null>(null);

  const today = localDateStr(new Date());

  // Date range for current view
  const { start, end } = useMemo(() => {
    if (viewMode === "month") {
      return getMonthBounds(viewDate.getFullYear(), viewDate.getMonth());
    } else {
      // 5-day window — anchor on local today to avoid UTC offset shifting the day
      const s = localDateStr(viewDate);
      const anchor = new Date(s + "T00:00:00Z");
      return { start: s, end: toDateStr(addDays(anchor, 4)) };
    }
  }, [viewMode, viewDate]);

  const schedule = useGetSchedule(
    { start, end },
    { query: { queryKey: getGetScheduleQueryKey({ start, end }) } }
  );

  const approvedRequests = useListDayOffRequests({ status: "approved" });
  const dailyAssignmentsQuery = useListDailyAssignments({ start, end });

  // date -> name -> DayOffInfo
  const dayOffMap = useMemo(() => {
    const map: Record<string, Record<string, DayOffInfo>> = {};
    for (const req of approvedRequests.data ?? []) {
      const date = req.requestedDate;
      if (date < start || date > end) continue;
      if (!map[date]) map[date] = {};
      const initial = req.requesterFirstName ? req.requesterFirstName.charAt(0).toUpperCase() + "." : "";
      const displayName = initial ? `${initial} ${req.requesterLastName}` : req.requesterLastName;
      if (displayName) map[date][displayName] = {
        isPartialDay: req.isPartialDay ?? false,
        partialStartTime: req.partialStartTime,
        partialEndTime: req.partialEndTime,
      };
    }
    return map;
  }, [approvedRequests.data, start, end]);

  // date -> { day: [...], night: [...] }
  const dailyMap = useMemo(() => {
    const map: Record<string, { day: { id: number; name: string }[]; night: { id: number; name: string }[] }> = {};
    for (const a of dailyAssignmentsQuery.data ?? []) {
      if (!map[a.assignedDate]) map[a.assignedDate] = { day: [], night: [] };
      const initial = a.firstName ? a.firstName.charAt(0).toUpperCase() + "." : "";
      const name = initial ? `${initial} ${a.lastName}` : a.lastName;
      map[a.assignedDate]![a.shiftType as "day" | "night"].push({ id: a.id, name });
    }
    return map;
  }, [dailyAssignmentsQuery.data]);

  const scheduleMap: Record<string, ScheduleDay> = {};
  schedule.data?.forEach((day) => { scheduleMap[day.date] = day; });

  // Navigation
  const prev = () => {
    if (viewMode === "month") setViewDate(d => addMonths(d, -1));
    else setViewDate(d => addDays(d, -5));
  };
  const next = () => {
    if (viewMode === "month") setViewDate(d => addMonths(d, 1));
    else setViewDate(d => addDays(d, 5));
  };

  // Title
  const title = viewMode === "month"
    ? `${MONTH_NAMES[viewDate.getMonth()]} ${viewDate.getFullYear()}`
    : `${start} – ${end}`;

  // Days to render — anchor to the start date string to avoid local/UTC mismatch
  const fiveDays = useMemo(() => {
    if (viewMode !== "5days") return [];
    const anchor = new Date(start + "T00:00:00Z");
    return Array.from({ length: 5 }, (_, i) => toDateStr(addDays(anchor, i)));
  }, [viewMode, start]);

  const monthDays = viewMode === "month" ? getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth()) : [];
  const firstDayOfWeek = monthDays[0]?.getUTCDay() ?? 0;

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Schedule</h1>
          {/* View toggle */}
          <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/40">
            <button
              onClick={() => setViewMode("5days")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === "5days" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarRange className="w-4 h-4" />
              5 Days
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === "month" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              Month
            </button>
          </div>
        </div>

        <Card className="border-card-border">
          <CardHeader className="pb-3 flex-row items-center justify-between flex">
            <Button variant="outline" size="icon" onClick={prev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            <Button variant="outline" size="icon" onClick={next}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardHeader>

          <CardContent className="px-2 pb-4 md:px-4">
            <Legend />

            {/* ── Month view ── */}
            {viewMode === "month" && (
              <>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DAY_NAMES.map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                {schedule.isLoading ? (
                  <div className="grid grid-cols-7 gap-1">
                    {Array(35).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-1">
                    {Array(firstDayOfWeek).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
                    {monthDays.map((d) => {
                      const key = toDateStr(d);
                      const info = scheduleMap[key];
                      const letter = info?.workingShiftLetter;
                      const isToday = key === today;
                      const dayOffForKey = dayOffMap[key] ?? {};
                      const dayShift = info?.shifts?.find((s: ScheduleShift) => s.shiftType === "day" && s.isWorking);
                      const nightShift = info?.shifts?.find((s: ScheduleShift) => s.shiftType === "night" && s.isWorking);
                      const dayNames = dayShift?.memberNames ?? [];
                      const nightNames = nightShift?.memberNames ?? [];
                      const daySgtName = dayShift?.sergeantName ?? null;
                      const nightSgtName = nightShift?.sergeantName ?? null;
                      const dailyDay = dailyMap[key]?.day ?? [];
                      const dailyNight = dailyMap[key]?.night ?? [];

                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedDay(info || { date: key })}
                          data-testid={`day-cell-${key}`}
                          className={`relative flex flex-col items-start p-1.5 rounded-md border text-left transition-colors focus:outline-none min-h-[110px]
                            ${letter === "a" ? "bg-primary/10 border-primary/30 hover:bg-primary/20" : ""}
                            ${letter === "b" ? "bg-accent/10 border-accent/30 hover:bg-accent/20" : ""}
                            ${!letter ? "bg-muted/30 border-border hover:bg-muted/50" : ""}
                            ${isToday ? "ring-2 ring-primary ring-offset-1" : ""}
                          `}
                        >
                          <span className={`text-xs font-bold leading-none mb-1 ${isToday ? "text-primary" : "text-foreground"}`}>
                            {d.getUTCDate()}
                            {letter && (
                              <span className={`ml-1 text-[9px] font-bold uppercase ${letter === "a" ? "text-primary" : "text-amber-700"}`}>
                                {letter.toUpperCase()}
                              </span>
                            )}
                          </span>
                          <div className="flex w-full gap-0.5 flex-1">
                            <div className="flex-1 min-w-0 border-r border-border/40 pr-0.5">
                              <Sun className="w-2 h-2 text-amber-500 mb-0.5" />
                              <div className="flex flex-col gap-0 leading-tight">
                                {dayNames.map((name) => {
                                  const off = dayOffForKey[name];
                                  const isFullOff = !!off && !off.isPartialDay;
                                  const isPartial = !!off?.isPartialDay;
                                  const isSgt = name === daySgtName;
                                  return (
                                    <span key={name} className={`text-[9px] truncate ${
                                      isFullOff ? "text-red-600 line-through font-medium"
                                      : isPartial ? "text-amber-700 font-medium"
                                      : isSgt ? "text-foreground font-bold"
                                      : "text-foreground/80 font-medium"
                                    }`}>{name}</span>
                                  );
                                })}
                                {dailyDay.map((a) => (
                                  <span key={`da-${a.id}`} className="text-[9px] truncate text-green-700 font-medium">+{a.name}</span>
                                ))}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 pl-0.5">
                              <Moon className="w-2 h-2 text-primary mb-0.5" />
                              <div className="flex flex-col gap-0 leading-tight">
                                {nightNames.map((name) => {
                                  const off = dayOffForKey[name];
                                  const isFullOff = !!off && !off.isPartialDay;
                                  const isPartial = !!off?.isPartialDay;
                                  const isSgt = name === nightSgtName;
                                  return (
                                    <span key={name} className={`text-[9px] truncate ${
                                      isFullOff ? "text-red-600 line-through font-medium"
                                      : isPartial ? "text-amber-700 font-medium"
                                      : isSgt ? "text-foreground font-bold"
                                      : "text-foreground/80 font-medium"
                                    }`}>{name}</span>
                                  );
                                })}
                                {dailyNight.map((a) => (
                                  <span key={`na-${a.id}`} className="text-[9px] truncate text-green-700 font-medium">+{a.name}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── 5-Day view ── */}
            {viewMode === "5days" && (
              schedule.isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-64 rounded" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {fiveDays.map((key) => {
                    const d = new Date(key + "T00:00:00Z");
                    const info = scheduleMap[key];
                    const letter = info?.workingShiftLetter;
                    const isToday = key === today;
                    const dayOffForKey = dayOffMap[key] ?? {};
                    const dayShift = info?.shifts?.find((s: ScheduleShift) => s.shiftType === "day" && s.isWorking);
                    const nightShift = info?.shifts?.find((s: ScheduleShift) => s.shiftType === "night" && s.isWorking);
                    const dayNames = dayShift?.memberNames ?? [];
                    const nightNames = nightShift?.memberNames ?? [];
                    const daySgtName = dayShift?.sergeantName ?? null;
                    const nightSgtName = nightShift?.sergeantName ?? null;
                    const dailyDay = dailyMap[key]?.day ?? [];
                    const dailyNight = dailyMap[key]?.night ?? [];

                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedDay(info || { date: key })}
                        data-testid={`day-cell-${key}`}
                        className={`flex flex-col items-start p-2 rounded-md border text-left transition-colors focus:outline-none min-h-[180px] w-full
                          ${letter === "a" ? "bg-primary/10 border-primary/30 hover:bg-primary/20" : ""}
                          ${letter === "b" ? "bg-accent/10 border-accent/30 hover:bg-accent/20" : ""}
                          ${!letter ? "bg-muted/30 border-border hover:bg-muted/50" : ""}
                          ${isToday ? "ring-2 ring-primary ring-offset-1" : ""}
                        `}
                      >
                        {/* Header */}
                        <div className="w-full mb-2">
                          <div className={`text-xs font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                            {DAY_NAMES_FULL[d.getUTCDay()]}
                          </div>
                          <div className={`text-lg font-bold leading-none ${isToday ? "text-primary" : "text-foreground"}`}>
                            {d.getUTCDate()}
                            {letter && (
                              <span className={`ml-1 text-xs font-bold uppercase ${letter === "a" ? "text-primary" : "text-amber-700"}`}>
                                {letter.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Day / Night — always side by side */}
                        <div className="flex w-full gap-0.5 flex-1">
                          {/* Day — left */}
                          <div className="flex-1 min-w-0 border-r border-border/40 pr-1">
                            <div className="flex items-center gap-0.5 mb-0.5">
                              <Sun className="w-3 h-3 text-amber-500 flex-shrink-0" />
                              <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Day</span>
                            </div>
                            <div className="flex flex-col gap-0 leading-snug">
                              {dayNames.map((name) => {
                                const off = dayOffForKey[name];
                                const isFullOff = !!off && !off.isPartialDay;
                                const isPartial = !!off?.isPartialDay;
                                const isSgt = name === daySgtName;
                                return (
                                  <span key={name} className={`text-[10px] truncate ${
                                    isFullOff ? "text-red-600 line-through"
                                    : isPartial ? "text-amber-700 font-medium"
                                    : isSgt ? "text-foreground font-bold"
                                    : "text-foreground/80"
                                  }`}>{name}</span>
                                );
                              })}
                              {dailyDay.map((a) => (
                                <span key={`da-${a.id}`} className="text-[10px] truncate text-green-700">+{a.name}</span>
                              ))}
                              {dayNames.length === 0 && dailyDay.length === 0 && (
                                <span className="text-[10px] text-muted-foreground/50 italic">Off</span>
                              )}
                            </div>
                          </div>
                          {/* Night — right */}
                          <div className="flex-1 min-w-0 pl-1">
                            <div className="flex items-center gap-0.5 mb-0.5">
                              <Moon className="w-3 h-3 text-primary flex-shrink-0" />
                              <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">Night</span>
                            </div>
                            <div className="flex flex-col gap-0 leading-snug">
                              {nightNames.map((name) => {
                                const off = dayOffForKey[name];
                                const isFullOff = !!off && !off.isPartialDay;
                                const isPartial = !!off?.isPartialDay;
                                const isSgt = name === nightSgtName;
                                return (
                                  <span key={name} className={`text-[10px] truncate ${
                                    isFullOff ? "text-red-600 line-through"
                                    : isPartial ? "text-amber-700 font-medium"
                                    : isSgt ? "text-foreground font-bold"
                                    : "text-foreground/80"
                                  }`}>{name}</span>
                                );
                              })}
                              {dailyNight.map((a) => (
                                <span key={`na-${a.id}`} className="text-[10px] truncate text-green-700">+{a.name}</span>
                              ))}
                              {nightNames.length === 0 && dailyNight.length === 0 && (
                                <span className="text-[10px] text-muted-foreground/50 italic">Off</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </CardContent>
        </Card>

        <DaySheet
          selectedDay={selectedDay}
          onClose={() => setSelectedDay(null)}
          dayOffMap={dayOffMap}
          dailyMap={dailyMap}
        />
      </div>
    </AppLayout>
  );
}
