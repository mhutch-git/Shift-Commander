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
import { ChevronLeft, ChevronRight, Sun, Moon } from "lucide-react";

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function getMonthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
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
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export default function SchedulePage() {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<ScheduleDay | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const { start, end } = getMonthBounds(year, month);

  const schedule = useGetSchedule(
    { start, end },
    { query: { queryKey: getGetScheduleQueryKey({ start, end }) } }
  );

  // Fetch approved day-off requests for this month
  const approvedRequests = useListDayOffRequests({ status: "approved" });

  // Fetch daily (manual) assignments for this month
  const dailyAssignmentsQuery = useListDailyAssignments({ start, end });

  // Build a map: date -> Set of display names ("A. Brown") who are on approved day off
  const dayOffMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const req of approvedRequests.data ?? []) {
      const date = req.requestedDate;
      if (date < start || date > end) continue;
      if (!map[date]) map[date] = new Set();
      const initial = req.requesterFirstName ? req.requesterFirstName.charAt(0).toUpperCase() + "." : "";
      const displayName = initial ? `${initial} ${req.requesterLastName}` : req.requesterLastName;
      if (displayName) map[date].add(displayName);
    }
    return map;
  }, [approvedRequests.data, start, end]);

  // Build a map: date -> { day: [{id, name}], night: [{id, name}] }
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

  const days = getDaysInMonth(year, month);
  const firstDayOfWeek = days[0].getUTCDay();

  const scheduleMap: Record<string, ScheduleDay> = {};
  schedule.data?.forEach((day) => { scheduleMap[day.date] = day; });

  const today = new Date().toISOString().split("T")[0];

  const prev = () => setViewDate(addMonths(viewDate, -1));
  const next = () => setViewDate(addMonths(viewDate, 1));

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Schedule</h1>
        </div>

        <Card className="border-card-border">
          <CardHeader className="pb-3 flex-row items-center justify-between flex">
            <Button variant="outline" size="icon" onClick={prev} data-testid="btn-prev-month">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <CardTitle className="text-base font-semibold">
              {MONTH_NAMES[month]} {year}
            </CardTitle>
            <Button variant="outline" size="icon" onClick={next} data-testid="btn-next-month">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="px-2 pb-4 md:px-4">
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mb-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Sun className="w-3 h-3 text-amber-500" />
                <span>Day Shift</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Moon className="w-3 h-3 text-primary" />
                <span>Night Shift</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-primary/20 border border-primary/40" />
                <span>Shift A</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-accent/20 border border-accent/40" />
                <span>Shift B</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-red-100 border border-red-300" />
                <span className="text-red-600">Day Off</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-green-700 font-bold text-xs">+</span>
                <span className="text-green-700">Additional</span>
              </div>
            </div>

            {/* Day-of-week header */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_NAMES.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            {schedule.isLoading ? (
              <div className="grid grid-cols-7 gap-1">
                {Array(35).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {Array(firstDayOfWeek).fill(null).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {days.map((d) => {
                  const key = d.toISOString().split("T")[0];
                  const info = scheduleMap[key];
                  const letter = info?.workingShiftLetter;
                  const isToday = key === today;
                  const dayOffNames = dayOffMap[key] ?? new Set<string>();

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
                      {/* Date number */}
                      <span className={`text-xs font-bold leading-none mb-1 ${isToday ? "text-primary" : "text-foreground"}`}>
                        {d.getUTCDate()}
                        {letter && (
                          <span className={`ml-1 text-[9px] font-bold uppercase ${letter === "a" ? "text-primary" : "text-amber-700"}`}>
                            {letter.toUpperCase()}
                          </span>
                        )}
                      </span>

                      {/* Day (left) / Night (right) two-column layout */}
                      <div className="flex w-full gap-0.5 flex-1">
                        {/* Day shift — left column */}
                        <div className="flex-1 min-w-0 border-r border-border/40 pr-0.5">
                          <div className="flex items-center gap-0.5 mb-0.5">
                            <Sun className="w-2 h-2 text-amber-500 flex-shrink-0" />
                          </div>
                          <div className="flex flex-col gap-0 leading-tight">
                            {dayNames.map((name) => {
                              const isOff = dayOffNames.has(name);
                              const isSgt = name === daySgtName;
                              return (
                                <span
                                  key={name}
                                  className={`text-[9px] truncate ${
                                    isOff
                                      ? "text-red-600 line-through font-medium"
                                      : isSgt
                                      ? "text-foreground font-bold"
                                      : "text-foreground/80 font-medium"
                                  }`}
                                >
                                  {name}
                                </span>
                              );
                            })}
                            {dailyDay.map((a) => (
                              <span key={`da-${a.id}`} className="text-[9px] truncate text-green-700 font-medium">
                                +{a.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Night shift — right column */}
                        <div className="flex-1 min-w-0 pl-0.5">
                          <div className="flex items-center gap-0.5 mb-0.5">
                            <Moon className="w-2 h-2 text-primary flex-shrink-0" />
                          </div>
                          <div className="flex flex-col gap-0 leading-tight">
                            {nightNames.map((name) => {
                              const isOff = dayOffNames.has(name);
                              const isSgt = name === nightSgtName;
                              return (
                                <span
                                  key={name}
                                  className={`text-[9px] truncate ${
                                    isOff
                                      ? "text-red-600 line-through font-medium"
                                      : isSgt
                                      ? "text-foreground font-bold"
                                      : "text-foreground/80 font-medium"
                                  }`}
                                >
                                  {name}
                                </span>
                              );
                            })}
                            {dailyNight.map((a) => (
                              <span key={`na-${a.id}`} className="text-[9px] truncate text-green-700 font-medium">
                                +{a.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Day detail sheet */}
        <Sheet open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
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
                    const dayOffForDay = dayOffMap[selectedDay.date] ?? new Set<string>();
                    const additionalForType = dailyMap[selectedDay.date]?.[type as "day" | "night"] ?? [];

                    // Show the card if the shift is working OR there are additional assignees
                    if (!shift && additionalForType.length === 0) return null;

                    const offCount = (shift?.memberNames ?? []).filter((n) => dayOffForDay.has(n)).length;
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
                              const isOff = dayOffForDay.has(name);
                              const isSgt = name === shift.sergeantName;
                              return (
                                <span
                                  key={name}
                                  className={`text-sm ${
                                    isOff
                                      ? "text-red-600 line-through"
                                      : isSgt
                                      ? "font-bold text-foreground"
                                      : "text-foreground"
                                  }`}
                                  title={isOff ? "Approved day off" : isSgt ? "Sergeant" : undefined}
                                >
                                  {name}
                                </span>
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
                                <span key={a.id} className="text-sm text-green-700">
                                  {a.name}
                                </span>
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
      </div>
    </AppLayout>
  );
}
