import { Link2, Search, Bell } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Link2,
    title: "Add your sitemap",
    description:
      "Paste the main XML sitemap, name the property, and choose the fallback alert email.",
  },
  {
    number: "02",
    icon: Search,
    title: "We import and monitor",
    description:
      "We parse the sitemap in the background, import the discovered URLs, and check them on the cadence you choose.",
  },
  {
    number: "03",
    icon: Bell,
    title: "Route alerts to your team",
    description:
      "Send updates to email, Slack, or Teams with the right balance of immediate alerts and digest summaries.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-slate-50">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            First value in one guided setup
          </h2>
          <p className="text-lg text-slate-600">
            New users only need a sitemap and a destination for alerts. The
            product handles URL import, check scheduling, and ongoing monitoring.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="relative">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-sm mb-6">
                    <Icon className="w-8 h-8 text-sky-600" />
                  </div>
                  <div className="text-5xl font-bold text-slate-200 mb-4">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-slate-600">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-sky-200 to-transparent" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
