import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/protected-route";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import SchedulePage from "@/pages/schedule";
import ShiftsPage from "@/pages/shifts";
import ShiftDetailPage from "@/pages/shift-detail";
import DayOffRequestsPage from "@/pages/day-off-requests";
import UsersPage from "@/pages/users";
import NotificationsPage from "@/pages/notifications";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 403) return false;
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
          <DashboardPage />
        </ProtectedRoute>
      </Route>
      <Route path="/schedule">
        <ProtectedRoute>
          <SchedulePage />
        </ProtectedRoute>
      </Route>
      <Route path="/shifts">
        <ProtectedRoute>
          <ShiftsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/shifts/:id">
        <ProtectedRoute>
          <ShiftDetailPage />
        </ProtectedRoute>
      </Route>
      <Route path="/day-off-requests">
        <ProtectedRoute>
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
