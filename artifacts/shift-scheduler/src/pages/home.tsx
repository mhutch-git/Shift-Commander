import { useMemo } from "react";
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
import { Sun, Moon, CalendarOff, Bell, CheckCheck, BellOff, UserPlus, Clock, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── helpers ─────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function formatDateLong(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function isUpcoming(dateStr: string, today: string) {
  return dateStr >= today;
}

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
  pto: "PTO",
  training: "Training",
  sick_leave: "Sick Leave",
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

// ── main component ────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split("T")[0]!;

  // 60-day window for schedule + assignments
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + 60);
  const windowEndStr = windowEnd.toISOString().split("T")[0]!;

  // The user's display name used in memberNames (e.g. "A. Brown")
  const displayName = useMemo(() => {
    if (!user) return "";
    const initial = user.firstName ? user.firstName.charAt(0).toUpperCase() + "." : "";
    return initial ? `${initial} ${user.lastName}` : user.lastName ?? "";
  }, [user]);

  // Fetch schedule for next 60 days
  const { data: schedule, isLoading: scheduleLoading } = useGetSchedule(
    { start: today, end: windowEndStr },
    { query: { queryKey: getGetScheduleQueryKey({ start: today, end: windowEndStr }) } }
  );

  // Fetch user's day-off requests
  const { data: allRequests, isLoading: requestsLoading } = useListDayOffRequests();

  // Fetch upcoming daily assignments
  const { data: allAssignments, isLoading: assignmentsLoading } = useListDailyAssignments({
    start: today, end: windowEndStr,
  });

  // Fetch notifications
  const { data: notifications, isLoading: notificationsLoading } = useListNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // ── Derived data ────────────────────────────────────────────────────────────

  // Working days: schedule days where this user is listed as working
  const myWorkingDays = useMemo(() => {
    if (!schedule || !displayName) return [];
    return (schedule as ScheduleDay[])
      .filter(day => {
        return day.shifts?.some((s: ScheduleShift) =>
          s.isWorking && (s.memberNames ?? []).includes(displayName)
        );
      })
      .map(day => ({
        date: day.date,
        shifts: (day.shifts ?? []).filter((s: ScheduleShift) =>
          s.isWorking && (s.memberNames ?? []).includes(displayName)
        ),
      }))
      .slice(0, 14); // show next 14 working days
  }, [schedule, displayName]);

  // My day-off requests (own requests, upcoming or pending)
  const myRequests = useMemo(() => {
    if (!allRequests || !user) return [];
    return (allRequests as DayOffRequest[])
      .filter(r => r.userId === user.id && (r.status === "pending" || isUpcoming(r.requestedDate, today)))
      .sort((a, b) => a.requestedDate.localeCompare(b.requestedDate))
      .slice(0, 10);
  }, [allRequests, user, today]);

  // My daily (special) assignments
  const myAssignments = useMemo(() => {
    if (!allAssignments || !user) return [];
    return (allAssignments as DailyAssignment[])
      .filter(a => a.userId === user.id)
      .sort((a, b) => a.assignedDate.localeCompare(b.assignedDate));
  }, [allAssignments, user]);

  // Unread notifications
  const unreadNotifications = useMemo(() =>
    (notifications ?? []).filter((n: Notification) => !n.isRead).slice(0, 8),
    [notifications]
  );

  // ── handlers ────────────────────────────────────────────────────────────────

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

  // ── render ──────────────────────────────────────────────────────────────────

  const isReserve = user?.role === "reserve";
  const hasShift = !!user?.shiftId;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}, {user?.firstName}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {formatDateLong(today)}
            {user?.shiftName && (
              <span className="ml-2 text-primary font-medium">· {user.shiftName}</span>
            )}
          </p>
        </div>

        {/* My Schedule */}
        {(hasShift || isReserve) && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" />
                My Upcoming Shifts
              </CardTitle>
              <Link href="/schedule">
                <span className="text-xs text-primary hover:underline cursor-pointer">Full calendar</span>
              </Link>
            </CardHeader>
            <CardContent>
              {scheduleLoading ? (
                <div className="space-y-2">
                  {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : myWorkingDays.length === 0 && !isReserve ? (
                <p className="text-sm text-muted-foreground italic py-2">No upcoming working days found in the next 60 days.</p>
              ) : isReserve ? (
                <p className="text-sm text-muted-foreground italic py-2">
                  Reserve officers appear on the schedule only when specifically assigned.
                  {myAssignments.length === 0 && " No upcoming assignments."}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {myWorkingDays.map(({ date, shifts }) => (
                    <li key={date} className="flex items-center gap-4 py-2.5">
                      <span className="text-sm font-medium w-36 shrink-0">{formatDate(date)}</span>
                      <div className="flex gap-2 flex-wrap">
                        {shifts.map((s: ScheduleShift) => (
                          <ShiftBadge key={s.shiftType} type={s.shiftType} />
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* My Special Assignments */}
        {myAssignments.length > 0 && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-green-600" />
                Special Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {myAssignments.map((a: DailyAssignment) => (
                  <li key={a.id} className="flex items-center gap-4 py-2.5">
                    <span className="text-sm font-medium w-36 shrink-0">{formatDate(a.assignedDate)}</span>
                    <ShiftBadge type={a.shiftType} />
                    {a.notes && (
                      <span className="text-xs text-muted-foreground truncate">{a.notes}</span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* My Day-Off Requests */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarOff className="w-4 h-4 text-muted-foreground" />
              My Day-Off Requests
            </CardTitle>
            <Link href="/day-off-requests">
              <span className="text-xs text-primary hover:underline cursor-pointer">View all / New request</span>
            </Link>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <div className="space-y-2">
                {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : myRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-2">No upcoming or pending requests.</p>
            ) : (
              <ul className="divide-y divide-border">
                {myRequests.map((r: DayOffRequest) => (
                  <li key={r.id} className="flex items-center gap-3 py-2.5 flex-wrap">
                    <span className="text-sm font-medium w-32 shrink-0">{formatDate(r.requestedDate)}</span>
                    <RequestTypeBadge type={r.requestType} />
                    <StatusBadge status={r.status} />
                    {r.reason && (
                      <span className="text-xs text-muted-foreground truncate max-w-xs">{r.reason}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
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
          <CardContent>
            {notificationsLoading ? (
              <div className="space-y-2">
                {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : unreadNotifications.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
                <BellOff className="w-4 h-4 opacity-50" />
                <span>No unread notifications.</span>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {unreadNotifications.map((n: Notification) => (
                  <li key={n.id} className="flex items-start gap-3 py-3">
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs shrink-0"
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
