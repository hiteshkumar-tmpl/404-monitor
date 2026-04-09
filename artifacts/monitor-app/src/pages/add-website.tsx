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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQueryClient } from "@tanstack/react-query";
import { getGetWebsitesQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";

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

export function intervalLabel(minutes: number): string {
  const opt = INTERVAL_OPTIONS.find((o) => o.value === minutes);
  if (opt) return opt.label;
  if (minutes < 60) return `Every ${minutes} min`;
  if (minutes < 1440) return `Every ${Math.round(minutes / 60)}h`;
  return `Every ${Math.round(minutes / 1440)}d`;
}

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  sitemapUrl: z.string().url("Must be a valid URL starting with http:// or https://"),
  alertEmail: z.string().email("Must be a valid email address."),
  checkIntervalMinutes: z.coerce.number().int().min(5),
});

export default function AddWebsite() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addWebsite = useAddWebsite();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      sitemapUrl: "",
      alertEmail: "",
      checkIntervalMinutes: 60,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    addWebsite.mutate({ data: values }, {
      onSuccess: (website) => {
        toast({
          title: "Property added",
          description: "We are now parsing your sitemap.",
        });
        queryClient.invalidateQueries({ queryKey: getGetWebsitesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setLocation(`/websites/${website.id}`);
      },
      onError: () => {
        toast({
          title: "Failed to add property",
          description: "An error occurred while adding the website.",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground mb-2">Add Property</h1>
        <p className="text-muted-foreground">Configure a new website to monitor for 404 errors.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-mono">Configuration</CardTitle>
          <CardDescription>Provide the sitemap URL. We'll extract all URLs automatically.</CardDescription>
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
                      <Input placeholder="e.g. Production Marketing Site" {...field} data-testid="input-name" />
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
                      <Input placeholder="https://example.com/sitemap.xml" type="url" {...field} data-testid="input-sitemap" />
                    </FormControl>
                    <FormDescription>
                      Must point directly to an XML sitemap file, e.g. <code className="text-primary">/sitemap.xml</code> or <code className="text-primary">/sitemap-0.xml</code>
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
                      <Input placeholder="eng@example.com" type="email" {...field} data-testid="input-email" />
                    </FormControl>
                    <FormDescription>
                      We'll send notifications here when we detect new broken links.
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
                      How often to automatically check all URLs in this website's sitemap.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Alert className="bg-muted/50 text-muted-foreground border-border">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Your sitemap will be parsed immediately after adding. Automated checks run on the schedule you choose above.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setLocation("/")}
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
