import { useState } from "react";
import {
  useListDayOffRequests, getListDayOffRequestsQueryKey,
  useCreateDayOffRequest, useApproveDayOffRequest, useDenyDayOffRequest,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock } from "lucide-react";

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
  const label = REQUEST_TYPE_LABELS[type] ?? type;
  const color = colors[type] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string; Icon: React.ElementType }> = {
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 border-yellow-200", Icon: Clock },
    approved: { label: "Approved", className: "bg-green-100 text-green-800 border-green-200", Icon: CheckCircle },
    denied: { label: "Denied", className: "bg-red-100 text-red-800 border-red-200", Icon: XCircle },
  };
  const { label, className, Icon } = configs[status] ?? configs.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${className}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

export default function DayOffRequestsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [date, setDate] = useState("");
  const [requestType, setRequestType] = useState("pto");
  const [reason, setReason] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "deny">("approve");
  const [reviewNotes, setReviewNotes] = useState("");

  const isSergeantOrAdmin = user?.role === "sergeant" || user?.role === "admin";

  const myRequests = useListDayOffRequests(
    { userId: user?.id },
    { query: { queryKey: getListDayOffRequestsQueryKey({ userId: user?.id }) } }
  );

  const pendingRequests = useListDayOffRequests(
    isSergeantOrAdmin ? { status: "pending", shiftId: user?.shiftId ?? undefined } : undefined,
    {
      query: {
        enabled: isSergeantOrAdmin,
        queryKey: getListDayOffRequestsQueryKey({ status: "pending", shiftId: user?.shiftId ?? undefined }),
      }
    }
  );

  const createRequest = useCreateDayOffRequest();
  const approveRequest = useApproveDayOffRequest();
  const denyRequest = useDenyDayOffRequest();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !reason) return;
    try {
      await createRequest.mutateAsync({ data: { requestedDate: date, requestType, reason } });
      queryClient.invalidateQueries({ queryKey: getListDayOffRequestsQueryKey({ userId: user?.id }) });
      setDate("");
      setRequestType("pto");
      setReason("");
      toast({ title: "Day-off request submitted" });
    } catch {
      toast({ title: "Failed to submit request", variant: "destructive" });
    }
  };

  const openReview = (id: number, action: "approve" | "deny") => {
    setReviewingId(id);
    setReviewAction(action);
    setReviewNotes("");
    setReviewOpen(true);
  };

  const handleReview = async () => {
    if (!reviewingId) return;
    try {
      if (reviewAction === "approve") {
        await approveRequest.mutateAsync({ id: reviewingId, data: { notes: reviewNotes || undefined } });
        toast({ title: "Request approved" });
      } else {
        await denyRequest.mutateAsync({ id: reviewingId, data: { notes: reviewNotes || undefined } });
        toast({ title: "Request denied" });
      }
      queryClient.invalidateQueries({ queryKey: getListDayOffRequestsQueryKey({ status: "pending", shiftId: user?.shiftId ?? undefined }) });
      queryClient.invalidateQueries({ queryKey: getListDayOffRequestsQueryKey({ userId: user?.id }) });
      setReviewOpen(false);
    } catch {
      toast({ title: `Failed to ${reviewAction} request`, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Day-Off Requests</h1>

        {/* Submit form */}
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Submit a Request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="request-date">Requested Date</Label>
                  <Input
                    id="request-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    min={new Date().toISOString().split("T")[0]}
                    data-testid="input-request-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Request Type</Label>
                  <Select value={requestType} onValueChange={setRequestType}>
                    <SelectTrigger data-testid="select-request-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pto">PTO</SelectItem>
                      <SelectItem value="training">Training</SelectItem>
                      <SelectItem value="sick_leave">Sick Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="request-reason">Reason</Label>
                <Textarea
                  id="request-reason"
                  placeholder="Brief reason for the day off..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  rows={3}
                  data-testid="input-request-reason"
                />
              </div>
              <Button type="submit" disabled={createRequest.isPending} data-testid="btn-submit-request">
                {createRequest.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="mine">
          <TabsList data-testid="tabs-requests">
            <TabsTrigger value="mine" data-testid="tab-my-requests">My Requests</TabsTrigger>
            {isSergeantOrAdmin && (
              <TabsTrigger value="pending" data-testid="tab-pending-approval">
                Pending Approval
                {(pendingRequests.data?.length ?? 0) > 0 && (
                  <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {pendingRequests.data?.length}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="mine" className="mt-4">
            <Card className="border-card-border">
              <CardContent className="pt-4">
                {myRequests.isLoading ? (
                  <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
                          <th className="pb-2 pr-4">Date</th>
                          <th className="pb-2 pr-4">Type</th>
                          <th className="pb-2 pr-4">Reason</th>
                          <th className="pb-2 pr-4">Status</th>
                          <th className="pb-2">Submitted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {myRequests.data?.length === 0 ? (
                          <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No requests submitted</td></tr>
                        ) : (
                          myRequests.data?.map((req) => (
                            <tr key={req.id} className="hover:bg-muted/30 transition-colors" data-testid={`my-request-row-${req.id}`}>
                              <td className="py-2.5 pr-4 font-medium text-foreground">{req.requestedDate}</td>
                              <td className="py-2.5 pr-4"><RequestTypeBadge type={req.requestType} /></td>
                              <td className="py-2.5 pr-4 text-muted-foreground max-w-xs truncate">{req.reason}</td>
                              <td className="py-2.5 pr-4"><StatusBadge status={req.status} /></td>
                              <td className="py-2.5 text-muted-foreground text-xs">
                                {new Date(req.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isSergeantOrAdmin && (
            <TabsContent value="pending" className="mt-4">
              <Card className="border-card-border">
                <CardContent className="pt-4">
                  {pendingRequests.isLoading ? (
                    <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border">
                            <th className="pb-2 pr-4">Deputy</th>
                            <th className="pb-2 pr-4">Date</th>
                            <th className="pb-2 pr-4">Type</th>
                            <th className="pb-2 pr-4">Reason</th>
                            <th className="pb-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {pendingRequests.data?.length === 0 ? (
                            <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No pending requests</td></tr>
                          ) : (
                            pendingRequests.data?.map((req) => (
                              <tr key={req.id} className="hover:bg-muted/30 transition-colors" data-testid={`pending-request-row-${req.id}`}>
                                <td className="py-2.5 pr-4 font-medium text-foreground">
                                  {req.requesterFirstName} {req.requesterLastName}
                                </td>
                                <td className="py-2.5 pr-4">{req.requestedDate}</td>
                                <td className="py-2.5 pr-4"><RequestTypeBadge type={req.requestType} /></td>
                                <td className="py-2.5 pr-4 text-muted-foreground max-w-xs truncate">{req.reason}</td>
                                <td className="py-2.5">
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-green-700 border-green-300 hover:bg-green-50"
                                      onClick={() => openReview(req.id, "approve")}
                                      data-testid={`btn-approve-${req.id}`}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-700 border-red-300 hover:bg-red-50"
                                      onClick={() => openReview(req.id, "deny")}
                                      data-testid={`btn-deny-${req.id}`}
                                    >
                                      Deny
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewAction === "approve" ? "Approve Request" : "Deny Request"}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder={reviewAction === "approve" ? "Optional approval notes..." : "Reason for denial..."}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              data-testid="input-review-notes"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
            <Button
              onClick={handleReview}
              disabled={approveRequest.isPending || denyRequest.isPending}
              variant={reviewAction === "deny" ? "destructive" : "default"}
              data-testid="btn-confirm-review"
            >
              {reviewAction === "approve" ? "Approve" : "Deny"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
