import { 
  useGetWebsites, 
  useGetDashboardSummary, 
  useDeleteWebsite,
  getGetWebsitesQueryKey,
  getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Activity, Clock, Globe, Link2, AlertTriangle, Trash2, RefreshCw } from "lucide-react";
import { intervalLabel } from "@/pages/add-website";
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

export default function Dashboard() {
  const { data: websites, isLoading: loadingWebsites } = useGetWebsites();
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const deleteWebsite = useDeleteWebsite();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    deleteWebsite.mutate({ id }, {
      onSuccess: () => {
        toast({
          title: "Website removed",
          description: "The website has been removed from monitoring.",
        });
        queryClient.invalidateQueries({ queryKey: getGetWebsitesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: "Failed to remove website.",
          variant: "destructive",
        });
      }
    });
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground mb-2">System Status</h1>
        <p className="text-muted-foreground">Overview of all monitored properties and their current health.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-mono text-muted-foreground">TOTAL WEBSITES</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingSummary ? (
              <Skeleton className="h-8 w-[100px]" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-total-websites">{summary?.totalWebsites || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-mono text-muted-foreground">URLS MONITORED</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingSummary ? (
              <Skeleton className="h-8 w-[100px]" />
            ) : (
              <div className="text-2xl font-bold" data-testid="stat-total-urls">{summary?.totalUrls || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-mono text-muted-foreground text-destructive">BROKEN URLS</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {loadingSummary ? (
              <Skeleton className="h-8 w-[100px]" />
            ) : (
              <div className="text-2xl font-bold text-destructive" data-testid="stat-total-broken">{summary?.totalBroken || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium font-mono text-muted-foreground text-destructive">SITES WITH ERRORS</CardTitle>
            <Activity className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {loadingSummary ? (
              <Skeleton className="h-8 w-[100px]" />
            ) : (
              <div className="text-2xl font-bold text-destructive" data-testid="stat-sites-errors">{summary?.websitesWithErrors || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-mono font-bold tracking-tight">Monitored Properties</h2>
        
        {loadingWebsites ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : websites && websites.length > 0 ? (
          <div className="grid gap-3">
            {websites.map((website) => (
              <Card key={website.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-1">
                        <Link href={`/websites/${website.id}`} className="font-bold text-lg hover:underline truncate" data-testid={`link-website-${website.id}`}>
                          {website.name}
                        </Link>
                        {getStatusBadge(website.status)}
                      </div>
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground font-mono">
                        <span className="flex items-center">
                          <Link2 className="w-3 h-3 mr-1" />
                          {website.totalUrls} URLs
                        </span>
                        {website.brokenUrls > 0 && (
                          <span className="flex items-center text-destructive">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {website.brokenUrls} broken
                          </span>
                        )}
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {intervalLabel(website.checkIntervalMinutes ?? 60)}
                        </span>
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
                        <Button variant="secondary" size="sm" data-testid={`button-view-${website.id}`}>
                          View Details
                        </Button>
                      </Link>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" data-testid={`button-delete-${website.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove monitoring for {website.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. All historical data and monitored URLs for this property will be permanently deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDelete(website.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid={`button-confirm-delete-${website.id}`}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
              <h3 className="text-lg font-bold mb-2">No properties monitored</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Add your first website by providing a sitemap URL. We'll automatically parse it and check for 404 errors on the schedule you choose.
              </p>
              <Link href="/websites/add">
                <Button data-testid="button-add-first">Add Property</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}