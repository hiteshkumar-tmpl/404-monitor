import { Link, useLocation } from "wouter";
import {
  Activity,
  Plus,
  LayoutDashboard,
  Settings,
  Shield,
  LogOut,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isAdmin, logout } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
    } catch {
      toast({
        title: "Logout failed",
        description: "An error occurred during logout.",
        variant: "destructive",
      });
    }
  };

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Add Website", href: "/websites/add", icon: Plus },
    ...(isAdmin
      ? [
          { name: "Admin", href: "/admin", icon: Shield },
          { name: "Users", href: "/admin/users", icon: Users },
        ]
      : []),
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="w-64 border-r border-border bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Activity className="h-6 w-6 text-primary mr-3" />
          <span className="font-mono font-bold tracking-tight text-lg text-foreground">
            404_MONITOR
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-3">
            {navigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-md group transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon
                    className={cn(
                      "mr-3 h-5 w-5 flex-shrink-0",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="border-t border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-mono font-medium truncate">
                {user?.name}
              </span>
              <span className="text-xs font-mono text-muted-foreground truncate">
                {user?.email}
              </span>
            </div>
            <Badge
              variant={user?.role === "admin" ? "default" : "secondary"}
              className="font-mono text-[10px] ml-2 shrink-0"
            >
              {user?.role?.toUpperCase()}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full font-mono text-xs text-muted-foreground hover:text-destructive justify-start pl-0"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-background p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
