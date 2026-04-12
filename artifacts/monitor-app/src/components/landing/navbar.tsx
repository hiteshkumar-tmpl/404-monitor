import { Link } from "wouter";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/landing" className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-sky-600" />
            <span className="font-bold text-xl text-slate-900">404Monitor</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              How It Works
            </a>
            <a
              href="#audiences"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              For Agencies
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button
                variant="ghost"
                className="text-slate-600 hover:text-slate-900"
              >
                Login
              </Button>
            </Link>
            <Link href="/login">
              <Button className="bg-sky-600 hover:bg-sky-700 text-white">
                Start Free
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
