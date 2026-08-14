import type { Role } from "@/types/domain";

/**
 * Cadeado por loja — TODAS as ferramentas da sidebar.
 *
 * Constantes seguras para importar no cliente (sem "server-only" aqui).
 *
 * ## Como funciona
 *
 * Cada ferramenta tem um PADRÃO derivado do papel (é o comportamento histórico
 * do sistema) e um OVERRIDE opcional POR PAPEL e por loja, gravado em
 * `settings`:
 *
 *   efetivo(papel) = override[ferramenta][papel] ?? padrãoDoPapel
 *
 * O override existe nos dois sentidos: o admin pode **liberar** algo que o
 * papel não dá (Relatórios para a vendedora) e **bloquear** algo que o papel
 * daria (tirar Pedidos das vendedoras). Ausente = segue o papel.
 *
 * O override é por papel — e não um booleano único para todos os não-admin —
 * porque "liberar" e "bloquear" só fazem sentido apontando para quem: liberar
 * Relatórios para a lojista é diferente de liberar para a vendedora, e o modal
 * do cadeado pede exatamente essa escolha.
 *
 * ## Duas travas deliberadas
 *
 * 1. **Admin nunca é bloqueado.** O cadeado é editado pela própria sidebar; se
 *    um admin pudesse trancar Gestão para si mesmo, ficaria sem caminho de
 *    volta e só sairia disso por SQL. Para o admin, o cadeado exibe e edita o
 *    estado dos DEMAIS papéis — nunca o acesso dele.
 *
 * 2. **`stores` não é liberável para não-admin.** Aquela tela exclui a loja
 *    inteira em cascata (produtos, vendas, clientes, mídias). Segue admin-only
 *    por papel, e a própria tela recusa não-admin como segunda barreira.
 *
 * ## Alcance
 *
 * Isto é controle de VISIBILIDADE de tela. O isolamento de dados entre lojas
 * continua sendo a RLS no Postgres, e as ações sensíveis (criar usuário,
 * estornar venda, cadastrar produto) mantêm as próprias checagens de papel no
 * servidor. Liberar uma tela não libera o que a tela faz.
 */

export const TOOL_ACCESS_KEY = "tool_access";

export type ToolKey =
  | "pos"
  | "dashboard"
  | "inventory"
  | "reports"
  | "orders"
  | "customers"
  | "showcase"
  | "management"
  | "stores";

/** Papéis que o cadeado consegue editar. Admin nunca entra aqui (trava 1). */
export const LOCKABLE_ROLES = ["lojista", "vendedora"] as const;
export type LockableRole = (typeof LOCKABLE_ROLES)[number];

export const ROLE_LABEL: Record<LockableRole, string> = {
  lojista: "Lojista",
  vendedora: "Vendedora",
};

/** Override de uma ferramenta por papel. Papel ausente = segue o padrão. */
export type RoleAccess = Partial<Record<LockableRole, boolean>>;

/** Override por loja: ferramenta → papel → liberado/bloqueado. */
export type ToolAccess = Partial<Record<ToolKey, RoleAccess>>;

export const DEFAULT_TOOL_ACCESS: ToolAccess = {};

interface ToolMeta {
  key: ToolKey;
  label: string;
  /** Papéis que enxergam a ferramenta quando não há override. */
  defaultRoles: Role[];
  /**
   * false = o override não pode LIBERAR para quem o papel não permite.
   * Só `stores` cai aqui (exclusão de loja em cascata).
   */
  unlockable: boolean;
}

const TODOS: Role[] = ["vendedora", "lojista", "admin"];
const GESTAO: Role[] = ["lojista", "admin"];
const SO_ADMIN: Role[] = ["admin"];

/**
 * Padrões por perfil (requisitos 2 e 3):
 *
 * - Vendedora: PDV, Rank de Vendas, Estoque, Pedidos, Vitrine, Clientes.
 * - Lojista: os acima + Relatórios e Gestão. Sem "Lojas".
 * - Admin: tudo.
 */
export const TOOLS: ToolMeta[] = [
  { key: "pos", label: "PDV", defaultRoles: TODOS, unlockable: true },
  { key: "dashboard", label: "Rank de Vendas", defaultRoles: TODOS, unlockable: true },
  { key: "inventory", label: "Estoque", defaultRoles: TODOS, unlockable: true },
  { key: "reports", label: "Relatórios", defaultRoles: GESTAO, unlockable: true },
  { key: "orders", label: "Pedidos", defaultRoles: TODOS, unlockable: true },
  { key: "customers", label: "Clientes", defaultRoles: TODOS, unlockable: true },
  { key: "showcase", label: "Vitrine", defaultRoles: TODOS, unlockable: true },
  { key: "management", label: "Gestão", defaultRoles: GESTAO, unlockable: true },
  { key: "stores", label: "Lojas", defaultRoles: SO_ADMIN, unlockable: false },
];

export const TOOL_BY_KEY: Record<ToolKey, ToolMeta> = TOOLS.reduce(
  (acc, t) => {
    acc[t.key] = t;
    return acc;
  },
  {} as Record<ToolKey, ToolMeta>,
);

export function toolLabel(key: ToolKey): string {
  return TOOL_BY_KEY[key]?.label ?? key;
}

/** Acesso que o papel dá, ignorando o cadeado. */
export function allowedByRole(key: ToolKey, role: Role): boolean {
  return TOOL_BY_KEY[key]?.defaultRoles.includes(role) ?? false;
}

/** O cadeado consegue mexer neste papel? (admin, não — ver trava 1) */
export function isLockableRole(role: Role): role is LockableRole {
  return role === "lojista" || role === "vendedora";
}

/**
 * Acesso efetivo: override do papel sobre o padrão do papel.
 *
 * Admin passa por cima de tudo (trava 1), e nenhum override consegue liberar
 * uma ferramenta não-liberável (trava 2).
 */
export function resolveToolAccess(
  key: ToolKey,
  role: Role,
  overrides: ToolAccess,
): boolean {
  if (role === "admin") return true;

  const meta = TOOL_BY_KEY[key];
  if (!meta) return false;

  const porPapel = meta.defaultRoles.includes(role);
  if (!isLockableRole(role)) return porPapel;

  const override = overrides[key]?.[role];
  if (override === undefined) return porPapel;

  // Bloquear sempre vale; liberar só quando a ferramenta é liberável.
  if (override === false) return false;
  return meta.unlockable ? true : porPapel;
}

/**
 * Estado que o modal do cadeado mostra para um papel: só dois, "liberado" e
 * "bloqueado" (requisito 5). Sem override, o estado exibido é o que o papel já
 * dá — assim o admin sempre vê a verdade, não um terceiro estado abstrato.
 */
export function roleUnlocked(
  key: ToolKey,
  role: LockableRole,
  overrides: ToolAccess,
): boolean {
  return resolveToolAccess(key, role, overrides);
}

/** Lê o JSON do settings com tolerância a valor ausente/corrompido. */
export function parseToolAccess(raw: string | null | undefined): ToolAccess {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: ToolAccess = {};
    for (const t of TOOLS) {
      const v = parsed[t.key];

      // Formato antigo: booleano único valendo para todos os não-admin.
      // Migrado na leitura para não exigir migração de banco.
      if (v === true || v === false) {
        out[t.key] = { lojista: v, vendedora: v };
        continue;
      }

      if (v && typeof v === "object") {
        const obj = v as Record<string, unknown>;
        const papeis: RoleAccess = {};
        for (const r of LOCKABLE_ROLES) {
          const rv = obj[r];
          // Só booleano estrito conta; qualquer outra coisa volta ao padrão.
          if (rv === true || rv === false) papeis[r] = rv;
        }
        if (Object.keys(papeis).length > 0) out[t.key] = papeis;
      }
    }
    return out;
  } catch {
    return {};
  }
}
