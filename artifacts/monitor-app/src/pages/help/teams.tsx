import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, CheckCircle2, Users } from "lucide-react";
import { PRODUCT_NAME } from "@/lib/brand";

export default function TeamsHelp() {
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
            <Users className="h-8 w-8 text-[#0078d4]" />
            <h1 className="text-3xl font-bold">
              Microsoft Teams Integration Setup
            </h1>
          </div>
          <p className="text-muted-foreground">
            Receive issue alerts directly in your Microsoft Teams channel. Follow
            these steps to set up an incoming webhook.
          </p>
        </div>

        <div className="space-y-6">
          <div className="border rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-[#0078d4]/10 text-[#0078d4] flex items-center justify-center font-bold text-sm shrink-0">
                1
              </div>
              <div>
                <h3 className="font-semibold mb-2">
                  Open Teams and Go to Your Channel
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Navigate to the Teams channel where you want to receive
                  alerts. Click on the "..." menu next to the channel name, then
                  click "Connectors".
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-[#0078d4]/10 text-[#0078d4] flex items-center justify-center font-bold text-sm shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold mb-2">Add a Connector</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  In the Connectors dialog, find "Incoming Webhook" in the list
                  and click "Add". Then click "Configure" next to Incoming
                  Webhook.
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-[#0078d4]/10 text-[#0078d4] flex items-center justify-center font-bold text-sm shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold mb-2">Name Your Webhook</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Enter a name for the webhook (e.g., &quot;{PRODUCT_NAME}{" "}
                  Alerts&quot;). You
                  can also upload an image/icon if desired. Then click "Create".
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-[#0078d4]/10 text-[#0078d4] flex items-center justify-center font-bold text-sm shrink-0">
                4
              </div>
              <div>
                <h3 className="font-semibold mb-2">Copy the Webhook URL</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Teams will generate a webhook URL that looks like:
                </p>
                <code className="block bg-muted px-3 py-2 rounded text-xs font-mono break-all mb-2">
                  https://outlook.office.com/webhook/your-workspace/IncomingWebhook/...
                </code>
                <p className="text-sm text-muted-foreground">
                  Copy this entire URL and paste it into the Teams Webhook URL
                  field in {PRODUCT_NAME}.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-6 border-amber-500/40 bg-amber-500/5">
          <h3 className="font-semibold mb-2">Teams Workflows (Power Automate)</h3>
          <p className="text-sm text-muted-foreground mb-3">
            If you use <strong>When a Teams webhook request is received</strong>{" "}
            and <strong>Post card in a chat or channel</strong>, the card input must
            be the <strong>same JSON object</strong> that {PRODUCT_NAME} sends in its
            HTTP POST body: the root must
            include <code className="text-xs bg-muted px-1 rounded">type</code>{" "}
            with value <code className="text-xs bg-muted px-1 rounded">AdaptiveCard</code>
            .
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-2">
            <li>
              In <strong>Post card</strong>, bind the adaptive card field to the
              trigger <strong>Body</strong> (parsed object), not a string variable
              unless you wrap it with{" "}
              <code className="text-xs bg-muted px-1 rounded">json(...)</code>.
            </li>
            <li>
              If you use <strong>Initialize variable</strong> for the body, use type{" "}
              <strong>Object</strong> (or compose the expression that outputs the full
              trigger body). A <strong>String</strong> variable often breaks
              deserialization unless you call <code className="text-xs bg-muted px-1 rounded">json()</code>.
            </li>
            <li>
              Branches that run when <strong>attachments</strong> is empty must still
              pass the HTTP body you received; an empty or wrong variable produces{" "}
              <code className="text-xs bg-muted px-1 rounded">
                Property &apos;type&apos; must be &apos;AdaptiveCard&apos;
              </code>
              .
            </li>
          </ul>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-emerald-500 mb-1">Pro Tip</h3>
              <p className="text-sm text-muted-foreground">
                Create a dedicated channel for issue alerts (e.g., &quot;Website
                Alerts&quot;) to keep your notifications organized. You can also add
                the same webhook to multiple channels if needed.
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
