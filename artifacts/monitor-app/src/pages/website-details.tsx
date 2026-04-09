import { useState } from "react";
import { useParams } from "wouter";
import { 
  useGetWebsite, 
  useGetWebsiteUrls, 
  useTriggerCheck,
  useUpdateWebsite,
  useGetWebsiteSitemaps,
  useAddSitemap,
  useDeleteSitemap,
  getGetWebsiteQueryKey,
  getGetWebsiteUrlsQueryKey,
  getGetWebsiteSitemapsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetWebsitesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { 
  Activity, 
  AlertTriangle, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Globe, 
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { WebsiteStatus } from "@workspace/api-client-react";
import { INTERVAL_OPTIONS, intervalLabel } from "@/pages/add-website";

export default function WebsiteDetails() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [statusFilter, setStatusFilter] = useState<"all" | "broken" | "ok">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [checkResult, setCheckResult] = useState<{ message: string, newBroken: number, checked: number } | null>(null);
  
  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSitemapUrl, setEditSitemapUrl] = useState("");
  const [editAlertEmail, setEditAlertEmail] = useState("");
  const [editIntervalMinutes, setEditIntervalMinutes] = useState(60);

  // Add sitemap state
  const [showAddSitemap, setShowAddSitemap] = useState(false);
  const [newSitemapUrl, setNewSitemapUrl] = useState("");

  const { data: website, isLoading: loadingWebsite } = useGetWebsite(id, { 
    query: { enabled: !!id, queryKey: getGetWebsiteQueryKey(id), refetchInterval: 30000 } 
  });
  
  const { data: urls, isLoading: loadingUrls } = useGetWebsiteUrls(id, { status: statusFilter !== "all" ? statusFilter : undefined }, { 
    query: { enabled: !!id, queryKey: getGetWebsiteUrlsQueryKey(id, { status: statusFilter !== "all" ? statusFilter : undefined }), refetchInterval: 30000 } 
  });

  const { data: sitemaps, isLoading: loadingSitemaps } = useGetWebsiteSitemaps(id, {
    query: { enabled: !!id, queryKey: getGetWebsiteSitemapsQueryKey(id), refetchInterval: 30000 }
  });

  const triggerCheck = useTriggerCheck();
  const updateWebsite = useUpdateWebsite();
  const addSitemap = useAddSitemap();
  const deleteSitemap = useDeleteSitemap();

  const handleRunCheck = () => {
    triggerCheck.mutate({ id }, {
      onSuccess: (result) => {
        setCheckResult({
          message: result.message,
          newBroken: result.newBrokenUrls,
          checked: result.checkedUrls
        });
        toast({
          title: "Check completed",
          description: result.message,
        });
        queryClient.invalidateQueries({ queryKey: getGetWebsiteQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetWebsiteUrlsQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWebsitesQueryKey() });
      },
      onError: () => {
        toast({
          title: "Check failed",
          description: "An error occurred while running the check.",
          variant: "destructive",
        });
      }
    });
  };

  const openEdit = () => {
    if (!website) return;
    setEditName(website.name);
    setEditSitemapUrl(website.sitemapUrl);
    setEditAlertEmail(website.alertEmail);
    setEditIntervalMinutes(website.checkIntervalMinutes ?? 60);
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editSitemapUrl.trim()) {
      toast({ title: "Sitemap URL is required", variant: "destructive" });
      return;
    }
    updateWebsite.mutate(
      { id, data: { name: editName, sitemapUrl: editSitemapUrl, alertEmail: editAlertEmail, checkIntervalMinutes: editIntervalMinutes } },
      {
        onSuccess: () => {
          setEditOpen(false);
          toast({ title: "Updated", description: "Website settings saved. Sitemap is being re-parsed." });
          queryClient.invalidateQueries({ queryKey: getGetWebsiteQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetWebsiteUrlsQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetWebsitesQueryKey() });
        },
        onError: () => {
          toast({ title: "Update failed", description: "Could not save changes.", variant: "destructive" });
        }
      }
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
          toast({ title: "Sitemap added", description: "Parsing URLs in the background…" });
          queryClient.invalidateQueries({ queryKey: getGetWebsiteSitemapsQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetWebsiteUrlsQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetWebsiteQueryKey(id) });
        },
        onError: () => {
          toast({ title: "Failed to add sitemap", variant: "destructive" });
        }
      }
    );
  };

  const handleDeleteSitemap = (sitemapId: number) => {
    deleteSitemap.mutate(
      { id, sitemapId },
      {
        onSuccess: () => {
          toast({ title: "Sitemap removed" });
          queryClient.invalidateQueries({ queryKey: getGetWebsiteSitemapsQueryKey(id) });
        },
        onError: () => {
          toast({ title: "Failed to remove sitemap", variant: "destructive" });
        }
      }
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case WebsiteStatus.ok:
        return <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20" variant="outline">OK</Badge>;
      case WebsiteStatus.error:
        return <Badge variant="destructive">Error</Badge>;
      case WebsiteStatus.checking:
        return <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20" variant="outline"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Checking</Badge>;
      case WebsiteStatus.pending:
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getUrlStatusBadge = (statusCode: number | null | undefined, isBroken: boolean) => {
    if (statusCode === null || statusCode === undefined) {
      return <Badge variant="secondary" className="font-mono text-xs">Unchecked</Badge>;
    }
    if (isBroken) {
      return <Badge variant="destructive" className="font-mono text-xs">{statusCode}</Badge>;
    }
    if (statusCode === 200) {
      return <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20 font-mono text-xs" variant="outline">200</Badge>;
    }
    return <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20 font-mono text-xs" variant="outline">{statusCode}</Badge>;
  };

  const filteredUrls = urls?.filter(u => 
    u.url.toLowerCase().includes(searchQuery.toLowerCase())
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
        <h2 className="text-2xl font-bold text-muted-foreground">Property not found</h2>
        <Link href="/">
          <Button variant="link" className="mt-4">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const isChecking = triggerCheck.isPending || website.status === WebsiteStatus.checking;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center space-x-4 mb-6">
        <Link href="/">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-mono font-bold tracking-tight text-foreground flex-1 truncate">
          {website.name}
        </h1>
        {getStatusBadge(website.status)}
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
          disabled={isChecking}
          data-testid="button-run-check"
          className="font-mono font-bold"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? "RUNNING CHECK..." : "RUN CHECK NOW"}
        </Button>
      </div>

      {checkResult && (
        <Alert className={checkResult.newBroken > 0 ? "border-destructive bg-destructive/10" : "border-emerald-500/50 bg-emerald-500/10"}>
          {checkResult.newBroken > 0 ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          <AlertTitle className="font-mono">{checkResult.message}</AlertTitle>
          <AlertDescription className="text-muted-foreground mt-1">
            Checked {checkResult.checked} URLs. Found {checkResult.newBroken} new broken links.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 text-sm font-mono text-muted-foreground mb-2">
              <Globe className="h-4 w-4" />
              <span>SITEMAP</span>
            </div>
            <a href={website.sitemapUrl} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline text-primary truncate block" title={website.sitemapUrl}>
              {website.sitemapUrl}
            </a>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 text-sm font-mono text-muted-foreground mb-2">
              <Clock className="h-4 w-4" />
              <span>LAST CHECKED</span>
            </div>
            <div className="text-sm font-medium">
              {website.lastCheckedAt ? format(new Date(website.lastCheckedAt), "PP p") : "Never"}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card cursor-pointer hover:border-primary/40 transition-colors" onClick={openEdit} title="Click to change check interval">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 text-sm font-mono text-muted-foreground mb-2">
              <Clock className="h-4 w-4" />
              <span>CHECK EVERY</span>
            </div>
            <div className="text-sm font-semibold font-mono truncate">
              {intervalLabel(website.checkIntervalMinutes ?? 60)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 text-sm font-mono text-muted-foreground mb-2">
              <Activity className="h-4 w-4" />
              <span>TOTAL URLS</span>
            </div>
            <div className="text-2xl font-bold font-mono">{website.totalUrls}</div>
          </CardContent>
        </Card>
        <Card className={website.brokenUrls > 0 ? "border-destructive/50 bg-destructive/5" : "bg-card"}>
          <CardContent className="p-6">
            <div className={`flex items-center space-x-2 text-sm font-mono mb-2 ${website.brokenUrls > 0 ? "text-destructive" : "text-muted-foreground"}`}>
              <AlertTriangle className="h-4 w-4" />
              <span>BROKEN URLS</span>
            </div>
            <div className={`text-2xl font-bold font-mono ${website.brokenUrls > 0 ? "text-destructive" : ""}`}>
              {website.brokenUrls}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sitemaps management card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-mono text-base">Sitemaps</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowAddSitemap(true); setNewSitemapUrl(""); }}
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
                <span className="font-mono text-xs text-foreground truncate" title={website.sitemapUrl}>{website.sitemapUrl}</span>
              </div>
              <Badge variant="outline" className="ml-2 shrink-0 text-[10px] font-mono border-primary/30 text-primary">PRIMARY</Badge>
            </div>

            {/* Additional sitemaps */}
            {loadingSitemaps ? (
              <Skeleton className="h-10 w-full" />
            ) : sitemaps && sitemaps.length > 0 ? (
              sitemaps.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-mono text-xs text-foreground truncate" title={s.url}>{s.url}</span>
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
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddSitemap(); if (e.key === "Escape") setShowAddSitemap(false); }}
                  data-testid="input-new-sitemap-url"
                />
                <Button size="sm" onClick={handleAddSitemap} disabled={addSitemap.isPending} className="h-7 text-xs font-mono px-3">
                  {addSitemap.isPending ? "Adding…" : "Add"}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setShowAddSitemap(false)} className="h-7 w-7 text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="font-mono">URL Inventory</CardTitle>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
            <Tabs value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)} className="w-full sm:w-auto">
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                <TabsTrigger value="broken" data-testid="tab-broken">Broken</TabsTrigger>
                <TabsTrigger value="ok" data-testid="tab-ok">OK</TabsTrigger>
              </TabsList>
            </Tabs>
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
          </div>
        </CardHeader>
        <CardContent>
          {loadingUrls ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredUrls && filteredUrls.length > 0 ? (
            <div className="border border-border rounded-md overflow-hidden">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 font-mono font-medium">Status</th>
                      <th className="px-4 py-3 font-mono font-medium">URL</th>
                      <th className="px-4 py-3 font-mono font-medium hidden md:table-cell">Last Checked</th>
                      <th className="px-4 py-3 font-mono font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUrls.map((url) => (
                      <tr key={url.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-url-${url.id}`}>
                        <td className="px-4 py-3 whitespace-nowrap w-24">
                          {getUrlStatusBadge(url.lastStatus, url.isBroken)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs break-all">
                          <div className="flex flex-col">
                            <span className={url.isBroken ? "text-destructive font-medium" : "text-foreground"}>
                              {url.url.replace(/^https?:\/\/[^\/]+/, '') || '/'}
                            </span>
                            {url.errorMessage && (
                              <span className="text-destructive/80 mt-1 text-[10px]">{url.errorMessage}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap hidden md:table-cell">
                          {url.lastCheckedAt ? formatDistanceToNow(new Date(url.lastCheckedAt), { addSuffix: true }) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <a href={url.url} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-muted-foreground hover:text-primary transition-colors">
                            Visit <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-border rounded-md">
              <p className="text-muted-foreground">No URLs found matching your criteria.</p>
              {website.totalUrls === 0 && (
                <p className="text-muted-foreground text-sm mt-2">
                  Make sure the sitemap URL points to an XML sitemap file (e.g. /sitemap.xml or /sitemap-0.xml).
                  <br />
                  <button onClick={openEdit} className="underline text-primary mt-1">
                    Edit the sitemap URL
                  </button>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit website dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent data-testid="dialog-edit-website">
          <DialogHeader>
            <DialogTitle className="font-mono">Edit Website</DialogTitle>
            <DialogDescription>
              Update the sitemap URL, name, or alert email. If the sitemap URL changes, all URLs will be re-discovered.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="font-mono text-xs text-muted-foreground">WEBSITE NAME</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                data-testid="input-edit-name"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-sitemap" className="font-mono text-xs text-muted-foreground">SITEMAP URL</Label>
              <Input
                id="edit-sitemap"
                value={editSitemapUrl}
                onChange={(e) => setEditSitemapUrl(e.target.value)}
                placeholder="https://example.com/sitemap.xml"
                data-testid="input-edit-sitemap-url"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Must be a direct link to an XML sitemap file, e.g. <code className="text-primary">/sitemap.xml</code> or <code className="text-primary">/sitemap-0.xml</code>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email" className="font-mono text-xs text-muted-foreground">ALERT EMAIL</Label>
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
              <Label className="font-mono text-xs text-muted-foreground">CHECK INTERVAL</Label>
              <Select
                value={String(editIntervalMinutes)}
                onValueChange={(v) => setEditIntervalMinutes(parseInt(v, 10))}
              >
                <SelectTrigger data-testid="select-edit-interval" className="font-mono">
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
              <p className="text-xs text-muted-foreground">How often the scheduler automatically checks all URLs.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
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
    </div>
  );
}
