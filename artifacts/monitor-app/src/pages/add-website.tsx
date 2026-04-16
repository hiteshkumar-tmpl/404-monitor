import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { useAddWebsite } from "@workspace/api-client-react";
import { Globe, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetWebsitesQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageSquare, Users } from "lucide-react";
import {
  PROPERTY_SETUP_NOTICE_KEY,
  SUMMARY_INTERVAL_OPTIONS,
  INTERVAL_OPTIONS,
  getAlertCadenceDescription,
  intervalLabel,
  propertyFormSchema,
  type PropertyFormValues,
} from "@/lib/monitoring";

export default function AddWebsite() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addWebsite = useAddWebsite();
  const [currentStep, setCurrentStep] = useState(1);
  const [slackAlertEnabled, setSlackAlertEnabled] = useState(false);
  const [teamsAlertEnabled, setTeamsAlertEnabled] = useState(false);
  const [slackRealtimeAlerts, setSlackRealtimeAlerts] = useState(true);
  const [teamsRealtimeAlerts, setTeamsRealtimeAlerts] = useState(true);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
      name: "",
      ownerName: "",
      priority: "medium",
      tags: "",
      notes: "",
      sitemapUrl: "",
      alertEmail: "",
      checkIntervalMinutes: 60,
      slackWebhookUrl: "",
      slackAlertEnabled: false,
      slackRealtimeAlerts: true,
      teamsWebhookUrl: "",
      teamsAlertEnabled: false,
      teamsRealtimeAlerts: true,
      alertSummaryInterval: "none",
      customSummaryDays: 7,
    },
  });

  const selectedInterval = form.watch("alertSummaryInterval");
  const checkIntervalMinutes = form.watch("checkIntervalMinutes") ?? 60;
  const propertyName = form.watch("name") || "This property";
  const ownerName = form.watch("ownerName") || "Unassigned";
  const priority = form.watch("priority") || "medium";
  const tags = form.watch("tags") || "campaign, seo";
  const sitemapUrl =
    form.watch("sitemapUrl") || "https://example.com/sitemap.xml";
  const alertEmail = form.watch("alertEmail") || "team@example.com";
  const enabledDestinations = [
    "email",
    slackAlertEnabled ? "Slack" : null,
    teamsAlertEnabled ? "Teams" : null,
  ].filter(Boolean) as string[];

  const steps = [
    {
      id: 1,
      eyebrow: "Step 1",
      title: "Property details",
      description:
        "Tell us which sitemap to import and who should always receive email alerts.",
    },
    {
      id: 2,
      eyebrow: "Step 2",
      title: "Check frequency",
      description:
        "Choose how often we should look for new broken pages on this property.",
    },
    {
      id: 3,
      eyebrow: "Step 3",
      title: "Alert channels",
      description:
        "Add Slack or Teams when the rest of your team should see changes right away.",
    },
    {
      id: 4,
      eyebrow: "Step 4",
      title: "Review and launch",
      description:
        "Confirm the property setup before we parse the sitemap and queue the first check.",
    },
  ] as const;

  async function goToNextStep() {
    if (currentStep === 1) {
      const valid = await form.trigger([
        "name",
        "ownerName",
        "priority",
        "tags",
        "notes",
        "sitemapUrl",
        "alertEmail",
      ]);
      if (!valid) return;
    }

    if (currentStep === 2) {
      const valid = await form.trigger(["checkIntervalMinutes"]);
      if (!valid) return;
    }

    if (currentStep === 3) {
      const valid = await form.trigger([
        "slackWebhookUrl",
        "slackAlertEnabled",
        "slackRealtimeAlerts",
        "teamsWebhookUrl",
        "teamsAlertEnabled",
        "teamsRealtimeAlerts",
        "alertSummaryInterval",
        "customSummaryDays",
      ]);
      if (!valid) return;
    }

    setCurrentStep((step) => Math.min(step + 1, 4));
  }

  function onSubmit(values: PropertyFormValues) {
    addWebsite.mutate(
      { data: values },
      {
        onSuccess: (website) => {
          const notice = {
            websiteId: website.id,
            propertyName: website.name,
            alertDestinations: enabledDestinations,
            checkIntervalMinutes: values.checkIntervalMinutes,
          };

          sessionStorage.setItem(
            PROPERTY_SETUP_NOTICE_KEY,
            JSON.stringify(notice),
          );

          toast({
            title: "Property added",
            description:
              "We are parsing your sitemap and preparing the first health check.",
          });
          queryClient.invalidateQueries({ queryKey: getGetWebsitesQueryKey() });
          queryClient.invalidateQueries({
            queryKey: getGetDashboardSummaryQueryKey(),
          });
          queryClient.invalidateQueries({ queryKey: ["dashboard-insights"] });
          setLocation(`/websites/${website.id}`);
        },
        onError: () => {
          toast({
            title: "Failed to add property",
            description: "An error occurred while adding the website.",
            variant: "destructive",
          });
        },
      },
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground mb-2">
          Add Property
        </h1>
        <p className="text-muted-foreground">
          Guided setup for sitemap monitoring, alerting, and the first health
          check.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-mono">Configuration</CardTitle>
          <CardDescription>
            Add the property, choose how often to check it, and decide where
            alerts should land.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-4">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className={`rounded-lg border p-3 ${
                      currentStep === step.id
                        ? "border-primary bg-primary/5"
                        : currentStep > step.id
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-border bg-muted/20"
                    }`}
                  >
                    <p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                      {step.eyebrow}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{step.title}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wide">
                  {steps[currentStep - 1].eyebrow}
                </p>
                <h3 className="mt-1 text-sm font-semibold">
                  {steps[currentStep - 1].title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {steps[currentStep - 1].description}
                </p>
              </div>

              {currentStep === 1 && (
                <>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Production Marketing Site"
                            {...field}
                            data-testid="input-name"
                          />
                        </FormControl>
                        <FormDescription>
                          Use a name your team will recognize in alerts and dashboards.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="ownerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Property Owner</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="SEO team"
                              {...field}
                              data-testid="input-owner-name"
                            />
                          </FormControl>
                          <FormDescription>
                            Show who owns this property in the dashboard and reports.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-priority">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            High-priority sites rise to the top of the dashboard.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="sitemapUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sitemap URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.com/sitemap.xml"
                            type="url"
                            {...field}
                            data-testid="input-sitemap"
                          />
                        </FormControl>
                        <FormDescription>
                          Use a direct XML sitemap URL, for example{" "}
                          <code className="text-primary">/sitemap.xml</code> or{" "}
                          <code className="text-primary">/sitemap-0.xml</code>.
                          We&apos;ll import the URLs automatically after setup.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags / Segments</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="campaign, blog, docs"
                            {...field}
                            data-testid="input-tags"
                          />
                        </FormControl>
                        <FormDescription>
                          Comma-separated tags help SEO teams slice the dashboard.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="alertEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alert Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="eng@example.com"
                            type="email"
                            {...field}
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormDescription>
                          Email alerts are always on. This is the guaranteed fallback
                          channel for new issues.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Spring migration landing pages"
                            {...field}
                            data-testid="input-notes"
                          />
                        </FormControl>
                        <FormDescription>
                          Lightweight context for launches, migrations, or campaign monitoring.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {currentStep === 2 && (
                <>
                  <Alert className="bg-muted/50 text-muted-foreground border-border">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      We&apos;ll re-check every imported URL{" "}
                      {intervalLabel(checkIntervalMinutes).toLowerCase()}. Faster
                      cadences catch launch issues sooner. Slower cadences are better
                      for lower-change sites.
                    </AlertDescription>
                  </Alert>

                  <FormField
                    control={form.control}
                    name="checkIntervalMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Check Interval</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(parseInt(v, 10))}
                          defaultValue={String(field.value)}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-interval">
                              <SelectValue placeholder="Select check frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {INTERVAL_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={String(opt.value)}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose the cadence that balances response speed and alert noise.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {currentStep === 3 && (
                <>
                  <Alert className="bg-muted/50 text-muted-foreground border-border">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Email is always enabled. Add Slack or Teams when the wider team
                      needs visibility, then choose whether those channels should get
                      immediate alerts, digests, or both.
                    </AlertDescription>
                  </Alert>

                  <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <h4 className="font-medium text-sm">
                    Slack Integration (Optional)
                  </h4>
                </div>

                <FormField
                  control={form.control}
                  name="slackWebhookUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">
                        Slack Webhook URL
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://hooks.slack.com/services/..."
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Get alerts in your Slack channel.{" "}
                        <a
                          href="/help/slack"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          How to get webhook URL
                        </a>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="slackAlertEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={slackAlertEnabled}
                          onCheckedChange={(checked) => {
                            setSlackAlertEnabled(checked === true);
                            field.onChange(checked);
                          }}
                          disabled={!form.watch("slackWebhookUrl")}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-xs cursor-pointer">
                          Enable Slack alerts
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Receive notifications when broken links are detected
                          or fixed.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {slackAlertEnabled && (
                  <>
                    <FormField
                      control={form.control}
                      name="alertSummaryInterval"
                      render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-xs">
                          Digest Cadence
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SUMMARY_INTERVAL_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">
                            {getAlertCadenceDescription(
                              field.value ?? "none",
                              slackRealtimeAlerts,
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedInterval === "custom" && (
                      <FormField
                        control={form.control}
                        name="customSummaryDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">
                              Custom Days (2-90)
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={2}
                                max={90}
                                className="h-8 text-xs font-mono"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(
                                    parseInt(e.target.value, 10) || undefined,
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="slackRealtimeAlerts"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={slackRealtimeAlerts}
                              onCheckedChange={(checked) => {
                                setSlackRealtimeAlerts(checked === true);
                                field.onChange(checked);
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-xs cursor-pointer">
                              Also send immediate alerts
                            </FormLabel>
                            <FormDescription className="text-xs">
                              Use this when you want Slack to light up the
                              moment a page breaks or recovers.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </>
                )}
                  </div>

                  <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#0078d4]" />
                  <h4 className="font-medium text-sm">
                    Microsoft Teams Integration (Optional)
                  </h4>
                </div>

                <FormField
                  control={form.control}
                  name="teamsWebhookUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">
                        Teams Webhook URL
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://outlook.office.com/webhook/..."
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Get alerts in your Teams channel.{" "}
                        <a
                          href="/help/teams"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          How to get webhook URL
                        </a>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="teamsAlertEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={teamsAlertEnabled}
                          onCheckedChange={(checked) => {
                            setTeamsAlertEnabled(checked === true);
                            field.onChange(checked);
                          }}
                          disabled={!form.watch("teamsWebhookUrl")}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-xs cursor-pointer">
                          Enable Teams alerts
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Receive notifications when broken links are detected
                          or fixed.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {teamsAlertEnabled && (
                  <>
                    <FormField
                      control={form.control}
                      name="alertSummaryInterval"
                      render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-xs">
                            Digest Cadence
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {SUMMARY_INTERVAL_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-xs">
                            {getAlertCadenceDescription(
                              field.value ?? "none",
                              teamsRealtimeAlerts,
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedInterval === "custom" && (
                      <FormField
                        control={form.control}
                        name="customSummaryDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">
                              Custom Days (2-90)
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={2}
                                max={90}
                                className="h-8 text-xs font-mono"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(
                                    parseInt(e.target.value, 10) || undefined,
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="teamsRealtimeAlerts"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={teamsRealtimeAlerts}
                              onCheckedChange={(checked) => {
                                setTeamsRealtimeAlerts(checked === true);
                                field.onChange(checked);
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-xs cursor-pointer">
                              Also send immediate alerts
                            </FormLabel>
                            <FormDescription className="text-xs">
                              Turn this on when your team needs Teams updates
                              as soon as a URL changes status.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </>
                )}
                  </div>
                </>
              )}

              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="bg-muted/20">
                      <CardContent className="p-4 space-y-2">
                        <p className="font-mono text-xs text-muted-foreground uppercase">
                          Property
                        </p>
                        <p className="font-semibold">{propertyName}</p>
                        <p className="text-sm text-muted-foreground">
                          Owner: {ownerName} • Priority: {priority}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Tags: {tags}
                        </p>
                        <p className="text-sm text-muted-foreground break-all">
                          {sitemapUrl}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/20">
                      <CardContent className="p-4 space-y-2">
                        <p className="font-mono text-xs text-muted-foreground uppercase">
                          Monitoring plan
                        </p>
                        <p className="font-semibold">
                          {intervalLabel(checkIntervalMinutes)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Alerts to {enabledDestinations.join(", ")}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Alert className="bg-muted/50 text-muted-foreground border-border">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      After you click Add Property, we&apos;ll parse the sitemap,
                      import the URLs we find, show you how many pages were discovered,
                      and queue the first scheduled check. Primary email alerts will go
                      to {alertEmail}.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              <div className="flex justify-between gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    currentStep === 1
                      ? setLocation("/dashboard")
                      : setCurrentStep((step) => Math.max(step - 1, 1))
                  }
                  data-testid={currentStep === 1 ? "button-cancel" : "button-back"}
                >
                  {currentStep === 1 ? "Cancel" : "Back"}
                </Button>
                {currentStep < 4 ? (
                  <Button
                    type="button"
                    onClick={goToNextStep}
                    data-testid="button-next-step"
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={addWebsite.isPending}
                    data-testid="button-submit"
                  >
                    {addWebsite.isPending ? "Adding..." : "Add Property"}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
