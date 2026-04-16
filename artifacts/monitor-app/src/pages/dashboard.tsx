import {
  useGetDashboardSummary,
  useDeleteWebsite,
  useGetDashboardTrends,
  getGetDashboardSummaryQueryKey,
  getGetDashboardTrendsQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  Clock,
  Globe,
  Link2,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Download,
  CheckCircle2,
  User,
} from "lucide-react";
import { intervalLabel } from "@/lib/monitoring";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { WebsiteStatus } from "@workspace/api-client-react";
import { TrendChart } from "@/components/trend-chart";
import { useMemo, useState } from "react";

interface DashboardActivityItem {
  websiteId: number;
  websiteName: string;
  url: string;
  changedAt: string | null;
  previousStatus?: number | null;
  newStatus?: number | null;
  previousIssueType?: string | null;
  newIssueType?: string | null;
  changeType: "recovered" | "reclassified" | "new_server_error" | "new_not_found";
}

interface DashboardWebsiteHealth {
  websiteId: number;
  websiteName: string;
  ownerName: string;
  priority: "low" | "medium" | "high";
  tags: string[];
  alertDestinations: string[];
  checkIntervalMinutes: number;
  totalUrls: number;
  trackedIssueUrls: number;
  notFoundUrls: number;
  serverErrorUrls: number;
  recentIntroducedCount: number;
  recentRecoveredCount: number;
  recentServerErrorCount: number;
  lastCheckedAt: string | null;
  status: string;
}

interface DashboardInsights {
  recentActivity: DashboardActivityItem[];
  needsAttention: DashboardWebsiteHealth[];
  websiteHealth: DashboardWebsiteHealth[];
}

type DashboardFilter =
  | "all"
  | "has_issues"
  | "new_today"
  | "recovered_today"
  | "unchecked_recently"
  | "server_errors";

function getActivityLabel(item: DashboardActivityItem): string {
  switch (item.changeType) {
    case "recovered":
      return "Recovered";
    case "reclassified":
      return `${item.previousStatus ?? "?"} -> ${item.newStatus ?? "?"}`;
    case "new_server_error":
      return "New 5xx";
    case "new_not_found":
    default:
      return "New 404";
  }
}

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({
    query: {
      refetchInterval: 30000,
      queryKey: getGetDashboardSummaryQueryKey(),
    },
  });
  const { data: insights, isLoading: loadingInsights } = useQuery({
    queryKey: ["dashboard-insights"],
    queryFn: () => customFetch<DashboardInsights>("/api/dashboard/insights"),
    refetchInterval: 30000,
  });
  const deleteWebsite = useDeleteWebsite();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [trendDays, setTrendDays] = useState(7);
  const [dashboardFilter, setDashboardFilter] =
    useState<DashboardFilter>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const { data: trends, isLoading: loadingTrends } = useGetDashboardTrends(
    { days: trendDays },
    {
      query: {
        refetchInterval: 300000,
        queryKey: getGetDashboardTrendsQueryKey(),
      },
    },
  );

  const websiteHealth = insights?.websiteHealth ?? [];
  const uniqueTags = useMemo(
    () =>
      Array.from(
        new Set(websiteHealth.flatMap((website) => website.tags ?? [])),
      ).sort(),
    [websiteHealth],
  );

  const filteredWebsites = useMemo(() => {
    return websiteHealth.filter((website) => {
      const tagMatches =
        selectedTag === "all" || website.tags.includes(selectedTag);

      if (!tagMatches) return false;

      switch (dashboardFilter) {
        case "has_issues":
          return website.trackedIssueUrls > 0;
        case "new_today":
          return website.recentIntroducedCount > 0;
        case "recovered_today":
          return website.recentRecoveredCount > 0;
        case "unchecked_recently":
          if (!website.lastCheckedAt) return true;
          return Date.now() - new Date(website.lastCheckedAt).getTime() >
            24 * 60 * 60 * 1000;
        case "server_errors":
          return website.serverErrorUrls > 0;
        case "all":
        default:
          return true;
      }
    });
  }, [dashboardFilter, selectedTag, websiteHealth]);

  const handleDelete = (id: number) => {
    deleteWebsite.mutate(
      { id },
      {
        onSuccess: () => {
          toast({
            title: "Website removed",
            description: "The website has been removed from monitoring.",
          });
          queryClient.invalidateQueries({
            queryKey: getGetDashboardSummaryQueryKey(),
          });
          queryClient.invalidateQueries({ queryKey: ["dashboard-insights"] });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to remove website.",
            variant: "destructive",
          });
        },
      },
    );
  };

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
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Checking
          </Badge>
        );
      case WebsiteStatus.pending:
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const exportCsv = () => {
    window.open("/api/dashboard/export.csv", "_blank", "noopener,noreferrer");
  };
  const sectionNavigation = [
    { id: "dashboard-overview", label: "Overview" },
    { id: "dashboard-activity", label: "Recent Changes" },
    { id: "dashboard-attention", label: "Needs Attention" },
    { id: "dashboard-trends", label: "Trends" },
    { id: "dashboard-health", label: "Health Table" },
  ];

  return (
    <div className="space-y-8 overflow-x-hidden">
      <div
        id="dashboard-overview"
        className="scroll-mt-28 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground mb-2">
            System Status
          </h1>
          <p className="text-muted-foreground">
            See what changed today, which properties need attention first, and who
            owns each SEO-critical surface.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} className="font-mono text-xs">
          <Download className="mr-2 h-4 w-4" />
          EXPORT CSV
        </Button>
      </div>

      <div className="sticky top-0 z-30 -mx-1 pb-2 pt-1">
        <div className="rounded-2xl bg-gradient-to-b from-background via-background/92 to-transparent px-1 pb-2">
          <div className="overflow-x-auto">
            <div className="inline-flex min-w-full items-center gap-2 rounded-2xl border border-border/70 bg-background/90 px-3 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.24)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <span className="shrink-0 pl-1 text-[11px] font-mono uppercase tracking-[0.24em] text-muted-foreground">
              Dashboard
            </span>
            {sectionNavigation.map((section) => (
              <Button
                key={section.id}
                variant="ghost"
                size="sm"
                className="shrink-0 rounded-full px-3 text-xs font-mono text-muted-foreground hover:bg-primary/10 hover:text-primary"
                onClick={() => {
                  document.getElementById(section.id)?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
              >
                {section.label}
              </Button>
            ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "TOTAL WEBSITES", value: summary?.totalWebsites || 0, icon: Globe },
          { label: "URLS MONITORED", value: summary?.totalUrls || 0, icon: Link2 },
          {
            label: "TRACKED ISSUES",
            value: summary?.totalTrackedIssues || summary?.totalBroken || 0,
            icon: AlertTriangle,
          },
          { label: "404 URLS", value: summary?.totalNotFound || 0, icon: AlertTriangle },
          { label: "5XX URLS", value: summary?.totalServerErrors || 0, icon: Activity },
          {
            label: "RECOVERED TODAY",
            value: summary?.totalRecoveredRecent || 0,
            icon: CheckCircle2,
          },
        ].map(({ label, value, icon: Icon }, index) => (
          <Card key={label + index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium font-mono text-muted-foreground">
                {label as string}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? (
                <Skeleton className="h-8 w-[100px]" />
              ) : (
                <div className="text-2xl font-bold">{value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card id="dashboard-activity" className="scroll-mt-28">
          <CardHeader>
            <CardTitle className="font-mono text-base">Recent Changes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingInsights ? (
              [1, 2, 3, 4].map((index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))
            ) : insights?.recentActivity.length ? (
              insights.recentActivity.slice(0, 6).map((item) => (
                <div
                  key={`${item.websiteId}-${item.url}-${item.changedAt}`}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Link
                        href={`/websites/${item.websiteId}`}
                        className="font-semibold hover:underline"
                      >
                        {item.websiteName}
                      </Link>
                      <p className="mt-1 font-mono text-xs break-all text-muted-foreground">
                        {item.url}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        item.changeType === "recovered"
                          ? "border-emerald-500/30 text-emerald-500"
                          : item.changeType === "new_server_error"
                            ? "border-amber-500/30 text-amber-500"
                            : "border-destructive/30 text-destructive"
                      }
                    >
                      {getActivityLabel(item)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.changedAt
                      ? formatDistanceToNow(new Date(item.changedAt), {
                          addSuffix: true,
                        })
                      : "Recently"}{" "}
                    • {item.previousStatus ?? "-"} {"->"} {item.newStatus ?? "-"}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No recent changes yet. Run a check to populate the feed.
              </p>
            )}
          </CardContent>
        </Card>

        <Card id="dashboard-attention" className="scroll-mt-28">
          <CardHeader>
            <CardTitle className="font-mono text-base">Needs Attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingInsights ? (
              [1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))
            ) : insights?.needsAttention.length ? (
              insights.needsAttention.slice(0, 5).map((website) => (
                <div
                  key={website.websiteId}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/websites/${website.websiteId}`}
                      className="font-semibold hover:underline"
                    >
                      {website.websiteName}
                    </Link>
                    <Badge
                      variant="outline"
                      className={
                        website.priority === "high"
                          ? "border-destructive/30 text-destructive"
                          : website.priority === "medium"
                            ? "border-amber-500/30 text-amber-500"
                            : "border-muted text-muted-foreground"
                      }
                    >
                      {website.priority}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {website.serverErrorUrls} 5xx • {website.notFoundUrls} 404 •{" "}
                    {website.recentIntroducedCount} new today
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Owner: {website.ownerName} • Alerts:{" "}
                    {website.alertDestinations.join(", ")}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Everything looks quiet right now.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div id="dashboard-trends" className="scroll-mt-28 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-mono font-bold tracking-tight">Trends</h2>
          <div className="flex gap-1">
            {[7, 30, 90].map((days) => (
              <Button
                key={days}
                variant={trendDays === days ? "default" : "outline"}
                size="sm"
                onClick={() => setTrendDays(days)}
                className="font-mono text-xs h-8"
              >
                {days}D
              </Button>
            ))}
          </div>
        </div>
        <TrendChart
          data={trends}
          isLoading={loadingTrends}
          title="Tracked Issues Over Time"
          description="404 and 5xx issue volume across all monitored websites"
        />
      </div>

      <div id="dashboard-health" className="scroll-mt-28 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-mono font-bold tracking-tight">
            Website Health Table
          </h2>
          <div className="flex flex-wrap gap-2">
            {[
              ["all", "All"],
              ["has_issues", "Has open issues"],
              ["new_today", "New today"],
              ["recovered_today", "Recovered today"],
              ["unchecked_recently", "Unchecked recently"],
              ["server_errors", "5xx present"],
            ].map(([value, label]) => (
              <Button
                key={value}
                variant={dashboardFilter === value ? "default" : "outline"}
                size="sm"
                className="font-mono text-xs"
                onClick={() => setDashboardFilter(value as DashboardFilter)}
              >
                {label}
              </Button>
            ))}
            {uniqueTags.map((tag) => (
              <Button
                key={tag}
                variant={selectedTag === tag ? "secondary" : "outline"}
                size="sm"
                className="font-mono text-xs"
                onClick={() => setSelectedTag((current) => (current === tag ? "all" : tag))}
              >
                {tag}
              </Button>
            ))}
          </div>
        </div>

        {loadingInsights ? (
          <div className="space-y-3">
            {[1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : filteredWebsites.length > 0 ? (
          <Card className="overflow-hidden border-border/70 bg-card/95">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/70 bg-muted/30 text-left">
                    <tr className="font-mono text-xs uppercase text-muted-foreground">
                      <th className="px-5 py-4">Property</th>
                      <th className="px-4 py-4">Owner</th>
                      <th className="px-4 py-4">Issues</th>
                      <th className="px-4 py-4">Alerts</th>
                      <th className="px-4 py-4">Cadence</th>
                      <th className="px-4 py-4">Last Check</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {filteredWebsites.map((website) => (
                      <tr
                        key={website.websiteId}
                        className="group transition-colors hover:bg-muted/15"
                      >
                        <td className="px-5 py-5 align-top">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/websites/${website.websiteId}`}
                                className="text-base font-semibold tracking-tight hover:text-primary hover:underline"
                              >
                                {website.websiteName}
                              </Link>
                              {getStatusBadge(website.status)}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="capitalize">
                                {website.priority}
                              </Badge>
                              {website.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="font-mono">
                                  {tag}
                                </Badge>
                              ))}
                              <span className="text-xs text-muted-foreground">
                                {website.totalUrls} monitored URLs
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5 align-top">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            <span className="font-medium text-foreground">
                              {website.ownerName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-5 align-top">
                          <div className="flex min-w-[180px] flex-wrap gap-2">
                            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2">
                              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                                404
                              </div>
                              <div className="mt-1 font-mono text-lg text-foreground">
                                {website.notFoundUrls}
                              </div>
                            </div>
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                                5xx
                              </div>
                              <div className="mt-1 font-mono text-lg text-amber-500">
                                {website.serverErrorUrls}
                              </div>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-background/50 px-3 py-2">
                              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                                Open
                              </div>
                              <div className="mt-1 font-mono text-lg text-foreground">
                                {website.trackedIssueUrls}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5 align-top">
                          <div className="flex max-w-[180px] flex-wrap gap-1.5">
                            {website.alertDestinations.length > 0 ? (
                              website.alertDestinations.map((destination) => (
                                <Badge
                                  key={destination}
                                  variant="secondary"
                                  className="font-mono"
                                >
                                  {destination}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                No alerts
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-5 align-top text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {intervalLabel(website.checkIntervalMinutes)}
                          </span>
                        </td>
                        <td className="px-4 py-5 align-top">
                          <div className="space-y-1 text-sm">
                            <p className="font-medium text-foreground">
                              {website.lastCheckedAt
                                ? formatDistanceToNow(new Date(website.lastCheckedAt), {
                                    addSuffix: true,
                                  })
                                : "Never"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {website.lastCheckedAt ? "Monitoring active" : "Waiting for first run"}
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-5 align-top text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/websites/${website.websiteId}`}>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="min-w-[76px] font-mono"
                              >
                                View
                              </Button>
                            </Link>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Remove monitoring for {website.websiteName}?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action permanently deletes the property,
                                    URLs, and history.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(website.websiteId)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <Globe className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-bold mb-2">No matching properties</h3>
              <p className="text-muted-foreground">
                Adjust the quick filters or add a new property to expand coverage.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
