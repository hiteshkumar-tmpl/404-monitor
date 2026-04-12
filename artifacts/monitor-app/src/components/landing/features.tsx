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
    title: "Real-Time Monitoring",
    description:
      "Checks your sitemaps on a schedule you set. From every 15 minutes to once a week.",
    color: "sky",
  },
  {
    icon: Bell,
    title: "Smart Alerts",
    description:
      "Get notified where you work. Slack, Discord, email, or webhooks.",
    color: "violet",
  },
  {
    icon: TrendingUp,
    title: "SEO Impact Tracking",
    description:
      "See which broken pages hurt most. Track crawl errors by importance.",
    color: "emerald",
  },
  {
    icon: LayoutGrid,
    title: "Beautiful Dashboard",
    description:
      "Modern UI that makes monitoring feel effortless, not tedious.",
    color: "sky",
  },
  {
    icon: Building2,
    title: "White-Label for Agencies",
    description:
      "Rebrand and resell to your clients. Your dashboard, your domain.",
    color: "amber",
  },
  {
    icon: Zap,
    title: "Simple Setup",
    description:
      "Paste your sitemap URL. Done. No technical knowledge required.",
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
            Everything you need to stay on top of 404s
          </h2>
          <p className="text-lg text-slate-600">
            From instant alerts to SEO insights, we've got everything covered so
            you can focus on building.
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
