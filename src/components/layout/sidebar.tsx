"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingCart,
  Package,
  BarChart3,
  History,
  HelpCircle,
  Plus,
  LayoutDashboard,
  Users,
  Contact,
  Clapperboard,
  Building2,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Lock,
  LockOpen,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useStoreName } from "@/hooks/use-store-name";
import { useStoreLogo } from "@/hooks/use-store-logo";
import { useToolAccess } from "@/hooks/use-tool-access";
import { useToast } from "@/components/ui/toast";
import type { UnlockableTool } from "@/features/settings/tool-access";
import { StoreSelector } from "@/features/stores/components/store-selector";

const SUPPORT_WHATSAPP = "558592178804";

interface NavItem {
  href: string;
  label: string;
  icon: typeof ShoppingCart;
  gate?: "reports" | "management" | "admin";
  /**
   * Ferramenta que o admin pode liberar por loja (cadeado). Sem isto, item
   * bloqueado simplesmente não aparece — é o caso de Gestão e Lojas, que
   * carregam criação de usuário e exclusão em cascata e por isso nunca são
   * liberáveis para vendedora. Ver `features/settings/tool-access.ts`.
   */
  unlockable?: UnlockableTool;
}

const NAV: NavItem[] = [
  { href: "/pos", label: "PDV", icon: ShoppingCart },
  { href: "/dashboard", label: "Rank de Vendas", icon: LayoutDashboard },
  { href: "/inventory", label: "Estoque", icon: Package },
  {
    href: "/reports",
    label: "Relatórios",
    icon: BarChart3,
    gate: "reports",
    unlockable: "reports",
  },
  { href: "/orders", label: "Pedidos", icon: History },
  { href: "/customers", label: "Clientes", icon: Contact },
  {
    href: "/showcase",
    label: "Vitrine",
    icon: Clapperboard,
    gate: "management",
    unlockable: "showcase",
  },
  { href: "/management", label: "Gestão", icon: Users, gate: "management" },
  { href: "/stores", label: "Lojas", icon: Building2, gate: "admin" },
];

interface SidebarProps {
  /** Recolhida: só ícones/iniciais/foto (desktop). */
  collapsed?: boolean;
  /** Alterna recolher/expandir (só no desktop). */
  onToggleCollapsed?: () => void;
  /** "desktop" = fixa na lateral; "mobile" = conteúdo do drawer. */
  variant?: "desktop" | "mobile";
  /** Chamado ao navegar (fecha o drawer no mobile). */
  onNavigate?: () => void;
}

/**
 * Navegação lateral.
 *
 * - Desktop: pode recolher para uma faixa compacta (ícones + iniciais da loja +
 *   foto do usuário), com botão de seta.
 * - Mobile: renderizada sempre expandida dentro do drawer do AppShell. Rola
 *   internamente (overflow-y-auto) para caber em telas baixas.
 *
 * Alvos de toque: todos os itens têm no mínimo 44px de altura, atendendo às
 * diretrizes de acessibilidade para toque no celular.
 */
export function Sidebar({
  collapsed = false,
  onToggleCollapsed,
  variant = "desktop",
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const { canSeeReports, canSeeManagement, role, fullName, signOut } =
    useAuth();
  const isAdmin = role === "admin";
  const { theme, toggle } = useTheme();
  const storeName = useStoreName();
  // Imagem de perfil unificada: logotipo da marca, com fallback para a foto
  // cadastrada em Lojas (ver getStoreLogoAction).
  const photoUrl = useStoreLogo();
  const toast = useToast();
  const { access, canToggle, toggle: toggleTool } = useToolAccess();

  /** O papel é o piso; o cadeado da loja só ADICIONA acesso para a vendedora. */
  const isAllowed = (item: NavItem): boolean => {
    if (item.gate === "admin") return isAdmin;
    if (item.gate === "reports") return canSeeReports || access.reports;
    if (item.gate === "management") {
      if (canSeeManagement) return true;
      return item.unlockable ? access[item.unlockable] : false;
    }
    return true;
  };

  // Item bloqueado só aparece (com cadeado) se for liberável. Gestão e Lojas
  // continuam invisíveis para quem não tem o papel.
  const visible = NAV.filter((item) => isAllowed(item) || item.unlockable);

  const avisarBloqueio = (label: string) => {
    toast.error(
      `${label} está bloqueado para o seu usuário. Peça a liberação ao responsável pela loja.`,
    );
  };

  const alternarCadeado = async (tool: UnlockableTool, label: string) => {
    if (!canToggle) {
      toast.error(
        "Selecione uma loja específica no seletor para liberar ferramentas.",
      );
      return;
    }
    const habilitar = !access[tool];
    try {
      await toggleTool.mutateAsync({ tool, enabled: habilitar });
      toast.success(
        habilitar
          ? `${label} liberado para esta loja.`
          : `${label} bloqueado para esta loja.`,
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível alterar o acesso.",
      );
    }
  };

  const initials = (fullName ?? "BS")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const storeInitials = (storeName || "BS")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Só recolhe no desktop; no drawer mobile fica sempre expandida.
  const isCollapsed = variant === "desktop" && collapsed;

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-outline-variant/50 bg-surface py-lg scrollbar-slim transition-[width] duration-300 ease-out",
        isCollapsed ? "w-20 px-2" : "w-64 px-md",
      )}
    >
      {/* Cabeçalho: foto + loja (+ botão de recolher no desktop) */}
      <div className="relative shrink-0">
        {variant === "desktop" && onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
            title={isCollapsed ? "Expandir" : "Recolher"}
            className="absolute -right-1 top-0 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant/60 bg-surface text-on-surface-variant shadow-level-1 transition-colors hover:bg-surface-container"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            ) : (
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        )}

        <div
          className={cn(
            "flex min-w-0 flex-col items-center text-center",
            isCollapsed ? "px-0" : "px-sm",
          )}
        >
          <div
            className={cn(
              "shrink-0 overflow-hidden rounded-full bg-primary-fixed/60 ring-2 ring-primary-container transition-all",
              isCollapsed ? "h-11 w-11" : "h-16 w-16",
            )}
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={fullName ?? "Perfil"}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-headline-md font-semibold text-primary">
                {initials}
              </span>
            )}
          </div>

          {!isCollapsed && fullName && (
            <p className="mt-2 w-full truncate text-label-md font-medium text-on-surface">
              {fullName}
            </p>
          )}

          {isCollapsed ? (
            <span
              className="font-logo mt-2 text-[1.4rem] leading-none text-primary"
              title={storeName}
            >
              {storeInitials}
            </span>
          ) : (
            <>
              <h1 className="font-logo mt-1 w-full break-words text-[2rem] leading-tight text-primary">
                {storeName}
              </h1>
              <p className="mt-1 text-label-sm uppercase tracking-wide text-on-surface-variant">
                BUILD.SALES - PDV
              </p>
            </>
          )}
        </div>
      </div>

      <nav className="mt-lg flex shrink-0 flex-col gap-1">
        {visible.map((item) => {
          const { href, label, icon: Icon, unlockable } = item;
          const active = pathname.startsWith(href);
          const allowed = isAllowed(item);

          // Classe compartilhada entre o link e o botão bloqueado, para os dois
          // ficarem idênticos em altura e alinhamento.
          const base = cn(
            // min-h-[44px]: alvo de toque adequado no mobile.
            "relative flex min-h-[44px] w-full items-center rounded-full text-label-md transition-colors",
            isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3",
            !allowed
              ? "cursor-not-allowed text-on-surface-variant/50 hover:bg-surface-container/60"
              : active
                ? "bg-primary-fixed/60 text-primary"
                : "text-on-surface-variant hover:bg-surface-container",
          );

          // Cadeado do admin: mostra e alterna o estado da loja. Some quando a
          // sidebar está recolhida (não há espaço) — o admin expande para usar.
          const cadeadoAdmin =
            isAdmin && unlockable && !isCollapsed ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void alternarCadeado(unlockable, label);
                }}
                disabled={toggleTool.isPending}
                aria-label={
                  access[unlockable]
                    ? `Bloquear ${label} para esta loja`
                    : `Liberar ${label} para esta loja`
                }
                title={
                  access[unlockable]
                    ? `Liberado para vendedoras — clique para bloquear`
                    : `Bloqueado para vendedoras — clique para liberar`
                }
                className={cn(
                  "ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                  access[unlockable]
                    ? "text-primary hover:bg-primary-fixed/60"
                    : "text-on-surface-variant/60 hover:bg-surface-container",
                )}
              >
                {access[unlockable] ? (
                  <LockOpen className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <Lock className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>
            ) : null;

          const conteudo = (
            <>
              {active && allowed && !isCollapsed && (
                <span className="absolute right-0 h-6 w-1 rounded-full bg-primary" />
              )}
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
              {!isCollapsed && <span className="truncate">{label}</span>}
              {!allowed && (
                <Lock
                  className={cn("h-4 w-4 shrink-0", isCollapsed ? "" : "ml-auto")}
                  strokeWidth={1.75}
                />
              )}
              {cadeadoAdmin}
            </>
          );

          // Sem permissão: não é link. Clicar explica o bloqueio.
          if (!allowed) {
            return (
              <button
                key={href}
                type="button"
                onClick={() => avisarBloqueio(label)}
                title={isCollapsed ? `${label} (bloqueado)` : undefined}
                className={base}
              >
                {conteudo}
              </button>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              title={isCollapsed ? label : undefined}
              className={base}
            >
              {conteudo}
            </Link>
          );
        })}
      </nav>

      {/* Seletor global de loja — admin, só quando expandida */}
      {isAdmin && !isCollapsed && (
        <div className="mt-md shrink-0">
          <StoreSelector />
        </div>
      )}

      <div className="mt-auto flex shrink-0 flex-col gap-md pt-md">
        <Link href="/pos" onClick={onNavigate}>
          <Button
            className={cn("w-full", isCollapsed && "px-0")}
            size="lg"
            title={isCollapsed ? "Nova Venda" : undefined}
          >
            <Plus className="h-5 w-5 shrink-0" strokeWidth={2} />
            {!isCollapsed && "Nova Venda"}
          </Button>
        </Link>

        <div className="flex flex-col gap-1">
          <button
            onClick={toggle}
            title={
              isCollapsed
                ? theme === "dark"
                  ? "Tema claro"
                  : "Tema escuro"
                : undefined
            }
            className={cn(
              "flex min-h-[44px] items-center rounded-full py-2.5 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container",
              isCollapsed ? "justify-center px-0" : "gap-3 px-4",
            )}
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5 shrink-0" strokeWidth={1.75} />
            ) : (
              <Moon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
            )}
            {!isCollapsed && (theme === "dark" ? "Tema claro" : "Tema escuro")}
          </button>

          <a
            href={`https://wa.me/${SUPPORT_WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            title={isCollapsed ? "Suporte" : undefined}
            className={cn(
              "flex min-h-[44px] items-center rounded-full py-2.5 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container",
              isCollapsed ? "justify-center px-0" : "gap-3 px-4",
            )}
          >
            <HelpCircle className="h-5 w-5 shrink-0" strokeWidth={1.75} />
            {!isCollapsed && "Suporte"}
          </a>

          <button
            onClick={signOut}
            title={isCollapsed ? "Sair" : undefined}
            className={cn(
              "flex min-h-[44px] items-center rounded-full py-2.5 text-label-md text-error transition-colors hover:bg-error-container hover:text-on-error-container",
              isCollapsed ? "justify-center px-0" : "gap-3 px-4",
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.75} />
            {!isCollapsed && "Sair"}
          </button>
        </div>
      </div>
    </aside>
  );
}
