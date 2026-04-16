import {
  Radar,
  Bell,
  TrendingUp,
  LayoutGrid,
  Building2,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Radar,
    title: "Configurable Monitoring",
    description:
      "Monitor each property on the cadence that makes sense for it, from frequent checks to slower daily sweeps.",
    color: "sky",
  },
  {
    icon: Bell,
    title: "Alerts Where Teams Work",
    description:
      "Send updates to email, Slack, and Microsoft Teams with immediate alerts or quieter digest-style summaries.",
    color: "violet",
  },
  {
    icon: TrendingUp,
    title: "History and Trends",
    description:
      "See broken-link trends over time so teams can track whether a property is getting healthier or riskier.",
    color: "emerald",
  },
  {
    icon: LayoutGrid,
    title: "Actionable Dashboard",
    description:
      "Review monitored properties, recent checks, URL health, and triage queues from one place.",
    color: "sky",
  },
  {
    icon: Building2,
    title: "Multi-User Admin Controls",
    description:
      "Support admins managing multiple users and websites without sharing one overloaded account.",
    color: "amber",
  },
  {
    icon: Zap,
    title: "Simple Sitemap Setup",
    description:
      "Add a property with a sitemap URL, import monitored pages automatically, and add more sitemaps later.",
    color: "rose",
  },
];

const colorClasses = {
  sky: "bg-sky-100 text-sky-600",
  violet: "bg-violet-100 text-violet-600",
  emerald: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
  rose: "bg-rose-100 text-rose-600",
};

export function Features() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Website health monitoring built for SEO and marketing teams
          </h2>
          <p className="text-lg text-slate-600">
            Monitor sitemap URLs, route alerts to the right channels, and track
            broken-link trends without stitching together separate tools.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group p-8 rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all duration-300"
              >
                <div
                  className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${colorClasses[feature.color as keyof typeof colorClasses]} mb-6`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
