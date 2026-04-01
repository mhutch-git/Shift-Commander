import { useState } from "react";
import {
  useListUsers,
  useListDailyAssignments, getListDailyAssignmentsQueryKey,
  useCreateDailyAssignment,
  useDeleteDailyAssignment,
  type DailyAssignment,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2, Sun, Moon } from "lucide-react";

function ShiftTypeBadge({ type }: { type: string }) {
  if (type === "day") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
        <Sun className="h-3 w-3" /> Day
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
      <Moon className="h-3 w-3" /> Night
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "bg-red-100 text-red-800 border-red-200",
    sergeant: "bg-blue-100 text-blue-700 border-blue-200",
    deputy: "bg-muted text-muted-foreground border-border",
    reserve: "bg-green-100 text-green-700 border-green-200",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${colors[role] ?? colors.deputy}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export default function AssignToShiftPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdminOrSgt = currentUser?.role === "admin" || currentUser?.role === "sergeant";

  const today = new Date().toISOString().split("T")[0]!;
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedShiftType, setSelectedShiftType] = useState<"day" | "night">("day");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: users } = useListUsers();

  // Fetch all upcoming assignments (today and future)
  const farFuture = new Date();
  farFuture.setFullYear(farFuture.getFullYear() + 2);
  const farFutureStr = farFuture.toISOString().split("T")[0]!;
  const { data: upcomingAssignments, isLoading } = useListDailyAssignments({ start: today, end: farFutureStr });

  const createAssignment = useCreateDailyAssignment();
  const deleteAssignment = useDeleteDailyAssignment();

  const activeUsers = users?.filter(u => u.isActive && u.role !== "admin") ?? [];

  // Check if user is already assigned on the selected date (any shift)
  const assignedOnSelectedDate = new Set(
    upcomingAssignments?.filter(a => a.assignedDate === selectedDate).map(a => a.userId) ?? []
  );

  const handleAssign = async () => {
    if (!selectedUserId) {
      toast({ title: "Please select a person", variant: "destructive" });
      return;
    }
    const uid = parseInt(selectedUserId);
    if (assignedOnSelectedDate.has(uid)) {
      toast({ title: "This person is already assigned on this date", variant: "destructive" });
      return;
    }
    try {
      await createAssignment.mutateAsync({
        data: {
          userId: uid,
          assignedDate: selectedDate,
          shiftType: selectedShiftType,
          notes: notes || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListDailyAssignmentsQueryKey() });
      setSelectedUserId("");
      setNotes("");
      toast({ title: "Assignment created" });
    } catch {
      toast({ title: "Failed to create assignment", variant: "destructive" });
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await deleteAssignment.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListDailyAssignmentsQueryKey() });
      toast({ title: "Assignment removed" });
    } catch {
      toast({ title: "Failed to remove assignment", variant: "destructive" });
    }
  };

  const sortedAssignments = [...(upcomingAssignments ?? [])].sort((a, b) => {
    if (a.assignedDate !== b.assignedDate) return a.assignedDate.localeCompare(b.assignedDate);
    if (a.shiftType !== b.shiftType) return a.shiftType === "day" ? -1 : 1;
    return a.lastName.localeCompare(b.lastName);
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assign to Shift</h1>
          <p className="text-muted-foreground mt-1">Assign any personnel to a specific date and shift type.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-[340px_1fr]">
          {isAdminOrSgt && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">New Assignment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    min={today}
                    onChange={e => setSelectedDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Shift Type</Label>
                  <Select value={selectedShiftType} onValueChange={v => setSelectedShiftType(v as "day" | "night")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day Shift</SelectItem>
                      <SelectItem value="night">Night Shift</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Personnel</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a person…" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeUsers
                        .slice()
                        .sort((a, b) => a.lastName.localeCompare(b.lastName))
                        .map(u => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.firstName} {u.lastName}
                            {u.role === "reserve" ? " (Reserve)" : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    placeholder="e.g. Covering for sick call"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleAssign}
                  disabled={createAssignment.isPending || !selectedUserId}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  {createAssignment.isPending ? "Assigning…" : "Assign to Shift"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Upcoming assignments list */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Upcoming Assignments</span>
                {!isLoading && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {sortedAssignments.length} total
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : sortedAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">No upcoming assignments.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {sortedAssignments.map((a: DailyAssignment) => (
                    <li key={a.id} className="flex items-center gap-3 py-3">
                      <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-x-4 items-center sm:grid-cols-[180px_auto_1fr_auto]">
                        {/* Date */}
                        <span className="text-sm font-medium text-foreground">
                          {formatDate(a.assignedDate)}
                        </span>
                        {/* Shift type badge */}
                        <ShiftTypeBadge type={a.shiftType} />
                        {/* Name + role */}
                        <div className="hidden sm:flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {a.firstName} {a.lastName}
                            </span>
                            <RoleBadge role={a.role} />
                            {a.notes && (
                              <span className="text-xs text-muted-foreground truncate">{a.notes}</span>
                            )}
                          </div>
                          {a.createdByFirstName && (
                            <span className="text-xs text-muted-foreground">
                              Added by {a.createdByFirstName} {a.createdByLastName}
                            </span>
                          )}
                        </div>
                        {/* Mobile: name below date row */}
                        <div className="sm:hidden col-span-2 mt-1 flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{a.firstName} {a.lastName}</span>
                            <RoleBadge role={a.role} />
                          </div>
                          {a.createdByFirstName && (
                            <span className="text-xs text-muted-foreground">
                              Added by {a.createdByFirstName} {a.createdByLastName}
                            </span>
                          )}
                        </div>
                      </div>
                      {isAdminOrSgt && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => handleRemove(a.id)}
                          disabled={deleteAssignment.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
