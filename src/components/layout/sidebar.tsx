"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingCart,
  Package,
  BarChart3,
  History,
  HelpCircle,
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
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useStoreName } from "@/hooks/use-store-name";
import { useStoreLogo } from "@/hooks/use-store-logo";
import { useToolAccess } from "@/hooks/use-tool-access";
import { useToast } from "@/components/ui/toast";
import {
  LOCKABLE_ROLES,
  toolLabel,
  type LockableRole,
  type ToolKey,
} from "@/features/settings/tool-access";
import { ToolAccessModal } from "@/components/layout/tool-access-modal";
import { StoreAvatar } from "@/components/ui/store-avatar";
import { BrandMark, BrandWordmark } from "@/components/ui/brand-logo";
import { StoreSelector } from "@/features/stores/components/store-selector";

const SUPPORT_WHATSAPP = "558592178804";

interface NavItem {
  href: string;
  label: string;
  icon: typeof ShoppingCart;
  /** Chave do cadeado. Toda ferramenta tem a sua. */
  tool: ToolKey;
}

/**
 * Ordem do menu. O rótulo e quem enxerga cada item por padrão vivem em
 * `features/settings/tool-access.ts` — aqui fica só a rota e o ícone, para não
 * haver duas fontes de verdade sobre permissão.
 */
const NAV: NavItem[] = [
  { href: "/pos", label: toolLabel("pos"), icon: ShoppingCart, tool: "pos" },
  { href: "/dashboard", label: toolLabel("dashboard"), icon: LayoutDashboard, tool: "dashboard" },
  { href: "/inventory", label: toolLabel("inventory"), icon: Package, tool: "inventory" },
  { href: "/reports", label: toolLabel("reports"), icon: BarChart3, tool: "reports" },
  { href: "/orders", label: toolLabel("orders"), icon: History, tool: "orders" },
  { href: "/customers", label: toolLabel("customers"), icon: Contact, tool: "customers" },
  { href: "/showcase", label: toolLabel("showcase"), icon: Clapperboard, tool: "showcase" },
  { href: "/management", label: toolLabel("management"), icon: Users, tool: "management" },
  { href: "/stores", label: toolLabel("stores"), icon: Building2, tool: "stores" },
];

interface SidebarProps {
  /** Recolhida: só ícones/foto (desktop). */
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
 * - Desktop: pode recolher para uma faixa compacta (logotipo curto + foto +
 *   ícones). O botão de recolher/expandir fica no rodapé, abaixo de "Sair".
 * - Mobile: renderizada sempre expandida dentro do drawer do AppShell. Rola
 *   internamente (overflow-y-auto) para caber em telas baixas.
 *
 * Hierarquia do topo: logotipo da PLATAFORMA → co-marca [foto da loja] ✕
 * [símbolo da plataforma] → régua → ferramentas. O nome da loja não é repetido
 * em texto: a foto já identifica quem está logado, e o texto grande competia
 * com o logotipo da plataforma logo acima.
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
  const { role, signOut } = useAuth();
  const isAdmin = role === "admin";
  const { theme, toggle } = useTheme();
  // Usado apenas como texto alternativo/dica da foto — não é exibido.
  const storeName = useStoreName();
  // Imagem de perfil unificada: logotipo da marca, com fallback para a foto
  // cadastrada em Lojas (ver getStoreLogoAction).
  const photoUrl = useStoreLogo();
  const toast = useToast();
  const { can, unlockedFor, isUnlockable, canToggle, save } = useToolAccess();

  // Ferramenta com o modal do cadeado aberto; null = fechado.
  const [cadeadoAberto, setCadeadoAberto] = useState<ToolKey | null>(null);

  /** Clique no cadeado (admin): abre o modal de perfis. */
  const abrirCadeado = (tool: ToolKey) => {
    if (!canToggle) {
      toast.error(
        "Selecione uma loja específica no seletor para alterar o acesso.",
      );
      return;
    }
    setCadeadoAberto(tool);
  };

  /** Estado atual de cada perfil, do jeito que o modal precisa. */
  const estadoPorPapel = (tool: ToolKey) => {
    const out = {} as Record<LockableRole, boolean>;
    for (const r of LOCKABLE_ROLES) out[r] = unlockedFor(tool, r);
    return out;
  };

  // Só recolhe no desktop; no drawer mobile fica sempre expandida.
  const isCollapsed = variant === "desktop" && collapsed;
  const podeRecolher = variant === "desktop" && Boolean(onToggleCollapsed);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-outline-variant/50 bg-surface py-lg scrollbar-slim transition-[width] duration-300 ease-out",
        isCollapsed ? "w-20 px-2" : "w-64 px-md",
      )}
    >
      {/*
        Logotipo da plataforma. Expandida: a marca nominal ("Build." primary +
        "Sales" secondary). Recolhida: o símbolo, não uma abreviação de texto —
        em 80px de largura o "B.S" era um remendo; o símbolo é a forma que a
        marca já tem para espaço curto.
      */}
      <div className="flex shrink-0 items-center justify-center">
        {isCollapsed ? (
          <BrandMark className="h-9 w-9" alt="Build.Sales" />
        ) : (
          <BrandWordmark className="text-[1.9rem]" />
        )}
      </div>

      {/*
        Perfil da loja em co-marca: [foto da loja] ✕ [símbolo da plataforma].
        O "✕" fica em `aria-hidden` — é um sinal gráfico de parceria, não texto
        a ser lido.

        Recolhida, só a foto: o símbolo já está no topo, e repeti-lo em 80px de
        largura deixaria os dois com menos de 24px cada.
      */}
      <div className="mt-md flex shrink-0 items-center justify-center gap-2">
        <StoreAvatar
          src={photoUrl}
          alt={storeName}
          className={isCollapsed ? "h-10 w-10" : "h-14 w-14"}
        />

        {!isCollapsed && (
          <>
            <span
              aria-hidden="true"
              className="select-none text-body-md font-medium text-on-surface-variant/70"
            >
              ✕
            </span>
            <BrandMark className="h-12 w-12" alt="Build.Sales" />
          </>
        )}
      </div>

      {/*
        Régua entre identificação e ferramentas: separa "quem eu sou" de "o que
        eu faço". Recolhida ela encolhe (mx-2) para não encostar nas bordas da
        faixa de 80px.
      */}
      <div
        className={cn(
          "mt-md shrink-0 border-t border-outline-variant/60",
          isCollapsed ? "mx-2" : "mx-sm",
        )}
      />

      <nav className="mt-md flex shrink-0 flex-col gap-1">
        {NAV.map((item) => {
          const { href, label, icon: Icon, tool } = item;
          const active = pathname.startsWith(href);
          const allowed = can(tool);
          // Resumo do cadeado para o ícone: liberado para os dois perfis
          // editáveis, ou não.
          const liberadoParaTodos = LOCKABLE_ROLES.every((r) =>
            unlockedFor(tool, r),
          );

          // Sem acesso, o item NÃO é renderizado. Antes ele aparecia cinza com
          // um cadeado — e "Lojas" acinzentada ainda é "Lojas" visível na tela
          // de uma vendedora, o oposto do que a regra de perfis pede.
          if (!allowed) return null;

          // Estado ativo discreto: `primary-container` a 30% de opacidade e
          // texto em `on-primary-container`. Sem sombra, sem barra lateral e
          // sem peso extra — o bloco cheio anterior chamava mais atenção que o
          // conteúdo da tela. A altura mínima de 44px permanece: é alvo de
          // toque, não decoração, e encolher o item quebraria o mobile.
          const base = cn(
            "relative flex min-h-[44px] w-full items-center rounded-full text-label-md transition-colors",
            isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-4 py-2.5",
            active
              ? "bg-primary-container/30 text-on-primary-container"
              : "text-on-surface-variant hover:bg-surface-container",
          );

          // Cadeado do admin: abre o modal de perfis. Some quando a sidebar
          // está recolhida (não há espaço) — o admin expande para usar.
          const cadeadoAdmin =
            isAdmin && !isCollapsed ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  abrirCadeado(tool);
                }}
                disabled={save.isPending}
                aria-label={`Alterar acesso de ${label} nesta loja`}
                title={
                  liberadoParaTodos
                    ? "Liberado para lojista e vendedora — clique para escolher os perfis"
                    : "Restrito — clique para escolher os perfis"
                }
                className={cn(
                  "ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                  liberadoParaTodos
                    ? "text-primary hover:bg-primary-fixed/60"
                    : "text-error hover:bg-error/10",
                )}
              >
                {liberadoParaTodos ? (
                  <LockOpen className="h-4 w-4" strokeWidth={1.75} />
                ) : (
                  <Lock className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>
            ) : null;

          const conteudo = (
            <>
              <Icon
                className="h-5 w-5 shrink-0"
                strokeWidth={active ? 2 : 1.75}
              />
              {!isCollapsed && <span className="truncate">{label}</span>}
              {cadeadoAdmin}
            </>
          );

          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              title={isCollapsed ? label : undefined}
              aria-current={active ? "page" : undefined}
              className={base}
            >
              {conteudo}
            </Link>
          );
        })}
      </nav>

      {/*
        Seletor global de loja — permanente para o admin (requisito 4). Fica
        visível também com a sidebar recolhida: o escopo da loja decide o que
        toda edição do admin atinge, então escondê-lo é esconder a informação
        mais importante da tela.
      */}
      {isAdmin && (
        <div className="mt-md shrink-0">
          <StoreSelector
            variant={isCollapsed ? "icon" : "full"}
            onExpand={onToggleCollapsed}
          />
        </div>
      )}

      {/*
        Rodapé: tema, suporte, sair e — logo abaixo de Sair — recolher/expandir.
        A linha separadora acima existe para eles não serem lidos como mais
        ferramentas do menu: são ações do aplicativo, de natureza diferente.
      */}
      <div
        className={cn(
          "mt-auto flex shrink-0 flex-col gap-md border-t border-outline-variant/60 pt-md",
          isCollapsed ? "mx-2" : "mx-sm",
        )}
      >
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

          {/*
            Recolher/expandir. Saiu do cabeçalho (onde, recolhida, um botão
            flutuante de 32px cobria metade do avatar) e virou a última ação da
            lista, logo abaixo de Sair. No drawer mobile não existe: a sidebar
            ali é sempre expandida.
          */}
          {podeRecolher && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={isCollapsed ? "Expandir menu" : "Recolher menu"}
              title={isCollapsed ? "Expandir" : "Recolher"}
              aria-expanded={!isCollapsed}
              className={cn(
                "flex min-h-[44px] items-center rounded-full py-2.5 text-label-md text-on-surface-variant transition-colors hover:bg-surface-container",
                isCollapsed ? "justify-center px-0" : "gap-3 px-4",
              )}
            >
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5 shrink-0" strokeWidth={1.75} />
              ) : (
                <ChevronLeft className="h-5 w-5 shrink-0" strokeWidth={1.75} />
              )}
              {!isCollapsed && "Recolher menu"}
            </button>
          )}
        </div>
      </div>

      {cadeadoAberto && (
        <ToolAccessModal
          tool={cadeadoAberto}
          atual={estadoPorPapel(cadeadoAberto)}
          unlockable={isUnlockable(cadeadoAberto)}
          saving={save.isPending}
          onClose={() => setCadeadoAberto(null)}
          onSave={async (papeis) => {
            const tool = cadeadoAberto;
            try {
              await save.mutateAsync({ tool, papeis });
              toast.success(`${toolLabel(tool)}: acesso atualizado.`);
              setCadeadoAberto(null);
            } catch (e) {
              toast.error(
                e instanceof Error
                  ? e.message
                  : "Não foi possível alterar o acesso.",
              );
            }
          }}
        />
      )}
    </aside>
  );
}
