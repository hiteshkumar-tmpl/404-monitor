import { Link } from "wouter";
import {
  useGetAdminStats,
  useGetWebsites,
  useGetUsers,
} from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  Globe,
  Link2,
  AlertTriangle,
  Users,
  Trash2,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { WebsiteStatus } from "@workspace/api-client-react";

export default function AdminDashboard() {
  const { data: stats, isLoading: loadingStats } = useGetAdminStats({
    query: { refetchInterval: 30000, queryKey: ["getAdminStats"] },
  });
  const { data: websites, isLoading: loadingWebsites } = useGetWebsites();
  const { data: users, isLoading: loadingUsers } = useGetUsers();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case WebsiteStatus.ok:
        return (
          <Badge
            className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20"
            variant="outline"
          >
            OK
          </Badge>
        );
      case WebsiteStatus.error:
        return <Badge variant="destructive">Error</Badge>;
      case WebsiteStatus.checking:
        return (
          <Badge
            className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20"
            variant="outline"
          >
            Checking
          </Badge>
        );
      case WebsiteStatus.pending:
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getUserName = (userId: number) => {
    const user = users?.find((u) => u.id === userId);
    return user?.name || "Unknown";
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-4">
        <Link href="/dashboard">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of all monitored properties and users.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-mono text-muted-foreground">
              TOTAL USERS
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-[100px]" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-mono text-muted-foreground">
              TOTAL WEBSITES
            </CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-[100px]" />
            ) : (
              <div className="text-2xl font-bold">
                {stats?.totalWebsites || 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-mono text-muted-foreground">
              URLS MONITORED
            </CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-[100px]" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalUrls || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-mono text-muted-foreground text-destructive">
              TRACKED ISSUES
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-[100px]" />
            ) : (
              <div className="text-2xl font-bold text-destructive">
                {stats?.totalTrackedIssues || stats?.totalBroken || 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-mono font-bold tracking-tight">
          All Websites
        </h2>

        {loadingWebsites ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : websites && websites.length > 0 ? (
          <div className="grid gap-3">
            {websites.map((website) => (
              <Card
                key={website.id}
                className="hover:border-primary/50 transition-colors"
              >
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-1">
                        <Link
                          href={`/websites/${website.id}`}
                          className="font-bold text-lg hover:underline truncate"
                        >
                          {website.name}
                        </Link>
                        {getStatusBadge(website.status)}
                      </div>
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground font-mono">
                        <span className="flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          {getUserName(website.userId)}
                        </span>
                        <span className="flex items-center">
                          <Link2 className="w-3 h-3 mr-1" />
                          {website.totalUrls} URLs
                        </span>
                        {(website.trackedIssueUrls || website.brokenUrls) > 0 && (
                          <span className="flex items-center text-destructive">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {website.trackedIssueUrls || website.brokenUrls} issues
                          </span>
                        )}
                        <span className="flex items-center">
                          <Activity className="w-3 h-3 mr-1" />
                          {website.lastCheckedAt
                            ? `Checked ${formatDistanceToNow(new Date(website.lastCheckedAt), { addSuffix: true })}`
                            : "Never checked"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Link href={`/websites/${website.id}`}>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="font-mono text-xs"
                        >
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Globe className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-bold mb-2">
                No properties monitored
              </h3>
              <p className="text-muted-foreground">
                No websites are currently being monitored.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
