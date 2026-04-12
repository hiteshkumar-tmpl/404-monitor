import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Audiences } from "@/components/landing/audiences";
import { AlertsPreview } from "@/components/landing/alerts-preview";
import { CTA } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Audiences />
        <AlertsPreview />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
