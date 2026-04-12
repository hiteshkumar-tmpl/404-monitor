import { Rocket, Building2, FileText, ShoppingCart } from "lucide-react";

const audiences = [
  {
    icon: Rocket,
    title: "For Startups",
    description:
      "Move fast without breaking things. Catch issues before they become embarrassing tweets.",
    color: "sky",
  },
  {
    icon: Building2,
    title: "For Agencies",
    description:
      "Manage multiple client websites from one dashboard. White-label reports impress executives.",
    color: "violet",
  },
  {
    icon: FileText,
    title: "For Bloggers",
    description:
      "Your readers deserve better than dead ends. Keep every link working, always.",
    color: "emerald",
  },
  {
    icon: ShoppingCart,
    title: "For E-Commerce",
    description:
      "Dropped products, removed pages, expired promotions. Never lose a sale to a 404.",
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
            Built for everyone
          </h2>
          <p className="text-lg text-slate-600">
            Whether you're a solo blogger or managing hundreds of client sites,
            we've got you covered.
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
