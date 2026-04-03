import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/protected-route";
import LoginPage from "@/pages/login";
import HomePage from "@/pages/home";
import SchedulePage from "@/pages/schedule";
import ShiftsPage from "@/pages/shifts";
import ShiftDetailPage from "@/pages/shift-detail";
import DayOffRequestsPage from "@/pages/day-off-requests";
import UsersPage from "@/pages/users";
import NotificationsPage from "@/pages/notifications";
import AssignToShiftPage from "@/pages/assign-to-shift";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        <ProtectedRoute>
          <HomePage />
        </ProtectedRoute>
      </Route>
      <Route path="/schedule">
        <ProtectedRoute>
          <SchedulePage />
        </ProtectedRoute>
      </Route>
      <Route path="/shifts">
        <ProtectedRoute allowedRoles={["admin"]}>
          <ShiftsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/shifts/:id">
        <ProtectedRoute allowedRoles={["admin"]}>
          <ShiftDetailPage />
        </ProtectedRoute>
      </Route>
      <Route path="/day-off-requests">
        <ProtectedRoute allowedRoles={["admin", "sergeant", "deputy"]}>
          <DayOffRequestsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/users">
        <ProtectedRoute allowedRoles={["admin"]}>
          <UsersPage />
        </ProtectedRoute>
      </Route>
      <Route path="/notifications">
        <ProtectedRoute>
          <NotificationsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/assign-to-shift">
        <ProtectedRoute>
          <AssignToShiftPage />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
