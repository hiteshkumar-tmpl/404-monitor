import { Activity } from "lucide-react";
import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-sky-500" />
            <span className="font-bold text-white text-lg">404Monitor</span>
          </div>

          <div className="flex items-center gap-8 text-sm">
            <Link to="/landing" className="hover:text-white transition-colors">
              Home
            </Link>
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a
              href="#how-it-works"
              className="hover:text-white transition-colors"
            >
              How It Works
            </a>
            <a href="#audiences" className="hover:text-white transition-colors">
              For Agencies
            </a>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <a href="#" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Contact
            </a>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
          <p>© {new Date().getFullYear()} 404Monitor. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
