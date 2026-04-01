import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useListNotifications } from "@workspace/api-client-react";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarFooter, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem, 
  SidebarProvider, 
  SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar";
import { LayoutDashboard, Calendar, Shield, CalendarOff, Bell, Users, LogOut, ShieldAlert } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const { data: notifications } = useListNotifications();
  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  return (
    <SidebarProvider>
      <div className="min-h-[100dvh] flex w-full bg-background">
        <Sidebar className="border-sidebar-border shadow-md">
          <SidebarHeader className="border-b border-sidebar-border pb-4 pt-6 px-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 p-2 rounded-md border border-primary/30">
                <ShieldAlert className="w-6 h-6 text-sidebar-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sidebar-foreground uppercase tracking-wider text-sm">Putnam County</span>
                <span className="text-xs text-sidebar-foreground/70 uppercase tracking-widest">Sheriff's Dept</span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/"}>
                      <Link href="/" data-testid="nav-dashboard">
                        <LayoutDashboard />
                        <span>Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/schedule"}>
                      <Link href="/schedule" data-testid="nav-schedule">
                        <Calendar />
                        <span>Schedule</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.startsWith("/shifts")}>
                      <Link href="/shifts" data-testid="nav-shifts">
                        <Shield />
                        <span>Shifts</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/day-off-requests"}>
                      <Link href="/day-off-requests" data-testid="nav-requests">
                        <CalendarOff />
                        <span>Day-Off Requests</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/notifications"}>
                      <Link href="/notifications" data-testid="nav-notifications">
                        <Bell />
                        <span>Notifications</span>
                        {unreadCount > 0 && (
                          <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {unreadCount}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  
                  {user?.role === "admin" && (
                    <SidebarMenuItem className="mt-4 pt-4 border-t border-sidebar-border/50">
                      <SidebarMenuButton asChild isActive={location === "/users"}>
                        <Link href="/users" data-testid="nav-users">
                          <Users />
                          <span>Personnel</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="h-9 w-9 bg-sidebar-accent border border-sidebar-border">
                <AvatarFallback className="bg-transparent text-sidebar-accent-foreground font-semibold">
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-sidebar-foreground">{user?.firstName} {user?.lastName}</span>
                <span className="text-xs text-sidebar-foreground/70 capitalize">{user?.role}</span>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full justify-start text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => logout()}
              data-testid="btn-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </SidebarFooter>
        </Sidebar>
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 border-b border-border bg-card flex items-center px-4 md:hidden shadow-sm z-10 sticky top-0">
            <SidebarTrigger />
            <div className="ml-3 font-semibold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" />
              <span className="uppercase tracking-wider text-sm">Putnam County Sheriff</span>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-background p-4 md:p-6 lg:p-8">
            <div className="max-w-6xl mx-auto w-full h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
