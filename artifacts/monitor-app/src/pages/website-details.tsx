import { useEffect, useState } from "react";
import { useParams } from "wouter";
import {
  useGetWebsite,
  useGetWebsiteUrls,
  useTriggerCheck,
  useUpdateWebsite,
  useGetWebsiteSitemaps,
  useAddSitemap,
  useDeleteSitemap,
  useGetWebsiteHistory,
  useRefreshSitemap,
  useDeleteUrl,
  customFetch,
  getGetWebsiteQueryKey,
  getGetWebsiteUrlsQueryKey,
  getGetWebsiteSitemapsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetWebsitesQueryKey,
  getGetWebsiteHistoryQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { WebsiteStatus } from "@workspace/api-client-react";
import {
  INTERVAL_OPTIONS,
  PROPERTY_SETUP_NOTICE_KEY,
  intervalLabel,
  type PropertySetupNotice,
} from "@/lib/monitoring";
import {
  filterUrlsForView,
  getUrlChangeLabel,
  type WebsiteFilter,
  type WebsiteSummaryData,
} from "@/lib/website-triage";
import { WebsiteTrendChart } from "@/components/trend-chart";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export default function WebsiteDetails() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<WebsiteFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [checkResult, setCheckResult] = useState<{
    message: string;
    newIssues: number;
    checked: number;
  } | null>(null);
  const [setupNotice, setSetupNotice] = useState<PropertySetupNotice | null>(
    null,
  );

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editOwnerName, setEditOwnerName] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editTags, setEditTags] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSitemapUrl, setEditSitemapUrl] = useState("");
  const [editAlertEmail, setEditAlertEmail] = useState("");
  const [editIntervalMinutes, setEditIntervalMinutes] = useState(60);
  const [editSlackWebhookUrl, setEditSlackWebhookUrl] = useState("");
  const [editSlackAlertEnabled, setEditSlackAlertEnabled] = useState(false);
  const [editSlackRealtimeAlerts, setEditSlackRealtimeAlerts] = useState(true);
  const [editTeamsWebhookUrl, setEditTeamsWebhookUrl] = useState("");
  const [editTeamsAlertEnabled, setEditTeamsAlertEnabled] = useState(false);
  const [editTeamsRealtimeAlerts, setEditTeamsRealtimeAlerts] = useState(true);
  const [editAlertSummaryInterval, setEditAlertSummaryInterval] =
    useState<string>("none");
  const [editCustomSummaryDays, setEditCustomSummaryDays] = useState<
    number | undefined
  >(undefined);

  // Add sitemap state
  const [showAddSitemap, setShowAddSitemap] = useState(false);
  const [newSitemapUrl, setNewSitemapUrl] = useState("");

  // Trends state
  const [trendDays, setTrendDays] = useState(7);

  // Delete URL dialog state
  const [showDeleteUrlDialog, setShowDeleteUrlDialog] = useState(false);
  const [urlToDelete, setUrlToDelete] = useState<{
    id: number;
    url: string;
  } | null>(null);

  const { data: website, isLoading: loadingWebsite } = useGetWebsite(id, {
    query: {
      enabled: !!id,
      queryKey: getGetWebsiteQueryKey(id),
      refetchInterval: 30000,
    },
  });

  const { data: urls, isLoading: loadingUrls } = useGetWebsiteUrls(
    id,
    {
      status:
        statusFilter === "trends"
          ? undefined
          : (statusFilter as
              | "all"
              | "broken"
              | "not_found"
              | "server_error"
              | "ok"
              | undefined),
    },
    {
      query: {
        enabled: !!id && statusFilter !== "trends",
        queryKey: getGetWebsiteUrlsQueryKey(id, {
          status:
            statusFilter === "trends"
              ? undefined
              : (statusFilter as
                  | "all"
                  | "broken"
                  | "not_found"
                  | "server_error"
                  | "ok"
                  | undefined),
        }),
        refetchInterval: 30000,
      },
    },
  );

  const { data: sitemaps, isLoading: loadingSitemaps } = useGetWebsiteSitemaps(
    id,
    {
      query: {
        enabled: !!id,
        queryKey: getGetWebsiteSitemapsQueryKey(id),
        refetchInterval: 30000,
      },
    },
  );

  const { data: websiteHistory, isLoading: loadingHistory } =
    useGetWebsiteHistory(
      id,
      { days: trendDays },
      {
        query: {
          enabled: !!id,
          queryKey: getGetWebsiteHistoryQueryKey(id, { days: trendDays }),
          refetchInterval: 300000,
        },
      },
    );

  const { data: summaryData, isLoading: loadingSummaryData } = useQuery({
    queryKey: ["website-summary-data", id, trendDays],
    enabled: !!id,
    queryFn: async (): Promise<WebsiteSummaryData> => {
      return customFetch<WebsiteSummaryData>(
        `/api/websites/${id}/summary-data?days=${trendDays}`,
      );
    },
    refetchInterval: 300000,
  });

  const triggerCheck = useTriggerCheck();
  const updateWebsite = useUpdateWebsite();
  const addSitemap = useAddSitemap();
  const deleteSitemap = useDeleteSitemap();
  const refreshSitemap = useRefreshSitemap();
  const deleteUrl = useDeleteUrl();

  useEffect(() => {
    const rawNotice = sessionStorage.getItem(PROPERTY_SETUP_NOTICE_KEY);
    if (!rawNotice) return;

    try {
      const parsed = JSON.parse(rawNotice) as PropertySetupNotice;
      if (parsed.websiteId === id) {
        setSetupNotice(parsed);
        sessionStorage.removeItem(PROPERTY_SETUP_NOTICE_KEY);
      }
    } catch {
      sessionStorage.removeItem(PROPERTY_SETUP_NOTICE_KEY);
    }
  }, [id]);

  const handleRunCheck = () => {
    triggerCheck.mutate(
      { id },
      {
        onSuccess: (result) => {
          setCheckResult({
            message: result.message,
            newIssues:
              result.newIssueUrls ??
              result.newBrokenUrls + (result.newServerErrorUrls ?? 0),
            checked: result.checkedUrls,
          });
          toast({
            title: "Check completed",
            description: result.message,
          });
          queryClient.invalidateQueries({
            queryKey: getGetWebsiteQueryKey(id),
          });
          queryClient.invalidateQueries({
            queryKey: getGetWebsiteUrlsQueryKey(id),
          });
          queryClient.invalidateQueries({
            queryKey: getGetDashboardSummaryQueryKey(),
          });
          queryClient.invalidateQueries({ queryKey: ["dashboard-insights"] });
          queryClient.invalidateQueries({ queryKey: getGetWebsitesQueryKey() });
          queryClient.invalidateQueries({
            queryKey: ["website-summary-data", id],
          });
        },
        onError: () => {
          toast({
            title: "Check failed",
            description: "An error occurred while running the check.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleRefreshSitemap = () => {
    refreshSitemap.mutate(
      { id },
      {
        onSuccess: (result: { message: string }) => {
          toast({
            title: "Sitemap refreshed",
            description: result.message,
          });
          queryClient.invalidateQueries({
            queryKey: getGetWebsiteQueryKey(id),
          });
          queryClient.invalidateQueries({
            queryKey: getGetWebsiteUrlsQueryKey(id),
          });
          queryClient.invalidateQueries({
            queryKey: ["website-summary-data", id],
          });
        },
        onError: () => {
          toast({
            title: "Refresh failed",
            description: "An error occurred while refreshing the sitemap.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleDeleteUrl = (urlId: number, url: string) => {
    setUrlToDelete({ id: urlId, url });
    setShowDeleteUrlDialog(true);
  };

  const confirmDeleteUrl = () => {
    if (!urlToDelete) return;

    deleteUrl.mutate(
      { id, urlId: urlToDelete.id },
      {
        onSuccess: () => {
          toast({
            title: "URL removed",
            description: "This URL will no longer be tracked.",
          });
          queryClient.invalidateQueries({
            queryKey: getGetWebsiteQueryKey(id),
          });
          queryClient.invalidateQueries({
            queryKey: getGetWebsiteUrlsQueryKey(id),
          });
          queryClient.invalidateQueries({ queryKey: getGetWebsitesQueryKey() });
          queryClient.invalidateQueries({
            queryKey: getGetDashboardSummaryQueryKey(),
          });
          queryClient.invalidateQueries({ queryKey: ["dashboard-insights"] });
          queryClient.invalidateQueries({
            queryKey: ["website-summary-data", id],
          });
          setShowDeleteUrlDialog(false);
          setUrlToDelete(null);
        },
        onError: () => {
          toast({
            title: "Delete failed",
            description: "An error occurred while removing the URL.",
            variant: "destructive",
          });
          setShowDeleteUrlDialog(false);
          setUrlToDelete(null);
        },
      },
    );
  };

  const openEdit = () => {
    if (!website) return;
    setEditName(website.name);
    setEditOwnerName(website.ownerName ?? "");
    setEditPriority(website.priority ?? "medium");
    setEditTags((website.tags ?? []).join(", "));
    setEditNotes(website.notes ?? "");
    setEditSitemapUrl(website.sitemapUrl);
    setEditAlertEmail(website.alertEmail);
    setEditIntervalMinutes(website.checkIntervalMinutes ?? 60);
    setEditSlackWebhookUrl(website.slackWebhookUrl ?? "");
    setEditSlackAlertEnabled(website.slackAlertEnabled ?? false);
    setEditSlackRealtimeAlerts(website.slackRealtimeAlerts ?? true);
    setEditTeamsWebhookUrl((website as any).teamsWebhookUrl ?? "");
    setEditTeamsAlertEnabled((website as any).teamsAlertEnabled ?? false);
    setEditTeamsRealtimeAlerts((website as any).teamsRealtimeAlerts ?? true);
    setEditAlertSummaryInterval(website.alertSummaryInterval ?? "none");
    setEditCustomSummaryDays((website as any).customSummaryDays ?? undefined);
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editSitemapUrl.trim()) {
      toast({ title: "Sitemap URL is required", variant: "destructive" });
      return;
    }
    updateWebsite.mutate(
      {
        id,
        data: {
          name: editName,
          ownerName: editOwnerName,
          priority: editPriority as "low" | "medium" | "high",
          tags: editTags,
          notes: editNotes,
          sitemapUrl: editSitemapUrl,
          alertEmail: editAlertEmail,
          checkIntervalMinutes: editIntervalMinutes,
          slackWebhookUrl: editSlackWebhookUrl || undefined,
          slackAlertEnabled: editSlackAlertEnabled,
          slackRealtimeAlerts: editSlackRealtimeAlerts,
          teamsWebhookUrl: editTeamsWebhookUrl || undefined,
          teamsAlertEnabled: editTeamsAlertEnabled,
          teamsRealtimeAlerts: editTeamsRealtimeAlerts,
          alertSummaryInterval: editAlertSummaryInterval as
            | "none"
            | "realtime"
            | "daily"
            | "3days"
            | "5days"
            | "7days"
            | "14days"
            | "30days"
            | "custom",
          customSummaryDays: editCustomSummaryDays,
        },
      },
      {
        onSuccess: () => {
          setEditOpen(false);
          toast({
            title: "Updated",
            description: "Website settings saved. Sitemap is being re-parsed.",
          });
          queryClient.invalidateQueries({
            queryKey: getGetWebsiteQueryKey(id),
          });
          queryClient.invalidateQueries({
            queryKey: getGetWebsiteUrlsQueryKey(id),
          });
          queryClient.invalidateQueries({ queryKey: getGetWebsitesQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["dashboard-insights"] });
          queryClient.invalidateQueries({
            queryKey: ["website-summary-data", id],
          });
        },
        onError: () => {
          toast({
            title: "Update failed",
            description: "Could not save changes.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleAddSitemap = () => {
    if (!newSitemapUrl.trim()) {
      toast({ title: "URL required", variant: "destructive" });
      return;
    }
    addSitemap.mutate(
      { id, data: { url: newSitemapUrl.trim() } },
      {
        onSuccess: () => {
          setNewSitemapUrl("");
          setShowAddSitemap(false);
          toast({
            title: "Sitemap added",
            description: "Parsing URLs in the background…",
          });
          queryClient.invalidateQueries({
            queryKey: getGetWebsiteSitemapsQueryKey(id),
          });
          queryClient.invalidateQueries({
            queryKey: getGetWebsiteUrlsQueryKey(id),
          });
          queryClient.invalidateQueries({
            queryKey: getGetWebsiteQueryKey(id),
          });
          queryClient.invalidateQueries({ queryKey: ["dashboard-insights"] });
          queryClient.invalidateQueries({
            queryKey: ["website-summary-data", id],
          });
        },
        onError: () => {
          toast({ title: "Failed to add sitemap", variant: "destructive" });
        },
      },
    );
  };

  const handleDeleteSitemap = (sitemapId: number) => {
    deleteSitemap.mutate(
      { id, sitemapId },
      {
        onSuccess: () => {
          toast({ title: "Sitemap removed" });
          queryClient.invalidateQueries({
            queryKey: getGetWebsiteSitemapsQueryKey(id),
          });
        },
        onError: () => {
          toast({ title: "Failed to remove sitemap", variant: "destructive" });
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
      case WebsiteStatus.paused:
        return (
          <Badge
            className="border-slate-400/20 bg-slate-500/10 text-slate-300 hover:bg-slate-500/20"
            variant="outline"
          >
            <Pause className="mr-1 h-3 w-3" /> Paused
          </Badge>
        );
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

  const getUrlStatusBadge = (
    statusCode: number | null | undefined,
    issueType: "not_found" | "server_error" | null | undefined,
    isTrackedIssue: boolean | undefined,
  ) => {
    if (statusCode === null || statusCode === undefined) {
      return (
        <Badge variant="secondary" className="font-mono text-xs">
          Unchecked
        </Badge>
      );
    }
    if (issueType === "not_found") {
      return (
        <Badge variant="destructive" className="font-mono text-xs">
          {statusCode}
        </Badge>
      );
    }
    if (issueType === "server_error" || isTrackedIssue) {
      return (
        <Badge
          className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20 font-mono text-xs"
          variant="outline"
        >
          {statusCode}
        </Badge>
      );
    }
    if (statusCode === 200) {
      return (
        <Badge
          className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20 font-mono text-xs"
          variant="outline"
        >
          200
        </Badge>
      );
    }
    return (
      <Badge
        className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20 font-mono text-xs"
        variant="outline"
      >
        {statusCode}
      </Badge>
    );
  };

  const triagedUrls = filterUrlsForView(
    urls ?? [],
    statusFilter,
    searchQuery,
    summaryData,
  );
  const newlyBrokenCount =
    summaryData?.recentlyNotFoundUrls?.length ??
    summaryData?.recentlyBrokenUrls.length ??
    0;
  const newlyServerErrorCount =
    summaryData?.recentlyServerErrorUrls?.length ?? 0;
  const newIssuesCount = newlyBrokenCount + newlyServerErrorCount;
  const recentlyFixedCount = summaryData?.recentlyFixedUrls.length ?? 0;
  const openIssues = summaryData?.openIssues ?? [];
  const recentTransitions = summaryData?.recentTransitions ?? [];
  const recentOpenIssuesCount = openIssues.filter((issue) =>
    (summaryData?.recentlyNotFoundUrls ?? summaryData?.recentlyBrokenUrls ?? []).includes(
      issue.url,
    ) || (summaryData?.recentlyServerErrorUrls ?? []).includes(issue.url),
  ).length;
  const recentChangesCount = recentTransitions.length || newIssuesCount + recentlyFixedCount;
  const currentOkCount = summaryData?.currentStatus.okUrls ?? 0;
  const currentNotFoundCount =
    summaryData?.currentStatus.notFoundUrls ??
    summaryData?.currentStatus.brokenUrls ??
    website?.notFoundUrls ??
    website?.brokenUrls ??
    0;
  const currentServerErrorCount =
    summaryData?.currentStatus.serverErrorUrls ?? website?.serverErrorUrls ?? 0;
  const currentTrackedIssueCount =
    summaryData?.currentStatus.trackedIssueUrls ??
    website?.trackedIssueUrls ??
    currentNotFoundCount + currentServerErrorCount;
  const groupedOpenIssues = openIssues.reduce(
    (groups, issue) => {
      const path =
        issue.url.replace(/^https?:\/\/[^/]+/, "").split("/").filter(Boolean)[0] ||
        "root";
      groups[path] = groups[path] ?? [];
      groups[path].push(issue);
      return groups;
    },
    {} as Record<string, typeof openIssues>,
  );
  const openIssueGroups = Object.entries(groupedOpenIssues).sort(
    (left, right) => right[1].length - left[1].length,
  );

  if (loadingWebsite) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!website) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-muted-foreground">
          Property not found
        </h2>
        <Link href="/dashboard">
          <Button variant="link" className="mt-4">
            Return to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const statusHeadline =
    !website.lastCheckedAt
      ? "Waiting for the first monitoring run"
      : currentTrackedIssueCount > 0
        ? `${currentTrackedIssueCount} tracked issue${currentTrackedIssueCount === 1 ? "" : "s"} need attention`
        : "All monitored URLs are healthy";
  const statusSummary =
    !website.lastCheckedAt
      ? "We have imported the property. Run the first check to generate a live health snapshot and issue history."
      : currentTrackedIssueCount > 0
        ? `${currentNotFoundCount} URLs are returning 404, ${currentServerErrorCount} are returning 5xx, and ${recentOpenIssuesCount} recent issue${recentOpenIssuesCount === 1 ? "" : "s"} are still open.`
        : `Last run completed ${formatDistanceToNow(new Date(website.lastCheckedAt), { addSuffix: true })} with ${currentOkCount} healthy URL${currentOkCount === 1 ? "" : "s"} monitored.`;
  const healthTone =
    !website.lastCheckedAt
      ? "pending"
      : currentServerErrorCount > 0
        ? "server-error"
        : currentTrackedIssueCount > 0
          ? "issue"
          : "healthy";
  const healthToneClasses = {
    pending: {
      card: "border-border bg-card",
      badge: "border-border/60 bg-muted/40 text-muted-foreground",
      accent: "text-muted-foreground",
    },
    "server-error": {
      card:
        "border-amber-500/40 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(15,23,42,0.92)_52%,rgba(15,23,42,0.98))]",
      badge: "border-amber-500/40 bg-amber-500/10 text-amber-300",
      accent: "text-amber-300",
    },
    issue: {
      card:
        "border-destructive/40 bg-[linear-gradient(135deg,rgba(239,68,68,0.12),rgba(15,23,42,0.92)_48%,rgba(15,23,42,0.98))]",
      badge: "border-destructive/40 bg-destructive/10 text-destructive",
      accent: "text-destructive",
    },
    healthy: {
      card:
        "border-emerald-500/35 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(15,23,42,0.92)_52%,rgba(15,23,42,0.98))]",
      badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
      accent: "text-emerald-300",
    },
  }[healthTone];
  const monitoringDestinations = [
    website.alertEmail ? "Email" : null,
    website.slackAlertEnabled ? "Slack" : null,
    (website as any).teamsAlertEnabled ? "Teams" : null,
  ].filter(Boolean) as string[];
  const sectionNavigation = [
    { id: "overview", label: "Overview" },
    { id: "investigation", label: "Investigation" },
    { id: "sitemaps", label: "Sitemaps" },
    { id: "triage", label: "Triage Queue" },
  ];
  const isChecking =
    triggerCheck.isPending || website.status === WebsiteStatus.checking;
  const isPaused = website.status === WebsiteStatus.paused;
  const togglePause = async (shouldPause: boolean) => {
    try {
      await customFetch(`/api/websites/${id}/${shouldPause ? "pause" : "resume"}`, {
        method: "POST",
      });
      toast({
        title: shouldPause ? "Monitoring paused" : "Monitoring resumed",
        description: shouldPause
          ? "Scheduled checks are paused for this property."
          : "This property will be checked on its normal cadence again.",
      });
      queryClient.invalidateQueries({
        queryKey: getGetWebsiteQueryKey(id),
      });
      queryClient.invalidateQueries({
        queryKey: getGetDashboardSummaryQueryKey(),
      });
      queryClient.invalidateQueries({ queryKey: ["dashboard-insights"] });
      queryClient.invalidateQueries({ queryKey: getGetWebsitesQueryKey() });
    } catch {
      toast({
        title: shouldPause ? "Pause failed" : "Resume failed",
        description: "Could not update monitoring state.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <header className="sticky top-0 z-40 -mx-1 mb-2 space-y-3 border-b border-border/60 bg-background/95 pb-3 pt-1 shadow-[0_8px_28px_rgba(0,0,0,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center space-x-4">
            <Link href="/dashboard">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="flex-1 truncate text-2xl font-mono font-bold tracking-tight text-foreground">
              {website.name}
            </h1>
            {getStatusBadge(website.status)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={openEdit}
              data-testid="button-edit-website"
              className="font-mono text-xs"
            >
              <Pencil className="mr-1.5 h-3 w-3" />
              EDIT
            </Button>
            <Button
              onClick={handleRunCheck}
              disabled={isChecking || isPaused}
              data-testid="button-run-check"
              className="font-mono font-bold"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isChecking ? "animate-spin" : ""}`}
              />
              {isChecking ? "RUNNING..." : "RUN CHECK NOW"}
            </Button>
            <Button
              onClick={() => togglePause(!isPaused)}
              variant="outline"
              className="font-mono text-xs"
            >
              {isPaused ? (
                <Play className="mr-1.5 h-3 w-3" />
              ) : (
                <Pause className="mr-1.5 h-3 w-3" />
              )}
              {isPaused ? "RESUME MONITORING" : "PAUSE MONITORING"}
            </Button>
            <Button
              onClick={handleRefreshSitemap}
              disabled={refreshSitemap.isPending}
              variant="outline"
              data-testid="button-refresh-sitemap"
              className="font-mono text-xs"
            >
              <RefreshCw
                className={`mr-1.5 h-3 w-3 ${refreshSitemap.isPending ? "animate-spin" : ""}`}
              />
              {refreshSitemap.isPending ? "REFRESHING..." : "REFRESH SITEMAP"}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full items-center gap-2 rounded-2xl border border-border/70 bg-background/90 px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.2)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <span className="shrink-0 pl-1 text-[11px] font-mono uppercase tracking-[0.24em] text-muted-foreground">
              Jump to
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
      </header>

      {checkResult && (
        <Alert
          className={
            checkResult.newIssues > 0
              ? "border-destructive bg-destructive/10"
              : "border-emerald-500/50 bg-emerald-500/10"
          }
        >
          {checkResult.newIssues > 0 ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          )}
          <AlertTitle className="font-mono">{checkResult.message}</AlertTitle>
          <AlertDescription className="text-muted-foreground mt-1">
            Checked {checkResult.checked} URLs. Found {checkResult.newIssues}{" "}
            new tracked issue{checkResult.newIssues === 1 ? "" : "s"}.
          </AlertDescription>
        </Alert>
      )}

      {isPaused ? (
        <Alert className="border-slate-400/30 bg-slate-500/5">
          <Pause className="h-4 w-4 text-slate-300" />
          <AlertTitle className="font-mono">Monitoring is paused</AlertTitle>
          <AlertDescription className="mt-1 text-muted-foreground">
            Scheduled checks are disabled for this property until you resume monitoring.
          </AlertDescription>
        </Alert>
      ) : null}

      {setupNotice && (
        <Alert className="border-primary/30 bg-primary/5">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertTitle className="font-mono">
            {setupNotice.propertyName} is now onboarding
          </AlertTitle>
          <AlertDescription className="text-muted-foreground mt-1">
            {website.totalUrls === 0
              ? `We’re parsing the sitemap and importing URLs now. The first scheduled health check will run ${intervalLabel(setupNotice.checkIntervalMinutes).toLowerCase()}. Alerts are configured for ${setupNotice.alertDestinations.join(", ")}.`
              : website.lastCheckedAt
                ? `Imported ${website.totalUrls} URLs and already completed the first check. Alerts are configured for ${setupNotice.alertDestinations.join(", ")}.`
                : `Imported ${website.totalUrls} URLs successfully. The first health check is still pending, and alerts are configured for ${setupNotice.alertDestinations.join(", ")}.`}
          </AlertDescription>
        </Alert>
      )}

      <div
        id="overview"
        className="grid scroll-mt-44 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]"
      >
        <Card className={cn("min-w-0 overflow-hidden", healthToneClasses.card)}>
          <CardContent className="p-0">
            <div className="border-b border-white/10 px-6 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn("font-mono text-[11px] uppercase tracking-[0.24em]", healthToneClasses.badge)}
                    >
                      {healthTone === "healthy"
                        ? "Healthy"
                        : healthTone === "pending"
                          ? "Pending"
                          : "Needs attention"}
                    </Badge>
                    <span className="text-xs font-mono uppercase tracking-[0.24em] text-muted-foreground">
                      Health Snapshot
                    </span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
                      {statusHeadline}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                      {statusSummary}
                    </p>
                  </div>
                </div>
                <div className="min-w-[220px] rounded-2xl border border-white/10 bg-background/40 p-4 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-mono uppercase tracking-[0.24em] text-muted-foreground">
                        Most Recent Check
                      </p>
                      <p className={cn("mt-2 text-sm font-medium", healthToneClasses.accent)}>
                        {website.lastCheckedAt
                          ? formatDistanceToNow(new Date(website.lastCheckedAt), {
                              addSuffix: true,
                            })
                          : "Not run yet"}
                      </p>
                    </div>
                    <RefreshCw
                      className={cn(
                        "h-5 w-5",
                        isChecking ? "animate-spin text-primary" : "text-muted-foreground",
                      )}
                    />
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between gap-3">
                      <span>Recent changes</span>
                      <span className="font-mono text-foreground">{recentChangesCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Healthy URLs</span>
                      <span className="font-mono text-foreground">{currentOkCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Run cadence</span>
                      <span className="font-mono text-foreground">
                        {intervalLabel(website.checkIntervalMinutes ?? 60)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 px-6 py-5 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-white/10 bg-background/35 p-4">
                <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">
                  Open Issues
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                  {currentTrackedIssueCount}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  URLs currently returning tracked issue states.
                </p>
              </div>
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">
                  404 URLs
                </p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                  {loadingSummaryData ? "..." : currentNotFoundCount}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Missing pages currently detected.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">
                  5xx URLs
                </p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                  {loadingSummaryData ? "..." : currentServerErrorCount}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Server-side failures needing review.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-background/35 p-4">
                <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">
                  New And Open
                </p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                  {loadingSummaryData ? "..." : recentOpenIssuesCount}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Recently introduced issues still open right now.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">
                  Recovered
                </p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                  {loadingSummaryData ? "..." : recentlyFixedCount}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  URLs that have returned to healthy recently.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/70 bg-card/90">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.24em] text-muted-foreground">
                  Monitoring Profile
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">
                  Property context at a glance
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={openEdit}
                className="h-8 px-2 text-xs font-mono"
              >
                <Pencil className="mr-1.5 h-3 w-3" />
                Edit
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  Sitemap
                </div>
                <a
                  href={website.sitemapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex items-start justify-between gap-3 text-sm font-medium text-primary transition-colors hover:text-primary/80"
                  title={website.sitemapUrl}
                >
                  <span className="line-clamp-2 break-all">{website.sitemapUrl}</span>
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
                </a>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                  <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">
                    Last Checked
                  </p>
                  <p className="mt-3 text-sm font-medium text-foreground">
                    {website.lastCheckedAt
                      ? format(new Date(website.lastCheckedAt), "PP p")
                      : "Never"}
                  </p>
                </div>
                <div
                  className="rounded-2xl border border-border/80 bg-background/40 p-4 transition-colors hover:border-primary/30"
                  title="Click edit to change cadence"
                >
                  <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">
                    Check Every
                  </p>
                  <p className="mt-3 text-sm font-medium text-foreground">
                    {intervalLabel(website.checkIntervalMinutes ?? 60)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                  <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">
                    Total URLs
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                    {website.totalUrls}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/80 bg-background/40 p-4">
                  <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">
                    Routed Alerts
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {monitoringDestinations.length > 0 ? (
                      monitoringDestinations.map((destination) => (
                        <Badge key={destination} variant="secondary" className="font-mono">
                          {destination}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No channels configured</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div
        id="investigation"
        className="grid scroll-mt-44 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
      >
        <Card className="min-w-0 border-border/70 bg-card/95">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="font-mono text-base">Open Issues</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Live queue of URLs that still need attention.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="shrink-0 font-mono">
                  {currentTrackedIssueCount} open
                </Badge>
                <Badge variant="secondary" className="shrink-0 font-mono">
                  {openIssueGroups.length} group{openIssueGroups.length === 1 ? "" : "s"}
                </Badge>
                <Badge variant="secondary" className="shrink-0 font-mono">
                  {website.ownerName || "Unassigned"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-background/35 px-4 py-3">
              <span className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">
                Priority
              </span>
              <Badge variant="outline" className="font-mono capitalize">
                {website.priority || "medium"}
              </Badge>
              <span className="ml-2 text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">
                Tags
              </span>
              {(website.tags ?? []).length > 0 ? (
                website.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary" className="font-mono">
                    {tag}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No tags set</span>
              )}
            </div>

            {website.notes ? (
              <div className="rounded-2xl border border-border/70 bg-background/35 px-4 py-3">
                <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground">
                  Notes
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {website.notes}
                </p>
              </div>
            ) : null}

            {openIssues.length > 0 ? (
              <div className="space-y-3">
                {openIssueGroups.map(([group, issues]) => (
                  <div
                    key={group}
                    className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-background/30"
                  >
                    <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
                          /{group}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {issues.length} open URL{issues.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className="shrink-0 border-destructive/20 text-destructive"
                        >
                          {issues.filter((issue) => issue.issueType !== "server_error").length} 404
                        </Badge>
                        <Badge
                          variant="outline"
                          className="shrink-0 border-amber-500/20 text-amber-500"
                        >
                          {issues.filter((issue) => issue.issueType === "server_error").length} 5xx
                        </Badge>
                      </div>
                    </div>

                    <div className="max-h-[320px] overflow-y-auto">
                      <div className="divide-y divide-border/70">
                        {issues.slice(0, 6).map((issue) => (
                          <div
                            key={`${group}-${issue.url}`}
                            className="flex min-w-0 flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                          >
                            <div className="min-w-0 flex-1">
                              <p
                                className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-foreground"
                                title={issue.url}
                              >
                                {issue.url}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span>Current {issue.currentStatus ?? "-"}</span>
                                <span>Previous {issue.previousStatus ?? "-"}</span>
                                <span>
                                  Checked{" "}
                                  {issue.lastCheckedAt
                                    ? formatDistanceToNow(new Date(issue.lastCheckedAt), {
                                        addSuffix: true,
                                      })
                                    : "unknown"}
                                </span>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2 self-start lg:self-center">
                              <Badge
                                variant="outline"
                                className={
                                  issue.issueType === "server_error"
                                    ? "border-amber-500/30 text-amber-500"
                                    : "border-destructive/30 text-destructive"
                                }
                              >
                                {issue.issueType === "server_error" ? "5xx" : "404"}
                              </Badge>
                              <div className="rounded-full border border-border/80 bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                                Open {issue.ageHours && issue.ageHours >= 24
                                  ? `${Math.round((issue.ageHours / 24) * 10) / 10}d`
                                  : `${issue.ageHours ?? 0}h`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-5">
                <p className="text-sm font-medium text-foreground">
                  No open issues right now.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This property is healthy and not currently returning tracked issue states.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-border/70 bg-card/95">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="font-mono text-base">What Changed</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Latest issue transitions across this property.
                </p>
              </div>
              <Badge variant="secondary" className="w-fit shrink-0 font-mono">
                {recentTransitions.length} recent event{recentTransitions.length === 1 ? "" : "s"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {recentTransitions.length > 0 ? (
              <div className="max-h-[760px] space-y-2 overflow-y-auto pr-1">
                {recentTransitions.slice(0, 12).map((transition, index) => (
                  <div
                    key={`${transition.url}-${transition.changedAt}`}
                    className="relative min-w-0 rounded-2xl border border-border/70 bg-background/30 px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex flex-col items-center">
                        <div
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            transition.changeType === "recovered"
                              ? "bg-emerald-500"
                              : transition.changeType === "new_server_error"
                                ? "bg-amber-500"
                                : "bg-destructive",
                          )}
                        />
                        {index < Math.min(recentTransitions.length, 12) - 1 ? (
                          <div className="mt-2 h-10 w-px bg-border/80" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <p
                              className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-foreground"
                              title={transition.url}
                            >
                              {transition.url}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {transition.changedAt
                                ? formatDistanceToNow(new Date(transition.changedAt), {
                                    addSuffix: true,
                                  })
                                : "Recently"}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0",
                              transition.changeType === "recovered"
                                ? "border-emerald-500/30 text-emerald-500"
                                : transition.changeType === "new_server_error"
                                  ? "border-amber-500/30 text-amber-500"
                                  : "border-destructive/30 text-destructive",
                            )}
                          >
                            {transition.changeType === "recovered"
                              ? "Recovered"
                              : transition.changeType === "reclassified"
                                ? "Reclassified"
                                : transition.changeType === "new_server_error"
                                  ? "New 5xx"
                                  : "New 404"}
                          </Badge>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className="rounded-full border border-border/80 bg-background/60 px-2.5 py-1">
                            {transition.previousStatus ?? "-"}
                          </span>
                          <span className="text-muted-foreground/70">to</span>
                          <span className="rounded-full border border-border/80 bg-background/60 px-2.5 py-1 text-foreground">
                            {transition.newStatus ?? "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border/70 bg-background/35 px-4 py-5">
                <p className="text-sm font-medium text-foreground">
                  No recent issue transitions yet.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  When URLs change between healthy, 404, and 5xx states, the timeline will appear here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sitemaps management card */}
      <Card id="sitemaps" className="scroll-mt-44">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-mono text-base">Sitemaps</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddSitemap(true);
                setNewSitemapUrl("");
              }}
              className="font-mono text-xs"
              data-testid="button-add-sitemap"
            >
              <Plus className="mr-1.5 h-3 w-3" />
              ADD SITEMAP
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {/* Primary sitemap — always shown, not deletable */}
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Globe className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span
                  className="font-mono text-xs text-foreground truncate"
                  title={website.sitemapUrl}
                >
                  {website.sitemapUrl}
                </span>
              </div>
              <Badge
                variant="outline"
                className="ml-2 shrink-0 text-[10px] font-mono border-primary/30 text-primary"
              >
                PRIMARY
              </Badge>
            </div>

            {/* Additional sitemaps */}
            {loadingSitemaps ? (
              <Skeleton className="h-10 w-full" />
            ) : sitemaps && sitemaps.length > 0 ? (
              sitemaps.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span
                      className="font-mono text-xs text-foreground truncate"
                      title={s.url}
                    >
                      {s.url}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-2 h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteSitemap(s.id)}
                    data-testid={`button-delete-sitemap-${s.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            ) : null}

            {/* Add sitemap inline form */}
            {showAddSitemap && (
              <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
                <Input
                  autoFocus
                  value={newSitemapUrl}
                  onChange={(e) => setNewSitemapUrl(e.target.value)}
                  placeholder="https://example.com/sitemap2.xml"
                  className="font-mono text-xs h-7 border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddSitemap();
                    if (e.key === "Escape") setShowAddSitemap(false);
                  }}
                  data-testid="input-new-sitemap-url"
                />
                <Button
                  size="sm"
                  onClick={handleAddSitemap}
                  disabled={addSitemap.isPending}
                  className="h-7 text-xs font-mono px-3"
                >
                  {addSitemap.isPending ? "Adding…" : "Add"}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowAddSitemap(false)}
                  className="h-7 w-7 text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as WebsiteFilter)}>
        <Card id="triage" className="scroll-mt-44">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono">Triage Queue</CardTitle>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="new" data-testid="tab-new">
                  New Issues
                </TabsTrigger>
                <TabsTrigger value="resolved" data-testid="tab-resolved">
                  Recovered
                </TabsTrigger>
                <TabsTrigger value="recent" data-testid="tab-recent">
                  Recent Changes
                </TabsTrigger>
                <TabsTrigger value="not_found" data-testid="tab-broken">
                  404s
                </TabsTrigger>
                <TabsTrigger value="server_error" data-testid="tab-server-error">
                  5xx
                </TabsTrigger>
                <TabsTrigger value="ok" data-testid="tab-ok">
                  Healthy
                </TabsTrigger>
                <TabsTrigger value="all" data-testid="tab-all">
                  All
                </TabsTrigger>
                <TabsTrigger value="trends" data-testid="tab-trends">
                  Trends
                </TabsTrigger>
              </TabsList>
              {statusFilter !== "trends" && (
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Filter URLs..."
                    className="pl-9 font-mono text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-urls"
                  />
                </div>
              )}
              {statusFilter === "trends" && (
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
              )}
            </div>
          </CardHeader>
          <TabsContent value={statusFilter} className="m-0">
            <CardContent>
              {statusFilter === "trends" ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground font-mono">
                    Historical 404 and 5xx issue data for this website
                  </p>
                  <WebsiteTrendChart
                    data={websiteHistory}
                    isLoading={loadingHistory}
                    title="URL Health Over Time"
                  />
                </div>
              ) : loadingUrls || loadingSummaryData ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : triagedUrls.length > 0 ? (
                <div className="border border-border rounded-md overflow-hidden">
                  <div className="max-h-[600px] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 font-mono font-medium">
                            Status
                          </th>
                          <th className="px-4 py-3 font-mono font-medium">
                            URL
                          </th>
                          <th className="px-4 py-3 font-mono font-medium hidden lg:table-cell">
                            Change
                          </th>
                          <th className="px-4 py-3 font-mono font-medium hidden md:table-cell">
                            Last Checked
                          </th>
                          <th className="px-4 py-3 font-mono font-medium text-right">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {triagedUrls.map((url) => {
                          const changeLabel = getUrlChangeLabel(url, summaryData);

                          return (
                            <tr
                              key={url.id}
                              className="hover:bg-muted/30 transition-colors"
                              data-testid={`row-url-${url.id}`}
                            >
                              <td className="px-4 py-3 whitespace-nowrap w-24">
                                {getUrlStatusBadge(
                                  url.lastStatus,
                                  url.issueType,
                                  url.isTrackedIssue,
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs break-all">
                                <div className="flex flex-col">
                                  <span
                                    className={
                                      url.issueType === "not_found"
                                        ? "text-destructive font-medium"
                                        : url.issueType === "server_error"
                                          ? "text-amber-500 font-medium"
                                          : "text-foreground"
                                    }
                                  >
                                    {url.url.replace(/^https?:\/\/[^\/]+/, "") ||
                                      "/"}
                                  </span>
                                  {url.errorMessage && (
                                    <span className="text-destructive/80 mt-1 text-[10px]">
                                      {url.errorMessage}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden lg:table-cell">
                                {changeLabel ? (
                                  <Badge
                                    variant="outline"
                                    className={
                                      changeLabel?.includes("New")
                                        ? "border-destructive/30 text-destructive"
                                        : "border-emerald-500/30 text-emerald-600"
                                    }
                                  >
                                    {changeLabel}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    No recent status change
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap hidden md:table-cell">
                                {url.lastCheckedAt
                                  ? formatDistanceToNow(
                                      new Date(url.lastCheckedAt),
                                      {
                                        addSuffix: true,
                                      },
                                    )
                                  : "-"}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-2">
                                  <a
                                    href={url.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center text-xs text-muted-foreground hover:text-primary transition-colors"
                                  >
                                    Visit{" "}
                                    <ExternalLink className="ml-1 h-3 w-3" />
                                  </a>
                                  <button
                                    onClick={() =>
                                      handleDeleteUrl(url.id, url.url)
                                    }
                                    className="inline-flex items-center text-xs text-muted-foreground hover:text-destructive transition-colors"
                                    title="Stop tracking this URL"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-border rounded-md">
                  <p className="text-muted-foreground">
                    No URLs found for the selected triage view.
                  </p>
                  {website.totalUrls === 0 && (
                    <p className="text-muted-foreground text-sm mt-2">
                      Make sure the sitemap URL points to an XML sitemap file
                      (for example `/sitemap.xml` or `/sitemap-0.xml`).
                      <br />
                      <button
                        onClick={openEdit}
                        className="underline text-primary mt-1"
                      >
                        Edit the sitemap URL
                      </button>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </TabsContent>
        </Card>
      </Tabs>

      {/* Edit website dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent data-testid="dialog-edit-website">
          <DialogHeader>
            <DialogTitle className="font-mono">Edit Website</DialogTitle>
            <DialogDescription>
              Update the sitemap URL, name, or alert email. If the sitemap URL
              changes, all URLs will be re-discovered.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-name"
                className="font-mono text-xs text-muted-foreground"
              >
                WEBSITE NAME
              </Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                data-testid="input-edit-name"
                className="font-mono"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-owner-name"
                  className="font-mono text-xs text-muted-foreground"
                >
                  PROPERTY OWNER
                </Label>
                <Input
                  id="edit-owner-name"
                  value={editOwnerName}
                  onChange={(e) => setEditOwnerName(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-xs text-muted-foreground">
                  PRIORITY
                </Label>
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger className="font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-tags"
                className="font-mono text-xs text-muted-foreground"
              >
                TAGS / SEGMENTS
              </Label>
              <Input
                id="edit-tags"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-notes"
                className="font-mono text-xs text-muted-foreground"
              >
                NOTES
              </Label>
              <Input
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-sitemap"
                className="font-mono text-xs text-muted-foreground"
              >
                SITEMAP URL
              </Label>
              <Input
                id="edit-sitemap"
                value={editSitemapUrl}
                onChange={(e) => setEditSitemapUrl(e.target.value)}
                placeholder="https://example.com/sitemap.xml"
                data-testid="input-edit-sitemap-url"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Must be a direct link to an XML sitemap file, e.g.{" "}
                <code className="text-primary">/sitemap.xml</code> or{" "}
                <code className="text-primary">/sitemap-0.xml</code>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="edit-email"
                className="font-mono text-xs text-muted-foreground"
              >
                ALERT EMAIL
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={editAlertEmail}
                onChange={(e) => setEditAlertEmail(e.target.value)}
                data-testid="input-edit-alert-email"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs text-muted-foreground">
                CHECK INTERVAL
              </Label>
              <Select
                value={String(editIntervalMinutes)}
                onValueChange={(v) => setEditIntervalMinutes(parseInt(v, 10))}
              >
                <SelectTrigger
                  data-testid="select-edit-interval"
                  className="font-mono"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How often the scheduler automatically checks all URLs.
              </p>
            </div>

            <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
              <h4 className="font-medium text-sm font-mono">
                Slack Integration
              </h4>

              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-slack-webhook"
                  className="font-mono text-xs text-muted-foreground"
                >
                  SLACK WEBHOOK URL
                </Label>
                <Input
                  id="edit-slack-webhook"
                  value={editSlackWebhookUrl}
                  onChange={(e) => setEditSlackWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  <a
                    href="/help/slack"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    How to get webhook URL
                  </a>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-slack-enabled"
                  checked={editSlackAlertEnabled}
                  onCheckedChange={(checked) =>
                    setEditSlackAlertEnabled(checked === true)
                  }
                  disabled={!editSlackWebhookUrl}
                />
                <Label
                  htmlFor="edit-slack-enabled"
                  className="text-xs font-normal cursor-pointer"
                >
                  Enable Slack alerts
                </Label>
              </div>

              {editSlackAlertEnabled && (
                <>
                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs text-muted-foreground">
                      SUMMARY FREQUENCY
                    </Label>
                    <Select
                      value={editAlertSummaryInterval}
                      onValueChange={setEditAlertSummaryInterval}
                    >
                      <SelectTrigger className="font-mono text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          Only when changes detected
                        </SelectItem>
                        <SelectItem value="realtime">
                          Every check (realtime)
                        </SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="3days">Every 3 days</SelectItem>
                        <SelectItem value="5days">Every 5 days</SelectItem>
                        <SelectItem value="7days">Every 7 days</SelectItem>
                        <SelectItem value="14days">Every 14 days</SelectItem>
                        <SelectItem value="30days">Every 30 days</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editAlertSummaryInterval === "custom" && (
                    <div className="space-y-1.5">
                      <Label className="font-mono text-xs text-muted-foreground">
                        CUSTOM DAYS (2-90)
                      </Label>
                      <Input
                        type="number"
                        min={2}
                        max={90}
                        value={editCustomSummaryDays ?? ""}
                        onChange={(e) =>
                          setEditCustomSummaryDays(
                            parseInt(e.target.value, 10) || undefined,
                          )
                        }
                        className="font-mono text-sm"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="edit-slack-realtime"
                      checked={editSlackRealtimeAlerts}
                      onCheckedChange={(checked) =>
                        setEditSlackRealtimeAlerts(checked === true)
                      }
                    />
                    <Label
                      htmlFor="edit-slack-realtime"
                      className="text-xs font-normal cursor-pointer"
                    >
                      Also send realtime alerts
                    </Label>
                  </div>
                </>
              )}
            </div>

            <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
              <h4 className="font-medium text-sm font-mono">
                Microsoft Teams Integration
              </h4>

              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-teams-webhook"
                  className="font-mono text-xs text-muted-foreground"
                >
                  TEAMS WEBHOOK URL
                </Label>
                <Input
                  id="edit-teams-webhook"
                  value={editTeamsWebhookUrl}
                  onChange={(e) => setEditTeamsWebhookUrl(e.target.value)}
                  placeholder="https://outlook.office.com/webhook/..."
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  <a
                    href="/help/teams"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    How to get webhook URL
                  </a>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-teams-enabled"
                  checked={editTeamsAlertEnabled}
                  onCheckedChange={(checked) =>
                    setEditTeamsAlertEnabled(checked === true)
                  }
                  disabled={!editTeamsWebhookUrl}
                />
                <Label
                  htmlFor="edit-teams-enabled"
                  className="text-xs font-normal cursor-pointer"
                >
                  Enable Teams alerts
                </Label>
              </div>

              {editTeamsAlertEnabled && (
                <>
                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs text-muted-foreground">
                      SUMMARY FREQUENCY
                    </Label>
                    <Select
                      value={editAlertSummaryInterval}
                      onValueChange={setEditAlertSummaryInterval}
                    >
                      <SelectTrigger className="font-mono text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          Only when changes detected
                        </SelectItem>
                        <SelectItem value="realtime">
                          Every check (realtime)
                        </SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="3days">Every 3 days</SelectItem>
                        <SelectItem value="5days">Every 5 days</SelectItem>
                        <SelectItem value="7days">Every 7 days</SelectItem>
                        <SelectItem value="14days">Every 14 days</SelectItem>
                        <SelectItem value="30days">Every 30 days</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editAlertSummaryInterval === "custom" && (
                    <div className="space-y-1.5">
                      <Label className="font-mono text-xs text-muted-foreground">
                        CUSTOM DAYS (2-90)
                      </Label>
                      <Input
                        type="number"
                        min={2}
                        max={90}
                        value={editCustomSummaryDays ?? ""}
                        onChange={(e) =>
                          setEditCustomSummaryDays(
                            parseInt(e.target.value, 10) || undefined,
                          )
                        }
                        className="font-mono text-sm"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="edit-teams-realtime"
                      checked={editTeamsRealtimeAlerts}
                      onCheckedChange={(checked) =>
                        setEditTeamsRealtimeAlerts(checked === true)
                      }
                    />
                    <Label
                      htmlFor="edit-teams-realtime"
                      className="text-xs font-normal cursor-pointer"
                    >
                      Also send realtime alerts
                    </Label>
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateWebsite.isPending}
              data-testid="button-save-edit"
            >
              {updateWebsite.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={showDeleteUrlDialog}
        onOpenChange={setShowDeleteUrlDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono">
              Stop Tracking URL?
            </AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-sm">
              Are you sure you want to stop tracking this URL? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {urlToDelete && (
            <div className="py-2">
              <code className="text-xs bg-muted px-2 py-1 rounded break-all text-destructive">
                {urlToDelete.url.length > 60
                  ? urlToDelete.url.substring(0, 60) + "..."
                  : urlToDelete.url}
              </code>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUrl}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-mono"
            >
              {deleteUrl.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
