import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetShift, getGetShiftQueryKey,
  useListUsers,
  useCreateShiftAssignment, useDeleteShiftAssignment, useUpdateShift,
  getListShiftsQueryKey, getGetScheduleQueryKey,
  type ShiftMember, type User,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, UserPlus, Trash2, UserCog } from "lucide-react";
import { sortByRole } from "@/lib/utils";

export default function ShiftDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [changeSgtOpen, setChangeSgtOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedSgtId, setSelectedSgtId] = useState("");

  const shift = useGetShift(id, {
    query: { enabled: !!id, queryKey: getGetShiftQueryKey(id) }
  });

  const allUsers = useListUsers();

  const createAssignment = useCreateShiftAssignment();
  const deleteAssignment = useDeleteShiftAssignment();
  const updateShift = useUpdateShift();

  const canManage =
    user?.role === "admin" ||
    (user?.role === "sergeant" && shift.data?.sergeantId === user?.id);

  const assignedUserIds = new Set(shift.data?.members?.map((m: ShiftMember) => m.userId));

  const unassignedUsers = allUsers.data?.filter(
    (u: User) => u.isActive && !assignedUserIds.has(u.id) && u.role !== "admin"
  ) ?? [];

  const sergeantCandidates = allUsers.data?.filter(
    (u: User) => u.isActive && (u.role === "sergeant" || u.role === "admin")
  ) ?? [];

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    try {
      await createAssignment.mutateAsync({ data: { userId: parseInt(selectedUserId), shiftId: id } });
      queryClient.invalidateQueries({ queryKey: getGetShiftQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
      setAddMemberOpen(false);
      setSelectedUserId("");
      toast({ title: "Deputy added to shift" });
    } catch {
      toast({ title: "Failed to add deputy", variant: "destructive" });
    }
  };

  const handleRemoveMember = async (assignmentId: number) => {
    try {
      await deleteAssignment.mutateAsync({ id: assignmentId });
      queryClient.invalidateQueries({ queryKey: getGetShiftQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
      toast({ title: "Deputy removed from shift" });
    } catch {
      toast({ title: "Failed to remove deputy", variant: "destructive" });
    }
  };

  const handleChangeSgt = async () => {
    if (!selectedSgtId) return;
    try {
      await updateShift.mutateAsync({ id, data: { sergeantId: parseInt(selectedSgtId) } });
      queryClient.invalidateQueries({ queryKey: getGetShiftQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
      setChangeSgtOpen(false);
      setSelectedSgtId("");
      toast({ title: "Sergeant updated" });
    } catch {
      toast({ title: "Failed to update sergeant", variant: "destructive" });
    }
  };

  const letter = shift.data?.shiftLetter;
  const letterBadge = letter === "a" ? "bg-primary/10 text-primary border-primary/20" : "bg-amber-100 text-amber-800 border-amber-200";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/shifts">
            <Button variant="outline" size="icon" data-testid="btn-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            {shift.isLoading ? (
              <Skeleton className="h-8 w-48" />
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">{shift.data?.name}</h1>
                {letter && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${letterBadge}`}>
                    Shift {letter?.toUpperCase()}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sergeant card */}
        <Card className="border-card-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Sergeant</p>
                  <p className="font-semibold text-foreground" data-testid="text-sergeant-name">
                    {shift.isLoading ? "Loading..." : (shift.data?.sergeantName ?? "Unassigned")}
                  </p>
                </div>
              </div>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setChangeSgtOpen(true)}
                  data-testid="btn-change-sergeant"
                >
                  <UserCog className="w-4 h-4 mr-2" />
                  Change Sergeant
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Members */}
        <Card className="border-card-border">
          <CardHeader className="pb-3 flex-row items-center justify-between flex">
            <CardTitle className="text-base font-semibold">
              Personnel Roster
              <Badge variant="secondary" className="ml-2">{shift.data?.members?.length ?? 0}</Badge>
            </CardTitle>
            {canManage && (
              <Button size="sm" onClick={() => setAddMemberOpen(true)} data-testid="btn-add-member">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Deputy
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {shift.isLoading ? (
              <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
                      <th className="pb-2 pr-4">Name</th>
                      <th className="pb-2 pr-4">Role</th>
                      <th className="pb-2 pr-4">Email</th>
                      {canManage && <th className="pb-2"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shift.data?.members?.length === 0 ? (
                      <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No members assigned to this shift</td></tr>
                    ) : (
                      shift.data?.members?.map((member: ShiftMember) => (
                        <tr key={member.id} className="hover:bg-muted/30 transition-colors" data-testid={`member-row-${member.id}`}>
                          <td className="py-2.5 pr-4 font-medium text-foreground">{member.firstName} {member.lastName}</td>
                          <td className="py-2.5 pr-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                              ${member.role === "sergeant" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-muted text-muted-foreground border-border"}`}>
                              {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground text-xs">{member.email}</td>
                          {canManage && (
                            <td className="py-2.5 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveMember(member.id)}
                                data-testid={`btn-remove-member-${member.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          )}
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

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Deputy to {shift.data?.name}</DialogTitle></DialogHeader>
          <div className="py-4">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger data-testid="select-add-member">
                <SelectValue placeholder="Select a deputy..." />
              </SelectTrigger>
              <SelectContent>
                {sortByRole(unassignedUsers).map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.firstName} {u.lastName} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
            <Button onClick={handleAddMember} disabled={!selectedUserId || createAssignment.isPending} data-testid="btn-confirm-add-member">
              Add to Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Sergeant Dialog */}
      <Dialog open={changeSgtOpen} onOpenChange={setChangeSgtOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Sergeant</DialogTitle></DialogHeader>
          <div className="py-4">
            <Select value={selectedSgtId} onValueChange={setSelectedSgtId}>
              <SelectTrigger data-testid="select-sergeant">
                <SelectValue placeholder="Select a sergeant..." />
              </SelectTrigger>
              <SelectContent>
                {sortByRole(sergeantCandidates).map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.firstName} {u.lastName} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeSgtOpen(false)}>Cancel</Button>
            <Button onClick={handleChangeSgt} disabled={!selectedSgtId || updateShift.isPending} data-testid="btn-confirm-sergeant">
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
