import { useState } from "react";
import { useGetSchedule, getGetScheduleQueryKey, type ScheduleDay, type ScheduleShift } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function ShiftCell({ shift }: { shift: ScheduleShift | undefined }) {
  if (!shift || !shift.isWorking) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-xs text-muted-foreground italic">Off duty</span>
      </div>
    );
  }

  const names = shift.memberNames ?? [];

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {shift.name}
      </p>
      {names.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No members</p>
      ) : (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          {names.map((name) => (
            <span key={name} className="text-xs text-foreground font-medium leading-tight">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  const [viewDate, setViewDate] = useState(new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const { start, end } = getMonthBounds(year, month);

  const schedule = useGetSchedule(
    { start, end },
    { query: { queryKey: getGetScheduleQueryKey({ start, end }) } }
  );

  const days = getDaysInMonth(year, month);

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
          <CardContent className="px-0 pb-0">
            {/* Column headers */}
            <div className="grid grid-cols-[80px_1fr_1fr] border-b border-border">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Date
              </div>
              <div className="px-3 py-2 border-l border-border flex items-center gap-1.5 text-xs font-semibold text-amber-600 uppercase tracking-wider">
                <Sun className="w-3.5 h-3.5" />
                Day Shift
              </div>
              <div className="px-3 py-2 border-l border-border flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                <Moon className="w-3.5 h-3.5" />
                Night Shift
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border">
              {schedule.isLoading
                ? Array(10).fill(0).map((_, i) => (
                    <div key={i} className="grid grid-cols-[80px_1fr_1fr] py-3">
                      <Skeleton className="h-8 mx-3" />
                      <Skeleton className="h-8 mx-3" />
                      <Skeleton className="h-8 mx-3" />
                    </div>
                  ))
                : days.map((d) => {
                    const key = d.toISOString().split("T")[0];
                    const info = scheduleMap[key];
                    const isToday = key === today;
                    const dayLabel = SHORT_DAY[d.getUTCDay()];
                    const dayNum = d.getUTCDate();

                    const dayShift = info?.shifts?.find(
                      (s: ScheduleShift) => s.shiftType === "day"
                    );
                    const nightShift = info?.shifts?.find(
                      (s: ScheduleShift) => s.shiftType === "night"
                    );

                    const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;

                    return (
                      <div
                        key={key}
                        data-testid={`day-row-${key}`}
                        className={`grid grid-cols-[80px_1fr_1fr] min-h-[52px] transition-colors
                          ${isToday ? "bg-primary/5" : isWeekend ? "bg-muted/20" : ""}
                        `}
                      >
                        {/* Date cell */}
                        <div className={`px-3 py-2.5 flex flex-col justify-center
                          ${isToday ? "border-l-2 border-primary" : ""}
                        `}>
                          <span className={`text-sm font-bold leading-tight ${isToday ? "text-primary" : "text-foreground"}`}>
                            {dayNum}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                            {dayLabel}
                          </span>
                        </div>

                        {/* Day shift cell */}
                        <div className="px-3 py-2.5 border-l border-border">
                          <ShiftCell shift={dayShift} />
                        </div>

                        {/* Night shift cell */}
                        <div className="px-3 py-2.5 border-l border-border">
                          <ShiftCell shift={nightShift} />
                        </div>
                      </div>
                    );
                  })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
