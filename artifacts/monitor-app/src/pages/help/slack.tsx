import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";

export default function SlackHelp() {
  return (
    <div className="max-w-2xl mx-auto py-12">
      <Link href="/websites/add">
        <Button variant="ghost" size="sm" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Add Website
        </Button>
      </Link>

      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Slack Integration Setup</h1>
          </div>
          <p className="text-muted-foreground">
            Receive 404 alerts directly in your Slack workspace. Follow these
            steps to get your webhook URL.
          </p>
        </div>

        <div className="space-y-6">
          <div className="border rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                1
              </div>
              <div>
                <h3 className="font-semibold mb-2">Go to api.slack.com</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Visit the Slack API website and sign in with your workspace
                  credentials.
                </p>
                <a
                  href="https://api.slack.com/messaging/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Open Slack Webhooks Page
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold mb-2">Create a Slack App</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  If you don't have an existing app, click "Create New App" and
                  select "From scratch". Give your app a name (e.g., "404
                  Monitor") and pick your workspace.
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold mb-2">Enable Incoming Webhooks</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  In the left sidebar, click on "Incoming Webhooks". Toggle
                  "Activate Incoming Webhooks" to ON.
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                4
              </div>
              <div>
                <h3 className="font-semibold mb-2">
                  Add New Webhook to Workspace
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Click the "Add New Webhook to Workspace" button. Select the
                  Slack channel where you want to receive alerts (e.g., #alerts,
                  #dev-ops).
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                5
              </div>
              <div>
                <h3 className="font-semibold mb-2">Copy the Webhook URL</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  After authorizing, Slack shows a long HTTPS link (incoming
                  webhook). It is one line with several path segments—copy all
                  of it, not just part of the path.
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  Path shape (Slack fills in the real segments):
                </p>
                <code className="block bg-muted px-3 py-2 rounded text-xs font-mono break-all mb-2">
                  …/services/&lt;workspace-id&gt;/&lt;channel-id&gt;/&lt;secret&gt;
                </code>
                <p className="text-sm text-muted-foreground">
                  Paste that full URL into the Slack Webhook URL field in 404
                  Monitor.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-emerald-500 mb-1">Pro Tip</h3>
              <p className="text-sm text-muted-foreground">
                Create a dedicated channel for 404 alerts (e.g.,
                #website-alerts) to keep your notifications organized. You can
                also add the 404 Monitor bot to multiple channels.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center pt-6">
          <Link href="/websites/add">
            <Button className="bg-primary hover:bg-primary/90">
              Continue to Add Website
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
