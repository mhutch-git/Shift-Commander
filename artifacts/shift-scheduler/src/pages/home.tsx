import { useMemo, useState } from "react";
import {
  useGetSchedule, getGetScheduleQueryKey, type ScheduleDay, type ScheduleShift,
  useListDayOffRequests, type DayOffRequest,
  useListDailyAssignments, type DailyAssignment,
  useListNotifications, getListNotificationsQueryKey,
  useMarkNotificationRead, useMarkAllNotificationsRead,
  type Notification,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Sun, Moon, CalendarOff, Bell, CheckCheck, BellOff,
  UserPlus, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function formatDateLong(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function getMonthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month, 1)).toISOString().split("T")[0]!;
  const end = new Date(Date.UTC(year, month + 1, 0)).toISOString().split("T")[0]!;
  return { start, end };
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_ABBR = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ── badges ───────────────────────────────────────────────────────────────────

function ShiftBadge({ type }: { type: string }) {
  if (type === "day")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
        <Sun className="h-3 w-3" /> Day
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
      <Moon className="h-3 w-3" /> Night
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
    pending: { label: "Pending", cls: "bg-yellow-100 text-yellow-800 border-yellow-200", Icon: Clock },
    approved: { label: "Approved", cls: "bg-green-100 text-green-800 border-green-200", Icon: CheckCircle },
    denied: { label: "Denied", cls: "bg-red-100 text-red-800 border-red-200", Icon: XCircle },
  };
  const { label, cls, Icon } = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  pto: "PTO", training: "Training", sick_leave: "Sick Leave",
};

function RequestTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    pto: "bg-blue-100 text-blue-800 border-blue-200",
    training: "bg-purple-100 text-purple-800 border-purple-200",
    sick_leave: "bg-orange-100 text-orange-800 border-orange-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[type] ?? "bg-muted text-muted-foreground border-border"}`}>
      {REQUEST_TYPE_LABELS[type] ?? type}
    </span>
  );
}

// ── mini calendar ─────────────────────────────────────────────────────────────

interface DayInfo {
  day: number;
  dateStr: string;
  worksDay: boolean;
  worksNight: boolean;
  isDayOff: boolean;
  isSpecial: boolean;
  isToday: boolean;
  isPast: boolean;
}

function MiniCalendar({
  year, month, days, onPrev, onNext,
}: {
  year: number;
  month: number;
  days: DayInfo[];
  onPrev: () => void;
  onNext: () => void;
}) {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0=Sun
  const blanks = Array(firstDow).fill(null);

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrev} className="p-1 rounded hover:bg-muted transition-colors">
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-semibold text-foreground">
          {MONTH_NAMES[month]} {year}
        </span>
        <button onClick={onNext} className="p-1 rounded hover:bg-muted transition-colors">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_ABBR.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {blanks.map((_, i) => <div key={`b${i}`} />)}
        {days.map((d) => {
          const working = d.worksDay || d.worksNight;
          const baseCell = "relative flex flex-col items-center justify-start pt-1 pb-0.5 rounded-md h-9 transition-colors select-none";
          let cellCls = baseCell + " ";

          if (d.isToday && working) {
            cellCls += "ring-2 ring-primary ring-offset-1 ";
          }
          if (d.isToday && !working) {
            cellCls += "ring-2 ring-border ring-offset-1 ";
          }
          if (working && !d.isPast) {
            cellCls += d.worksDay && d.worksNight
              ? "bg-violet-100"
              : d.worksDay
              ? "bg-amber-50 border border-amber-200"
              : "bg-indigo-50 border border-indigo-200";
          } else if (d.isPast) {
            cellCls += "opacity-35";
          }

          const numCls = `text-[11px] font-semibold leading-none ${
            d.isToday ? "text-primary" : working && !d.isPast ? "text-foreground" : "text-muted-foreground"
          }`;

          return (
            <div key={d.dateStr} className={cellCls}>
              <span className={numCls}>{d.day}</span>
              {/* indicator dots */}
              <div className="flex gap-px mt-0.5">
                {d.worksDay && !d.isPast && (
                  <span className="w-1 h-1 rounded-full bg-amber-500" title="Day shift" />
                )}
                {d.worksNight && !d.isPast && (
                  <span className="w-1 h-1 rounded-full bg-indigo-500" title="Night shift" />
                )}
                {d.isDayOff && !d.isPast && (
                  <span className="w-1 h-1 rounded-full bg-red-400" title="Day off requested" />
                )}
                {d.isSpecial && !d.isPast && (
                  <span className="w-1 h-1 rounded-full bg-green-500" title="Special assignment" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-border">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" /> Day shift
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" /> Night shift
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" /> Day off
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" /> Special assignment
        </span>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const todayDate = new Date();
  const today = todayDate.toISOString().split("T")[0]!;

  // Calendar month state
  const [viewMonth, setViewMonth] = useState({ year: todayDate.getFullYear(), month: todayDate.getMonth() });
  const { start: monthStart, end: monthEnd } = getMonthBounds(viewMonth.year, viewMonth.month);

  // The user's display name in schedule memberNames (e.g. "A. Brown")
  const displayName = useMemo(() => {
    if (!user) return "";
    const initial = user.firstName ? user.firstName.charAt(0).toUpperCase() + "." : "";
    return initial ? `${initial} ${user.lastName}` : user.lastName ?? "";
  }, [user]);

  // Fetch schedule for the displayed month
  const { data: schedule, isLoading: scheduleLoading } = useGetSchedule(
    { start: monthStart, end: monthEnd },
    { query: { queryKey: getGetScheduleQueryKey({ start: monthStart, end: monthEnd }) } }
  );

  // Fetch day-off requests
  const { data: allRequests, isLoading: requestsLoading } = useListDayOffRequests();

  // Fetch upcoming assignments (60-day window)
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + 60);
  const windowEndStr = windowEnd.toISOString().split("T")[0]!;
  const { data: allAssignments } = useListDailyAssignments({ start: today, end: windowEndStr });

  // Fetch month assignments for calendar overlay
  const { data: monthAssignments } = useListDailyAssignments({ start: monthStart, end: monthEnd });

  // Fetch notifications
  const { data: notifications, isLoading: notificationsLoading } = useListNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // ── derived data ─────────────────────────────────────────────────────────────

  // Build schedule lookup: date -> { day: boolean, night: boolean }
  const scheduleMap = useMemo(() => {
    const map: Record<string, { day: boolean; night: boolean }> = {};
    for (const d of (schedule as ScheduleDay[] | undefined) ?? []) {
      map[d.date] = { day: false, night: false };
      for (const s of d.shifts ?? []) {
        if (s.isWorking && (s.memberNames ?? []).includes(displayName)) {
          if (s.shiftType === "day") map[d.date]!.day = true;
          if (s.shiftType === "night") map[d.date]!.night = true;
        }
      }
    }
    return map;
  }, [schedule, displayName]);

  // Build day-off set for the current month (current user only)
  const dayOffSet = useMemo(() => {
    const set = new Set<string>();
    for (const r of (allRequests as DayOffRequest[] | undefined) ?? []) {
      if (r.userId === user?.id && r.status !== "denied") {
        set.add(r.requestedDate);
      }
    }
    return set;
  }, [allRequests, user]);

  // Build special assignment set for this month (current user only)
  const specialSet = useMemo(() => {
    const set = new Set<string>();
    for (const a of (monthAssignments as DailyAssignment[] | undefined) ?? []) {
      if (a.userId === user?.id) set.add(a.assignedDate);
    }
    return set;
  }, [monthAssignments, user]);

  // Build calendar day info array
  const calendarDays = useMemo<DayInfo[]>(() => {
    const daysInMonth = new Date(Date.UTC(viewMonth.year, viewMonth.month + 1, 0)).getUTCDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = toDateStr(viewMonth.year, viewMonth.month, day);
      const sched = scheduleMap[dateStr];
      return {
        day,
        dateStr,
        worksDay: sched?.day ?? false,
        worksNight: sched?.night ?? false,
        isDayOff: dayOffSet.has(dateStr),
        isSpecial: specialSet.has(dateStr),
        isToday: dateStr === today,
        isPast: dateStr < today,
      };
    });
  }, [viewMonth, scheduleMap, dayOffSet, specialSet, today]);

  // My upcoming day-off requests (own, upcoming or pending)
  const myRequests = useMemo(() => {
    if (!allRequests || !user) return [];
    return (allRequests as DayOffRequest[])
      .filter(r => r.userId === user.id && (r.status === "pending" || r.requestedDate >= today))
      .sort((a, b) => a.requestedDate.localeCompare(b.requestedDate))
      .slice(0, 8);
  }, [allRequests, user, today]);

  // My special assignments
  const myAssignments = useMemo(() => {
    if (!allAssignments || !user) return [];
    return (allAssignments as DailyAssignment[])
      .filter(a => a.userId === user.id)
      .sort((a, b) => a.assignedDate.localeCompare(b.assignedDate));
  }, [allAssignments, user]);

  // Unread notifications
  const unreadNotifications = useMemo(() =>
    ((notifications ?? []) as Notification[]).filter(n => !n.isRead).slice(0, 6),
    [notifications]
  );

  // ── handlers ─────────────────────────────────────────────────────────────────

  const prevMonth = () => setViewMonth(v => {
    if (v.month === 0) return { year: v.year - 1, month: 11 };
    return { year: v.year, month: v.month - 1 };
  });
  const nextMonth = () => setViewMonth(v => {
    if (v.month === 11) return { year: v.year + 1, month: 0 };
    return { year: v.year, month: v.month + 1 };
  });

  const handleMarkRead = async (id: number) => {
    try {
      await markRead.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
    } catch {
      toast({ title: "Failed to mark as read", variant: "destructive" });
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllRead.mutateAsync();
      queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      toast({ title: "All notifications marked as read" });
    } catch {
      toast({ title: "Failed to mark all as read", variant: "destructive" });
    }
  };

  const isReserve = user?.role === "reserve";
  const hasShift = !!user?.shiftId;

  return (
    <AppLayout>
      <div className="space-y-5 max-w-5xl">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}, {user?.firstName}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {formatDateLong(today)}
            {user?.shiftName && (
              <span className="ml-2 text-primary font-medium">· {user.shiftName}</span>
            )}
          </p>
        </div>

        {/* Top row: Calendar + Day-Off Requests side by side */}
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">

          {/* Mini Calendar */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" />
                My Schedule
              </CardTitle>
              <Link href="/schedule">
                <span className="text-xs text-primary hover:underline cursor-pointer">Full calendar</span>
              </Link>
            </CardHeader>
            <CardContent className="pt-1">
              {isReserve ? (
                <p className="text-sm text-muted-foreground italic py-4">
                  Reserve officers appear on the schedule only when specifically assigned.
                  {myAssignments.length === 0 && " No upcoming assignments."}
                </p>
              ) : scheduleLoading ? (
                <div className="space-y-1">
                  <Skeleton className="h-6 w-full" />
                  {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
                </div>
              ) : (
                <MiniCalendar
                  year={viewMonth.year}
                  month={viewMonth.month}
                  days={calendarDays}
                  onPrev={prevMonth}
                  onNext={nextMonth}
                />
              )}
            </CardContent>
          </Card>

          {/* Right column: Day-Off Requests + Special Assignments stacked */}
          <div className="space-y-5">

            {/* Day-Off Requests */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarOff className="w-4 h-4 text-muted-foreground" />
                  Day-Off Requests
                </CardTitle>
                <Link href="/day-off-requests">
                  <span className="text-xs text-primary hover:underline cursor-pointer">View all</span>
                </Link>
              </CardHeader>
              <CardContent className="pt-1">
                {requestsLoading ? (
                  <div className="space-y-2">
                    {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : myRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-2">No upcoming or pending requests.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {myRequests.map((r: DayOffRequest) => (
                      <li key={r.id} className="py-2 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-foreground">{formatDateShort(r.requestedDate)}</span>
                          <RequestTypeBadge type={r.requestType} />
                          <StatusBadge status={r.status} />
                        </div>
                        {r.reason && (
                          <p className="text-xs text-muted-foreground truncate">{r.reason}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Special Assignments */}
            {myAssignments.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-green-600" />
                    Special Assignments
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-1">
                  <ul className="divide-y divide-border">
                    {myAssignments.map((a: DailyAssignment) => (
                      <li key={a.id} className="py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">{formatDateShort(a.assignedDate)}</span>
                          <ShiftBadge type={a.shiftType} />
                        </div>
                        {a.notes && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{a.notes}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Notifications */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              Notifications
              {unreadNotifications.length > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadNotifications.length} unread
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-3">
              {unreadNotifications.length > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  disabled={markAllRead.isPending}
                >
                  <CheckCheck className="w-3 h-3" /> Mark all read
                </button>
              )}
              <Link href="/notifications">
                <span className="text-xs text-primary hover:underline cursor-pointer">View all</span>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            {notificationsLoading ? (
              <div className="grid sm:grid-cols-2 gap-2">
                {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : unreadNotifications.length === 0 ? (
              <div className="flex items-center gap-2 py-3 text-muted-foreground text-sm">
                <BellOff className="w-4 h-4 opacity-50" />
                <span>No unread notifications.</span>
              </div>
            ) : (
              <ul className="grid sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0 divide-border">
                {unreadNotifications.map((n: Notification) => (
                  <li key={n.id} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0 sm:[&:nth-last-child(-n+2)]:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground leading-snug">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs shrink-0 h-6 px-2"
                      onClick={() => handleMarkRead(n.id)}
                      disabled={markRead.isPending}
                    >
                      Dismiss
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
}
