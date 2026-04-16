import { Rocket, Building2, FileText, ShoppingCart } from "lucide-react";

const audiences = [
  {
    icon: Rocket,
    title: "Marketing Teams",
    description:
      "Watch campaign, landing-page, and blog URLs without waiting for broken links to show up in analytics.",
    color: "sky",
  },
  {
    icon: Building2,
    title: "Agencies",
    description:
      "Monitor multiple client properties, route alerts to the right people, and keep oversight in one place.",
    color: "violet",
  },
  {
    icon: FileText,
    title: "SEO and Content Ops",
    description:
      "Spot broken pages quickly, track health trends over time, and reduce the SEO risk of dead-end URLs.",
    color: "emerald",
  },
  {
    icon: ShoppingCart,
    title: "Admin Owners",
    description:
      "Give multiple users access, manage monitored properties centrally, and keep visibility across teams.",
    color: "amber",
  },
];

const colorClasses = {
  sky: "bg-sky-50 text-sky-600 border-sky-200",
  violet: "bg-violet-50 text-violet-600 border-violet-200",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-200",
  amber: "bg-amber-50 text-amber-600 border-amber-200",
};

export function Audiences() {
  return (
    <section id="audiences" className="py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Built for teams that own website health
          </h2>
          <p className="text-lg text-slate-600">
            The current product is strongest for marketing, SEO, agency, and
            admin-led workflows where broken pages need quick visibility.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {audiences.map((audience) => {
            const Icon = audience.icon;
            return (
              <div
                key={audience.title}
                className={`p-6 rounded-2xl border-2 ${colorClasses[audience.color as keyof typeof colorClasses]} transition-transform hover:scale-105`}
              >
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center mb-4 shadow-sm">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {audience.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {audience.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
