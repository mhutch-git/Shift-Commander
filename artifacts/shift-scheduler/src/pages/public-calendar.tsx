import { useState, useMemo, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChevronLeft, ChevronRight, Sun, Moon, Clock3, Shield } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ScheduleShift = {
  id: number;
  name: string;
  shiftType: string;
  shiftLetter: string;
  isWorking: boolean;
  memberCount: number;
  memberNames: string[];
  sergeantName: string | null;
};

type ScheduleDay = {
  date: string;
  dayOfWeek: string;
  workingShiftLetter: string | null;
  shifts: ScheduleShift[];
};

type DayOffRow = {
  id: number;
  requestedDate: string;
  isPartialDay: boolean | null;
  partialStartTime: string | null;
  partialEndTime: string | null;
  requesterFirstName: string | null;
  requesterLastName: string | null;
};

type DailyRow = {
  id: number;
  assignedDate: string;
  shiftType: string;
  firstName: string | null;
  lastName: string | null;
};

type PublicScheduleResponse = {
  days: ScheduleDay[];
  dayOffRequests: DayOffRow[];
  dailyAssignments: DailyRow[];
};

type DayOffInfo = {
  isPartialDay: boolean;
  partialStartTime?: string | null;
  partialEndTime?: string | null;
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0]!;
}

function localDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = (h ?? 0) >= 12 ? "pm" : "am";
  const displayH = (h ?? 0) === 0 ? 12 : (h ?? 0) > 12 ? (h ?? 0) - 12 : (h ?? 0);
  return (m ?? 0) === 0 ? `${displayH}${period}` : `${displayH}:${(m ?? 0).toString().padStart(2, "0")}${period}`;
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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── API fetcher ───────────────────────────────────────────────────────────────

async function publicFetch<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ token, ...params }).toString();
  const res = await fetch(`/api/public/${path}?${qs}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

// ── Day detail sheet ──────────────────────────────────────────────────────────

function DaySheet({
  selectedDay, onClose, dayOffMap, dailyMap,
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
                  weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
                })}
              </SheetTitle>
              {selectedDay.workingShiftLetter && (
                <p className="text-sm text-muted-foreground">
                  Shift {selectedDay.workingShiftLetter.toUpperCase()} on duty
                </p>
              )}
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {[
                { icon: Sun, label: "Day Shift", type: "day", color: "text-amber-600" },
                { icon: Moon, label: "Night Shift", type: "night", color: "text-primary" },
              ].map(({ icon: Icon, label, type, color }) => {
                const shift = selectedDay.shifts?.find((s) => s.shiftType === type && s.isWorking)
                  ?? selectedDay.shifts?.find((s) => s.shiftType === type);
                const dayOffForDay = dayOffMap[selectedDay.date] ?? {};
                const additionalForType = dailyMap[selectedDay.date]?.[type as "day" | "night"] ?? [];
                if (!shift && additionalForType.length === 0) return null;
                const offCount = (shift?.memberNames ?? []).filter((n) => {
                  const i = dayOffForDay[n];
                  return !!i && !i.isPartialDay;
                }).length;
                const effectiveCount = ((shift?.memberCount ?? 0) - offCount) + additionalForType.length;
                return (
                  <div key={type} className={`p-4 rounded-md border ${shift?.isWorking || additionalForType.length > 0 ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border opacity-60"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <p className="font-semibold text-sm text-foreground">{label}</p>
                      {shift?.isWorking || additionalForType.length > 0
                        ? <span className="ml-auto text-xs font-medium text-primary">{effectiveCount} on duty</span>
                        : <span className="ml-auto text-xs text-muted-foreground">Off duty</span>}
                    </div>
                    {shift?.isWorking && shift.memberNames.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                        {shift.memberNames.map((name) => {
                          const offInfo = dayOffForDay[name];
                          const isFullOff = !!offInfo && !offInfo.isPartialDay;
                          const isPartial = !!offInfo?.isPartialDay;
                          const isSgt = name === shift.sergeantName;
                          const workingHours = isPartial && offInfo?.partialStartTime && offInfo?.partialEndTime
                            ? getWorkingHours(type as "day" | "night", offInfo.partialStartTime, offInfo.partialEndTime)
                            : null;
                          return (
                            <div key={name} className="flex flex-col gap-0">
                              <span className={`text-sm ${isFullOff ? "text-red-600 line-through" : isPartial ? "text-amber-700 font-medium" : isSgt ? "font-bold text-foreground" : "text-foreground"}`}>{name}</span>
                              {isPartial && workingHours && (
                                <span className="flex items-center gap-0.5 text-[10px] text-amber-600">
                                  <Clock3 className="w-2.5 h-2.5" />{workingHours}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {offCount > 0 && shift?.isWorking && <p className="text-xs text-red-500 mt-2">{offCount} on approved day off</p>}
                    {additionalForType.length > 0 && (
                      <div className={shift?.isWorking && shift.memberNames.length ? "mt-3 pt-3 border-t border-border/50" : "mt-1"}>
                        <p className="text-xs font-semibold text-green-700 mb-1.5">Additional Personnel</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {additionalForType.map((a) => <span key={a.id} className="text-sm text-green-700">{a.name}</span>)}
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PublicCalendarPage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const isKiosk = new URLSearchParams(window.location.search).has("kiosk");

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<ScheduleDay | null>(null);
  const [invalid, setInvalid] = useState(false);

  // Auto-refresh every 5 minutes in kiosk mode
  useEffect(() => {
    if (!isKiosk) return;
    const id = setInterval(() => window.location.reload(), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [isKiosk]);
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridHeight, setGridHeight] = useState(0);
  useEffect(() => {
    if (!gridRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setGridHeight(entries[0]?.contentRect.height ?? 0);
    });
    ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, []);

  const today = localDateStr(new Date());

  const start = useMemo(() => {
    const now = new Date();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - now.getDay() + weekOffset * 35);
    return localDateStr(sunday);
  }, [weekOffset]);

  const end = useMemo(() => toDateStr(addDays(new Date(start + "T00:00:00Z"), 34)), [start]);

  const title = useMemo(() => {
    const s = new Date(start + "T00:00:00Z");
    const e = new Date(end + "T00:00:00Z");
    const startStr = s.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
    const endStr = e.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
    return `${startStr} – ${endStr}`;
  }, [start, end]);

  const days = useMemo(() => {
    const anchor = new Date(start + "T00:00:00Z");
    return Array.from({ length: 35 }, (_, i) => toDateStr(addDays(anchor, i)));
  }, [start]);

  // Single request returns schedule + day-off requests + daily assignments
  const query = useQuery({
    queryKey: ["public-calendar", token, start, end],
    queryFn: () => publicFetch<PublicScheduleResponse>("schedule", token, { start, end }),
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (query.error) {
      const status = (query.error as Error).message;
      if (status === "401" || status === "403") setInvalid(true);
    }
  }, [query.error]);

  // date -> name -> DayOffInfo (same logic as schedule page)
  const dayOffMap = useMemo(() => {
    const map: Record<string, Record<string, DayOffInfo>> = {};
    for (const req of query.data?.dayOffRequests ?? []) {
      const date = req.requestedDate;
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
  }, [query.data?.dayOffRequests]);

  // date -> { day: [...], night: [...] } (same logic as schedule page)
  const dailyMap = useMemo(() => {
    const map: Record<string, { day: { id: number; name: string }[]; night: { id: number; name: string }[] }> = {};
    for (const a of query.data?.dailyAssignments ?? []) {
      if (!map[a.assignedDate]) map[a.assignedDate] = { day: [], night: [] };
      const initial = a.firstName ? a.firstName.charAt(0).toUpperCase() + "." : "";
      const name = initial ? `${initial} ${a.lastName ?? ""}` : (a.lastName ?? "");
      map[a.assignedDate]![a.shiftType as "day" | "night"].push({ id: a.id, name });
    }
    return map;
  }, [query.data?.dailyAssignments]);

  const scheduleMap = useMemo(() => {
    const map: Record<string, ScheduleDay> = {};
    query.data?.days.forEach((day) => { map[day.date] = day; });
    return map;
  }, [query.data?.days]);

  // Max names in any single shift column across all 35 days
  const maxNamesPerColumn = useMemo(() => {
    let max = 1;
    for (const key of days) {
      const info = scheduleMap[key];
      if (!info) continue;
      const dayShift = info.shifts.find((s) => s.shiftType === "day" && s.isWorking);
      const nightShift = info.shifts.find((s) => s.shiftType === "night" && s.isWorking);
      const dayTotal = (dayShift?.memberNames.length ?? 0) + (dailyMap[key]?.day.length ?? 0);
      const nightTotal = (nightShift?.memberNames.length ?? 0) + (dailyMap[key]?.night.length ?? 0);
      max = Math.max(max, dayTotal, nightTotal);
    }
    return max;
  }, [days, scheduleMap, dailyMap]);

  // Use the measured grid height so font size is exact regardless of screen size.
  // Cell height = gridHeight / 5 rows.
  // Each name needs fontSize * 1.25 (leading-tight). Reserve 2 slots for date + icon row.
  // No minimum clamp — let it go as small as needed to show every name.
  const cellHeight = gridHeight > 0 ? gridHeight / 5 : 0;
  const nameFontSizePx = cellHeight > 0
    ? Math.max(6, Math.floor(cellHeight / (maxNamesPerColumn + 2) / 1.25))
    : 11;

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <Shield className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-lg font-semibold text-foreground">Invalid calendar link</p>
          <p className="text-sm text-muted-foreground">This link may have expired or been revoked.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">

      {/* Nav bar */}
      {isKiosk ? (
        <div className="shrink-0 flex items-center justify-center px-4 py-1 border-b border-border bg-card">
          <span className="font-bold text-foreground tracking-tight" style={{ fontSize: "clamp(14px,1.4vw,28px)" }}>{title}</span>
        </div>
      ) : (
        <>
          <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border bg-card">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset(o => o - 1)}>
              <ChevronLeft style={{ width: "clamp(16px,1.5vw,28px)", height: "clamp(16px,1.5vw,28px)" }} />
            </Button>
            <span className="font-bold text-foreground tracking-tight" style={{ fontSize: "clamp(18px,2.2vw,42px)" }}>{title}</span>
            <Button variant="outline" size="icon" onClick={() => setWeekOffset(o => o + 1)}>
              <ChevronRight style={{ width: "clamp(16px,1.5vw,28px)", height: "clamp(16px,1.5vw,28px)" }} />
            </Button>
          </div>
          <div className="shrink-0 flex flex-wrap items-center gap-5 px-4 py-1.5 border-b border-border bg-card text-muted-foreground" style={{ fontSize: "clamp(11px,1vw,18px)" }}>
            <div className="flex items-center gap-1.5"><Sun className="w-[1em] h-[1em] text-amber-500" /><span>Day</span></div>
            <div className="flex items-center gap-1.5"><Moon className="w-[1em] h-[1em] text-primary" /><span>Night</span></div>
            <div className="flex items-center gap-1.5"><div className="w-[1em] h-[1em] rounded-sm bg-primary/20 border border-primary/40" /><span>Shift A</span></div>
            <div className="flex items-center gap-1.5"><div className="w-[1em] h-[1em] rounded-sm bg-accent/20 border border-accent/40" /><span>Shift B</span></div>
            <div className="flex items-center gap-1.5"><div className="w-[1em] h-[1em] rounded-sm bg-red-100 border border-red-300" /><span className="text-red-600">Day Off</span></div>
            <div className="flex items-center gap-1.5"><div className="w-[1em] h-[1em] rounded-sm bg-amber-100 border border-amber-300" /><span className="text-amber-700">Partial</span></div>
            <div className="flex items-center gap-1.5"><span className="text-green-700 font-bold">+</span><span className="text-green-700">Additional</span></div>
          </div>
        </>
      )}

      {/* Calendar — fills remaining height, equal rows, font scales to fit all names */}
      <div className="flex-1 flex flex-col min-h-0 p-2 gap-1">

        {/* Day-of-week headers */}
        <div className="shrink-0 grid grid-cols-7 gap-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center font-semibold text-muted-foreground py-0.5" style={{ fontSize: "clamp(10px,1vw,18px)" }}>{d}</div>
          ))}
        </div>

        {/* 5-week grid: equal rows fill remaining height */}
        {query.isLoading ? (
          <div className="flex-1 grid grid-cols-7 gap-1" style={{ gridTemplateRows: "repeat(5, 1fr)" }}>
            {Array(35).fill(0).map((_, i) => <Skeleton key={i} className="rounded" />)}
          </div>
        ) : (
          <div ref={gridRef} className="flex-1 grid grid-cols-7 gap-1 min-h-0" style={{ gridTemplateRows: "repeat(5, 1fr)" }}>
            {days.map((key) => {
              const d = new Date(key + "T00:00:00Z");
              const info = scheduleMap[key];
              const letter = info?.workingShiftLetter;
              const isToday = key === today;
              const dayOffForKey = dayOffMap[key] ?? {};
              const dayShift = info?.shifts?.find((s) => s.shiftType === "day" && s.isWorking);
              const nightShift = info?.shifts?.find((s) => s.shiftType === "night" && s.isWorking);
              const dayNames = dayShift?.memberNames ?? [];
              const nightNames = nightShift?.memberNames ?? [];
              const daySgtName = dayShift?.sergeantName ?? null;
              const nightSgtName = nightShift?.sergeantName ?? null;
              const dailyDay = dailyMap[key]?.day ?? [];
              const dailyNight = dailyMap[key]?.night ?? [];
              // Explicit hsla() values match the theme variables (--primary: 224 73% 33%,
              // --accent: 45 93% 47%, --muted: 210 20% 95%, --border: 214 20% 85%).
              // Inline styles bypass color-mix() entirely so they render correctly in
              // older Chromium (Dakboard display devices) which doesn't support color-mix().
              const cellBg =
                letter === "a" ? "hsla(224,73%,33%,0.10)"
                : letter === "b" ? "hsla(45,93%,47%,0.10)"
                : "hsla(210,20%,95%,0.30)";
              const cellBorder =
                letter === "a" ? "hsla(224,73%,33%,0.30)"
                : letter === "b" ? "hsla(45,93%,47%,0.30)"
                : "hsl(214,20%,85%)";
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(info || { date: key, dayOfWeek: "", workingShiftLetter: null, shifts: [] })}
                  className={`flex flex-col items-start p-1.5 rounded-md border text-left transition-colors focus:outline-none overflow-hidden
                    ${isToday ? "ring-2 ring-primary ring-offset-1" : ""}
                  `}
                  style={{ backgroundColor: cellBg, borderColor: cellBorder }}
                >
                  <span className={`font-bold leading-none mb-0.5 shrink-0 ${isToday ? "text-primary" : "text-foreground"}`} style={{ fontSize: `${Math.round(nameFontSizePx * 1.4)}px` }}>
                    {d.getUTCDate()}
                    {letter && (
                      <span className={`ml-1 font-bold uppercase ${letter === "a" ? "text-primary" : "text-amber-700"}`} style={{ fontSize: `${Math.round(nameFontSizePx * 1.0)}px` }}>
                        {letter.toUpperCase()}
                      </span>
                    )}
                  </span>
                  <div className="flex w-full gap-1 flex-1 min-h-0" style={{ fontSize: `${nameFontSizePx}px` }}>
                    <div className="flex-1 min-w-0 border-r border-border/40 pr-1 overflow-hidden">
                      <Sun className="w-[1em] h-[1em] text-amber-500 mb-0.5 shrink-0" />
                      <div className="flex flex-col gap-0 leading-tight">
                        {dayNames.map((name) => {
                          const off = dayOffForKey[name];
                          return (
                            <span key={name} className={`block truncate ${
                              off && !off.isPartialDay ? "text-red-600 line-through font-medium"
                              : off?.isPartialDay ? "text-amber-700 font-medium"
                              : name === daySgtName ? "text-foreground font-bold"
                              : "text-foreground/80 font-medium"
                            }`}>{name}</span>
                          );
                        })}
                        {dailyDay.map((a) => (
                          <span key={`da-${a.id}`} className="block truncate text-green-700 font-medium">+{a.name}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pl-1 overflow-hidden">
                      <Moon className="w-[1em] h-[1em] text-primary mb-0.5 shrink-0" />
                      <div className="flex flex-col gap-0 leading-tight">
                        {nightNames.map((name) => {
                          const off = dayOffForKey[name];
                          return (
                            <span key={name} className={`block truncate ${
                              off && !off.isPartialDay ? "text-red-600 line-through font-medium"
                              : off?.isPartialDay ? "text-amber-700 font-medium"
                              : name === nightSgtName ? "text-foreground font-bold"
                              : "text-foreground/80 font-medium"
                            }`}>{name}</span>
                          );
                        })}
                        {dailyNight.map((a) => (
                          <span key={`na-${a.id}`} className="block truncate text-green-700 font-medium">+{a.name}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <DaySheet
        selectedDay={selectedDay}
        onClose={() => setSelectedDay(null)}
        dayOffMap={dayOffMap}
        dailyMap={dailyMap}
      />
    </div>
  );
}
