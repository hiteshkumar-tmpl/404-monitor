import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

export const INTERVAL_OPTIONS = [
  { label: "Every 5 minutes", value: 5 },
  { label: "Every 15 minutes", value: 15 },
  { label: "Every 30 minutes", value: 30 },
  { label: "Every 1 hour", value: 60 },
  { label: "Every 2 hours", value: 120 },
  { label: "Every 6 hours", value: 360 },
  { label: "Every 12 hours", value: 720 },
  { label: "Every 24 hours", value: 1440 },
];

export const SUMMARY_INTERVAL_OPTIONS = [
  { label: "Only when changes detected", value: "none" },
  { label: "Every check (realtime)", value: "realtime" },
  { label: "Daily", value: "daily" },
  { label: "Every 3 days", value: "3days" },
  { label: "Every 5 days", value: "5days" },
  { label: "Every 7 days", value: "7days" },
  { label: "Every 14 days", value: "14days" },
  { label: "Every 30 days", value: "30days" },
  { label: "Custom", value: "custom" },
];

export function intervalLabel(minutes: number): string {
  const opt = INTERVAL_OPTIONS.find((o) => o.value === minutes);
  if (opt) return opt.label;
  if (minutes < 60) return `Every ${minutes} min`;
  if (minutes < 1440) return `Every ${Math.round(minutes / 60)}h`;
  return `Every ${Math.round(minutes / 1440)}d`;
}

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  sitemapUrl: z
    .string()
    .url("Must be a valid URL starting with http:// or https://"),
  alertEmail: z.string().email("Must be a valid email address."),
  checkIntervalMinutes: z.coerce.number().int().min(5),
  slackWebhookUrl: z.string().optional(),
  slackAlertEnabled: z.boolean().optional().default(false),
  slackRealtimeAlerts: z.boolean().optional().default(true),
  teamsWebhookUrl: z.string().optional(),
  teamsAlertEnabled: z.boolean().optional().default(false),
  teamsRealtimeAlerts: z.boolean().optional().default(true),
  alertSummaryInterval: z
    .enum([
      "none",
      "realtime",
      "daily",
      "3days",
      "5days",
      "7days",
      "14days",
      "30days",
      "custom",
    ])
    .optional()
    .default("none"),
  customSummaryDays: z.coerce.number().int().min(2).max(90).optional(),
});

export default function AddWebsite() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addWebsite = useAddWebsite();
  const [slackAlertEnabled, setSlackAlertEnabled] = useState(false);
  const [teamsAlertEnabled, setTeamsAlertEnabled] = useState(false);
  const [slackRealtimeAlerts, setSlackRealtimeAlerts] = useState(true);
  const [teamsRealtimeAlerts, setTeamsRealtimeAlerts] = useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
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

  function onSubmit(values: z.infer<typeof formSchema>) {
    addWebsite.mutate(
      { data: values },
      {
        onSuccess: (website) => {
          toast({
            title: "Property added",
            description: "We are now parsing your sitemap.",
          });
          queryClient.invalidateQueries({ queryKey: getGetWebsitesQueryKey() });
          queryClient.invalidateQueries({
            queryKey: getGetDashboardSummaryQueryKey(),
          });
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
          Configure a new website to monitor for 404 errors.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-mono">Configuration</CardTitle>
          <CardDescription>
            Provide the sitemap URL. We'll extract all URLs automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      Must point directly to an XML sitemap file, e.g.{" "}
                      <code className="text-primary">/sitemap.xml</code> or{" "}
                      <code className="text-primary">/sitemap-0.xml</code>
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
                      We'll send notifications here when we detect new broken
                      links.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      How often to automatically check all URLs in this
                      website's sitemap.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                            Summary Frequency
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
                              Also send realtime alerts
                            </FormLabel>
                            <FormDescription className="text-xs">
                              Get notified immediately when new broken/fixed
                              URLs are detected
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
                            Summary Frequency
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
                              Also send realtime alerts
                            </FormLabel>
                            <FormDescription className="text-xs">
                              Get notified immediately when new broken/fixed
                              URLs are detected
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>

              <Alert className="bg-muted/50 text-muted-foreground border-border">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Your sitemap will be parsed immediately after adding.
                  Automated checks run on the schedule you choose above.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation("/dashboard")}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addWebsite.isPending}
                  data-testid="button-submit"
                >
                  {addWebsite.isPending ? "Adding..." : "Add Property"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
