import {
  useGetDashboardSummary, useGetTodaySchedule,
  type ScheduleShiftWithCount, type ShiftCount, type DayOffRequest,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Clock, CalendarOff, Shield } from "lucide-react";
import { Link } from "wouter";

function StatCard({ title, value, icon: Icon, description, testId }: {
  title: string; value: number | string; icon: React.ElementType;
  description?: string; testId?: string;
}) {
  return (
    <Card className="border-card-border" data-testid={testId}>
      <CardContent className="pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    denied: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${variants[status] ?? "bg-muted text-muted-foreground"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function DashboardPage() {
  const summary = useGetDashboardSummary();
  const todaySchedule = useGetTodaySchedule();

  const isLoading = summary.isLoading || todaySchedule.isLoading;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Operations Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))
          ) : (
            <>
              <StatCard
                title="Total Personnel"
                value={summary.data?.totalPersonnel ?? 0}
                icon={Users}
                testId="stat-total-personnel"
              />
              <StatCard
                title="Active Personnel"
                value={summary.data?.activePersonnel ?? 0}
                icon={Shield}
                testId="stat-active-personnel"
              />
              <StatCard
                title="Pending Requests"
                value={summary.data?.pendingRequests ?? 0}
                icon={CalendarOff}
                description="Awaiting approval"
                testId="stat-pending-requests"
              />
              <StatCard
                title="Today's Shift"
                value={`Shift ${(summary.data?.todayWorkingShift ?? "a").toUpperCase()}`}
                icon={Clock}
                description="Currently on duty"
                testId="stat-today-shift"
              />
            </>
          )}
        </div>

        {/* Today's Working Shifts + Shift Counts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Active Shifts */}
          <Card className="border-card-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Today's Active Shifts</CardTitle>
            </CardHeader>
            <CardContent>
              {todaySchedule.isLoading ? (
                <div className="space-y-3">{Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <div className="space-y-3">
                  {todaySchedule.data?.workingShifts?.map((shift: ScheduleShiftWithCount) => (
                    <Link key={shift.id} href={`/shifts/${shift.id}`}>
                      <div
                        className="flex items-center justify-between p-3 rounded-md bg-primary/5 border border-primary/15 hover:bg-primary/10 cursor-pointer transition-colors"
                        data-testid={`shift-card-${shift.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <div>
                            <p className="font-medium text-sm text-foreground">{shift.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{shift.shiftType} shift</p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-primary">{shift.memberCount} deputies</span>
                      </div>
                    </Link>
                  ))}
                  {todaySchedule.data?.offShifts?.map((shift: ScheduleShiftWithCount) => (
                    <div
                      key={shift.id}
                      className="flex items-center justify-between p-3 rounded-md bg-muted border border-border opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm text-muted-foreground">{shift.name}</p>
                          <p className="text-xs text-muted-foreground">Off duty</p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">OFF</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Roster by Shift */}
          <Card className="border-card-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Personnel by Shift</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.isLoading ? (
                <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <div className="space-y-2">
                  {summary.data?.shiftCounts?.map((sc: ShiftCount) => (
                    <Link key={sc.shiftId} href={`/shifts/${sc.shiftId}`}>
                      <div
                        className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                        data-testid={`roster-count-${sc.shiftId}`}
                      >
                        <span className="text-sm font-medium text-foreground">{sc.shiftName}</span>
                        <Badge variant="secondary" className="font-semibold">{sc.count}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Day-Off Requests */}
        <Card className="border-card-border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Day-Off Requests</CardTitle>
            <Link href="/day-off-requests">
              <span className="text-xs text-primary hover:underline cursor-pointer">View all</span>
            </Link>
          </CardHeader>
          <CardContent>
            {summary.isLoading ? (
              <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
                      <th className="pb-2 pr-4">Deputy</th>
                      <th className="pb-2 pr-4">Date Requested</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {summary.data?.recentRequests?.length === 0 ? (
                      <tr><td colSpan={3} className="py-4 text-center text-muted-foreground text-sm">No recent requests</td></tr>
                    ) : (
                      summary.data?.recentRequests?.map((req: DayOffRequest) => (
                        <tr key={req.id} className="hover:bg-muted/30 transition-colors" data-testid={`request-row-${req.id}`}>
                          <td className="py-2.5 pr-4 font-medium text-foreground">{req.requesterFirstName} {req.requesterLastName}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{req.requestedDate}</td>
                          <td className="py-2.5"><StatusBadge status={req.status} /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
