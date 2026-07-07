"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Package,
  BarChart3,
  History,
  HelpCircle,
  Plus,
  LayoutDashboard,
  Users,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";

/** WhatsApp support number for wa.me (digits only): +55 85 9217-8804. */
const SUPPORT_WHATSAPP = "558592178804";

/**
 * Persistent left navigation. Active item gets a soft primary-fixed pill with a
 * primary edge marker. Items are role-gated: vendedora sees no Relatórios/
 * Gestão; only lojista/admin see those.
 */
interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  /** Permission key gating visibility; undefined = always visible. */
  gate?: "reports" | "management";
}

const NAV: NavItem[] = [
  { href: "/pos", label: "PDV", icon: LayoutGrid },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Estoque", icon: Package },
  { href: "/reports", label: "Relatórios", icon: BarChart3, gate: "reports" },
  { href: "/orders", label: "Pedidos", icon: History },
  { href: "/management", label: "Gestão", icon: Users, gate: "management" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { canSeeReports, canSeeManagement } = useAuth();
  const { theme, toggle } = useTheme();

  const visible = NAV.filter((item) => {
    if (item.gate === "reports") return canSeeReports;
    if (item.gate === "management") return canSeeManagement;
    return true;
  });

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-outline-variant/50 bg-surface px-md py-lg">
      <div className="px-sm">
        <h1 className="text-headline-lg leading-none text-primary">Build.Store</h1>
        <p className="mt-1 text-label-sm uppercase tracking-wide text-on-surface-variant">
          OKEY STORE
        </p>
      </div>

      <nav className="mt-lg flex flex-col gap-1">
        {visible.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 rounded-full px-4 py-3 text-label-md transition-colors",
                active
                  ? "bg-primary-fixed/60 text-primary"
                  : "text-on-surface-variant hover:bg-surface-container",
              )}
            >
              {active && (
                <span className="absolute right-0 h-6 w-1 rounded-full bg-primary" />
              )}
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-md">
        <Link href="/pos">
          <Button className="w-full" size="lg">
            <Plus className="h-5 w-5" strokeWidth={2} />
            Nova Venda
          </Button>
        </Link>

        <div className="flex flex-col gap-1">
          <button
            onClick={toggle}
            className="flex items-center gap-3 rounded-full px-4 py-2.5 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" strokeWidth={1.75} />
            ) : (
              <Moon className="h-5 w-5" strokeWidth={1.75} />
            )}
            {theme === "dark" ? "Tema claro" : "Tema escuro"}
          </button>
          <a
            href={`https://wa.me/${SUPPORT_WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-full px-4 py-2.5 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <HelpCircle className="h-5 w-5" strokeWidth={1.75} />
            Suporte
          </a>
        </div>
      </div>
    </aside>
  );
}
