import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { ThemeProvider } from "@/components/theme-provider";
import Layout from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import AddWebsite from "@/pages/add-website";
import WebsiteDetails from "@/pages/website-details";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Landing from "@/pages/landing";
import SlackHelp from "@/pages/help/slack";
import TeamsHelp from "@/pages/help/teams";
import AdminDashboard from "@/pages/admin/index";
import AdminUsers from "@/pages/admin/users";
import TestPage from "@/pages/test";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (adminOnly && !isAdmin) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/landing" component={Landing} />
      <Route path="/" component={Landing} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/websites/add">
        <ProtectedRoute>
          <Layout>
            <AddWebsite />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/websites/:id">
        <ProtectedRoute>
          <Layout>
            <WebsiteDetails />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/help/slack" component={SlackHelp} />
      <Route path="/help/teams" component={TeamsHelp} />
      <Route path="/admin">
        <ProtectedRoute adminOnly>
          <Layout>
            <AdminDashboard />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute adminOnly>
          <Layout>
            <AdminUsers />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/test" component={TestPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <Router />
              <Toaster />
            </AuthProvider>
          </WouterRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
