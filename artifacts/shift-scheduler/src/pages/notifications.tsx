import {
  useListNotifications, getListNotificationsQueryKey,
  useMarkNotificationRead, useMarkAllNotificationsRead,
  type Notification,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellOff, CheckCheck, Check } from "lucide-react";

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: notifications, isLoading } = useListNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const all = (notifications ?? []) as Notification[];
  const unread = all.filter((n) => !n.isRead);
  const read = all.filter((n) => n.isRead);

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

  function NotificationRow({ n }: { n: Notification }) {
    return (
      <div
        className={`flex items-start gap-3 py-2.5 px-3 rounded-md transition-colors ${!n.isRead ? "bg-primary/5" : "hover:bg-muted/40"}`}
        data-testid={`notification-item-${n.id}`}
      >
        <div className="mt-1.5 shrink-0">
          {n.isRead
            ? <div className="w-2 h-2 rounded-full bg-border" />
            : <div className="w-2 h-2 rounded-full bg-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-snug ${n.isRead ? "text-muted-foreground" : "font-medium text-foreground"}`}>
            {n.message}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(n.createdAt).toLocaleString()}
          </p>
        </div>
        {!n.isRead && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
            onClick={() => handleMarkRead(n.id)}
            disabled={markRead.isPending}
            title="Mark as read"
            data-testid={`btn-mark-read-${n.id}`}
          >
            <Check className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Notifications
            {unread.length > 0 && (
              <span className="ml-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full align-middle">
                {unread.length}
              </span>
            )}
          </h1>
          {unread.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAll}
              disabled={markAllRead.isPending}
              data-testid="btn-mark-all-read"
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-2">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
          </div>
        ) : all.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <BellOff className="w-10 h-10 opacity-30" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Unread */}
            {unread.length > 0 && (
              <Card className="border-card-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
                    <Bell className="w-3.5 h-3.5" /> Unread
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-3 pb-3">
                  <div className="grid sm:grid-cols-2 gap-1">
                    {unread.map((n) => <NotificationRow key={n.id} n={n} />)}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Read */}
            {read.length > 0 && (
              <Card className="border-card-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
                    <CheckCheck className="w-3.5 h-3.5" /> Read
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 px-3 pb-3">
                  <div className="grid sm:grid-cols-2 gap-1">
                    {read.map((n) => <NotificationRow key={n.id} n={n} />)}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
