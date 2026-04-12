import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Zap } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white pt-20 pb-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-sky-100/50 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-sm font-medium mb-8">
            <Zap className="w-4 h-4" />
            <span>Real-time 404 monitoring for modern teams</span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 tracking-tight mb-6">
            Never Miss a{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-cyan-500">
              Broken Link
            </span>{" "}
            Again
          </h1>

          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            404 Monitor crawls your sitemap, detects broken pages in real-time,
            and alerts you before they hurt your SEO or user experience.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/login">
              <Button
                size="lg"
                className="bg-sky-600 hover:bg-sky-700 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg shadow-sky-500/25"
              >
                Start Monitoring Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>Free for personal projects</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>Setup in 30 seconds</span>
            </div>
          </div>
        </div>

        <div id="demo" className="mt-20 max-w-5xl mx-auto">
          <div className="relative rounded-2xl bg-white border border-slate-200 shadow-2xl shadow-slate-500/10 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-12 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="flex-1 flex justify-center">
                <div className="bg-slate-200 rounded-md px-3 py-1 text-xs text-slate-500 font-mono">
                  app.404monitor.io
                </div>
              </div>
            </div>
            <div className="pt-12 p-6 bg-slate-50">
              <DashboardPreview />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardPreview() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Websites", value: "12", color: "sky" },
          { label: "URLs Monitored", value: "8,429", color: "sky" },
          { label: "Broken URLs", value: "23", color: "red" },
          { label: "Sites with Errors", value: "3", color: "red" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl p-4 border border-slate-200"
          >
            <p className="text-xs text-slate-500 font-medium mb-1">
              {stat.label}
            </p>
            <p
              className={`text-2xl font-bold ${stat.color === "red" ? "text-red-500" : "text-slate-900"}`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <p className="font-semibold text-slate-900">Monitored Properties</p>
        </div>
        <div className="divide-y divide-slate-100">
          {[
            { name: "Acme Corp Blog", urls: 1247, broken: 0, status: "ok" },
            { name: "Shopify Store", urls: 892, broken: 12, status: "error" },
            { name: "Startup Landing", urls: 34, broken: 0, status: "ok" },
            { name: "Documentation", urls: 2341, broken: 11, status: "error" },
          ].map((site) => (
            <div
              key={site.name}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${site.broken > 0 ? "bg-red-500" : "bg-emerald-500"}`}
                />
                <div>
                  <p className="font-medium text-slate-900">{site.name}</p>
                  <p className="text-xs text-slate-500">{site.urls} URLs</p>
                </div>
              </div>
              {site.broken > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-md">
                  {site.broken} broken
                </span>
              )}
              {site.broken === 0 && (
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-md">
                  All OK
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
