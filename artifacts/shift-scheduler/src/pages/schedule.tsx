import { useState } from "react";
import { useGetSchedule, getGetScheduleQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChevronLeft, ChevronRight } from "lucide-react";

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function formatYYYYMM(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
  const [selectedDay, setSelectedDay] = useState<any | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const { start, end } = getMonthBounds(year, month);

  const schedule = useGetSchedule(
    { start, end },
    { query: { queryKey: getGetScheduleQueryKey({ start, end }) } }
  );

  const days = getDaysInMonth(year, month);
  const firstDayOfWeek = days[0].getUTCDay();

  const scheduleMap: Record<string, any> = {};
  schedule.data?.forEach((day: any) => { scheduleMap[day.date] = day; });

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
            <div className="flex gap-4 mb-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-primary/20 border border-primary/40" />
                <span>Shift A</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-accent/20 border border-accent/40" />
                <span>Shift B</span>
              </div>
            </div>
            {/* Day header */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_NAMES.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            {/* Calendar grid */}
            {schedule.isLoading ? (
              <div className="grid grid-cols-7 gap-1">
                {Array(35).fill(0).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for days before month start */}
                {Array(firstDayOfWeek).fill(null).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {days.map((d) => {
                  const key = d.toISOString().split("T")[0];
                  const info = scheduleMap[key];
                  const letter = info?.workingShiftLetter;
                  const isToday = key === today;

                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDay(info || { date: key })}
                      data-testid={`day-cell-${key}`}
                      className={`relative aspect-square flex flex-col items-center justify-start pt-1 rounded-md border text-xs font-medium transition-colors focus:outline-none
                        ${letter === "a" ? "bg-primary/10 border-primary/30 hover:bg-primary/20" : ""}
                        ${letter === "b" ? "bg-accent/10 border-accent/30 hover:bg-accent/20" : ""}
                        ${!letter ? "bg-muted/30 border-border hover:bg-muted/50" : ""}
                        ${isToday ? "ring-2 ring-primary ring-offset-1" : ""}
                      `}
                    >
                      <span className={`font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
                        {d.getUTCDate()}
                      </span>
                      {letter && (
                        <span className={`text-[9px] mt-0.5 font-bold uppercase tracking-wider ${letter === "a" ? "text-primary" : "text-amber-700"}`}>
                          {letter.toUpperCase()}
                        </span>
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
          <SheetContent side="right" className="w-full sm:max-w-md">
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
                <div className="mt-6 space-y-3">
                  {selectedDay.shifts?.map((shift: any) => (
                    <div
                      key={shift.id}
                      className={`p-3 rounded-md border ${shift.isWorking ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border opacity-60"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{shift.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{shift.shiftType} shift</p>
                        </div>
                        {shift.isWorking ? (
                          <span className="text-xs font-medium text-primary">{shift.memberCount} on duty</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Off duty</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}
