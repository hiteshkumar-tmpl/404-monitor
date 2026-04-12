import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export function CTA() {
  return (
    <section className="py-24 bg-gradient-to-b from-white to-sky-50">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
            Start monitoring in 30 seconds
          </h2>
          <p className="text-xl text-slate-600 mb-10">
            Free forever for personal projects. No credit card required.
          </p>

          <Link href="/login">
            <Button
              size="lg"
              className="bg-sky-600 hover:bg-sky-700 text-white px-10 py-6 text-lg font-semibold rounded-xl shadow-lg shadow-sky-500/25"
            >
              Get Started Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>Unlimited websites</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>Real-time alerts</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>SEO insights</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>White-label</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
