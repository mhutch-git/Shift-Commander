import { useState } from "react";
import { useGetSchedule, getGetScheduleQueryKey, type ScheduleDay, type ScheduleShift } from "@workspace/api-client-react";
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
            <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
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

                  const dayShift = info?.shifts?.find((s: ScheduleShift) => s.shiftType === "day" && s.isWorking);
                  const nightShift = info?.shifts?.find((s: ScheduleShift) => s.shiftType === "night" && s.isWorking);

                  const dayNames = dayShift?.memberNames ?? [];
                  const nightNames = nightShift?.memberNames ?? [];

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

                      {/* Day shift names */}
                      {dayNames.length > 0 && (
                        <div className="w-full mb-1">
                          <div className="flex items-center gap-0.5 mb-0.5">
                            <Sun className="w-2 h-2 text-amber-500 flex-shrink-0" />
                          </div>
                          <div className="flex flex-col gap-0 leading-tight">
                            {dayNames.map((name) => (
                              <span key={name} className="text-[9px] text-foreground/80 font-medium truncate">
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Night shift names */}
                      {nightNames.length > 0 && (
                        <div className="w-full">
                          <div className="flex items-center gap-0.5 mb-0.5">
                            <Moon className="w-2 h-2 text-primary flex-shrink-0" />
                          </div>
                          <div className="flex flex-col gap-0 leading-tight">
                            {nightNames.map((name) => (
                              <span key={name} className="text-[9px] text-foreground/80 font-medium truncate">
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
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
                    if (!shift) return null;
                    return (
                      <div
                        key={type}
                        className={`p-4 rounded-md border ${shift.isWorking ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border opacity-60"}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className={`w-4 h-4 ${color}`} />
                          <p className="font-semibold text-sm text-foreground">{shift.name}</p>
                          {shift.isWorking ? (
                            <span className="ml-auto text-xs font-medium text-primary">{shift.memberCount} on duty</span>
                          ) : (
                            <span className="ml-auto text-xs text-muted-foreground">Off duty</span>
                          )}
                        </div>
                        {shift.isWorking && shift.memberNames && shift.memberNames.length > 0 && (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                            {shift.memberNames.map((name: string) => (
                              <span key={name} className="text-sm text-foreground">{name}</span>
                            ))}
                          </div>
                        )}
                        {shift.sergeantName && (
                          <p className="text-xs text-muted-foreground mt-2">Sgt. {shift.sergeantName}</p>
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
