import { MessageSquare, Bell, Mail } from "lucide-react";

const integrations = [
  { name: "Slack", icon: MessageSquare, color: "purple" },
  { name: "Discord", icon: MessageSquare, color: "indigo" },
  { name: "Email", icon: Mail, color: "sky" },
  { name: "Webhooks", icon: Bell, color: "emerald" },
];

const colorClasses: Record<string, string> = {
  purple: "bg-purple-500",
  indigo: "bg-indigo-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
};

export function AlertsPreview() {
  return (
    <section id="alerts" className="py-24 bg-slate-900 text-white">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
          <div>
            <h2 className="text-4xl font-bold mb-6">
              Alerts where your team works
            </h2>
            <p className="text-lg text-slate-300 mb-8 leading-relaxed">
              When a 404 is detected, you'll know instantly through your
              preferred channels. No more checking dashboards manually — we push
              updates to you.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {integrations.map((integration) => {
                const Icon = integration.icon;
                return (
                  <div
                    key={integration.name}
                    className="flex items-center gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg ${colorClasses[integration.color]} flex items-center justify-center`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-medium text-white">
                      {integration.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-sky-500/20 to-cyan-500/20 rounded-3xl blur-3xl" />
            <div className="relative bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
              <div className="px-4 py-3 bg-slate-900 border-b border-slate-700 flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                <span className="font-medium text-slate-200">#alerts</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold">
                    4M
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white">
                        404Monitor Bot
                      </span>
                      <span className="text-xs text-slate-500">
                        Today at 2:34 PM
                      </span>
                    </div>
                    <div className="bg-slate-700 rounded-xl p-3 text-sm">
                      <p className="text-purple-400 font-medium mb-1">
                        🚨 3 New Broken Links Detected
                      </p>
                      <p className="text-slate-300 mb-2">Shopify Store</p>
                      <div className="space-y-1 text-slate-400">
                        <p>• /old-product-page (404)</p>
                        <p>• /discontinued/item-123 (404)</p>
                        <p>• /blog/sale (301 → 404)</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold">
                    4M
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white">
                        404Monitor Bot
                      </span>
                      <span className="text-xs text-slate-500">
                        Today at 11:15 AM
                      </span>
                    </div>
                    <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-3 text-sm">
                      <p className="text-emerald-400 font-medium">
                        ✅ All Clear!
                      </p>
                      <p className="text-slate-400">
                        Acme Corp Blog - No broken links found in latest scan.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
