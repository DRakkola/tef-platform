import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  GitBranch,
  FileCheck2,
  HelpCircle,
  Dumbbell,
  PenTool,
  Image as ImageIcon,
  Clock,
  ShieldAlert,
  GraduationCap,
  ExternalLink,
  Menu,
  X,
  CheckCircle,
  LogIn,
  BarChart3,
  Activity,
  FlaskConical,
  LifeBuoy,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab?: string;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authMsg, setAuthMsg] = useState<string | null>(null);

  const navItems = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Contrôle Bêta", href: "/admin/beta", icon: Flame },
    { label: "Product Analytics", href: "/admin/analytics", icon: BarChart3 },
    { label: "Santé Système", href: "/admin/health", icon: Activity },
    { label: "Expérimentations A/B", href: "/admin/experiments", icon: FlaskConical },
    { label: "Support & Triage", href: "/admin/support", icon: LifeBuoy },
    { label: "Skills Taxonomy", href: "/admin/skills", icon: GitBranch },
    { label: "Assessments", href: "/admin/assessments", icon: FileCheck2 },
    { label: "Question Bank", href: "/admin/questions", icon: HelpCircle },
    { label: "Drill Exercises", href: "/admin/exercises", icon: Dumbbell },
    { label: "Writing Tasks", href: "/admin/writing-tasks", icon: PenTool },
    { label: "Media Assets", href: "/admin/media", icon: ImageIcon },
    { label: "Review Queue", href: "/admin/reviews", icon: Clock },
    { label: "Audit Logs", href: "/admin/audit-logs", icon: ShieldAlert },
  ];

  const handleDevLogin = async () => {
    try {
      const resp = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@example.com",
          password: "AdminPass2026!",
        }),
      });
      if (!resp.ok) throw new Error("Login failed");
      const data = await resp.json();
      localStorage.setItem("auth_token", data.access_token);
      setAuthMsg("Authenticated as Admin!");
      setTimeout(() => setAuthMsg(null), 3000);
      window.location.reload();
    } catch (err: any) {
      setAuthMsg("Error logging in: " + err.message);
    }
  };

  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("auth_token");

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100 antialiased font-sans">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-800 bg-slate-950/90 backdrop-blur transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-6">
          <Link to="/admin" className="flex items-center gap-2 font-bold text-lg text-white">
            <GraduationCap className="h-6 w-6 text-indigo-400" />
            <span className="tracking-tight">Content Studio</span>
          </Link>
          <button
            type="button"
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Admin Badge */}
        <div className="p-4 border-b border-slate-800/60">
          <div className="flex items-center justify-between rounded-lg bg-indigo-950/40 border border-indigo-800/40 p-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-xs">
                <p className="font-medium text-indigo-200">TEF Platform Admin</p>
                <p className="text-slate-400">admin@example.com</p>
              </div>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? location.pathname === "/admin"
                : location.pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-500/20"
                    : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800/80 space-y-2">
          {!hasToken && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDevLogin}
              className="w-full justify-center gap-2 text-xs border-indigo-700/60 text-indigo-300 hover:bg-indigo-900/30"
            >
              <LogIn className="h-3.5 w-3.5" />
              Auth as Admin
            </Button>
          )}

          {authMsg && (
            <p className="text-xs text-center text-emerald-400 flex items-center justify-center gap-1">
              <CheckCircle className="h-3 w-3" /> {authMsg}
            </p>
          )}

          <Link
            to="/dashboard"
            className="flex items-center justify-center gap-2 rounded-md border border-slate-700/60 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800/80 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Switch to Student View
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:pl-64">
        {/* Mobile Header Bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            className="text-slate-400 hover:text-white"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2 font-bold text-white">
            <GraduationCap className="h-5 w-5 text-indigo-400" />
            <span>Content Studio</span>
          </div>
          <Link to="/dashboard" className="text-xs text-slate-400 hover:text-white">
            Exit
          </Link>
        </header>

        {/* Page Container */}
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
};
