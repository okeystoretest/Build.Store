/**
 * Liberação de ferramentas por loja (o cadeado da sidebar).
 *
 * Constantes seguras para importar no cliente — sem "server-only" aqui.
 *
 * ## O que é liberável, e por quê só isto
 *
 * O cadeado libera ferramentas de LEITURA que, por padrão, a vendedora não vê:
 * Relatórios e Vitrine. Gestão e Lojas ficam **permanentemente fora** desta
 * lista, e isso é deliberado:
 *
 *   - Gestão cria/remove usuários e define metas. Liberar para uma vendedora
 *     seria dar a ela o poder de criar um admin — escalada de privilégio.
 *   - Lojas exclui a loja inteira em cascata (produtos, vendas, clientes).
 *
 * Papel continua sendo o piso: lojista e admin já enxergam tudo que lhes cabe,
 * independentemente do cadeado. O cadeado só ADICIONA acesso para a vendedora.
 *
 * ## Importante: isto é visibilidade, não isolamento
 *
 * A barreira real de dados continua sendo a RLS por loja no Postgres — nenhuma
 * liberação aqui faz um usuário enxergar dados de OUTRA loja. O cadeado decide
 * quais telas da própria loja a vendedora acessa.
 */

export const TOOL_ACCESS_KEY = "tool_access";

export type UnlockableTool = "reports" | "showcase";

export interface ToolAccess {
  reports: boolean;
  showcase: boolean;
}

/** Padrão: tudo trancado para a vendedora (comportamento atual do sistema). */
export const DEFAULT_TOOL_ACCESS: ToolAccess = {
  reports: false,
  showcase: false,
};

export const UNLOCKABLE_TOOLS: { key: UnlockableTool; label: string }[] = [
  { key: "reports", label: "Relatórios" },
  { key: "showcase", label: "Vitrine" },
];

/** Lê o JSON do settings com tolerância a valor ausente/corrompido. */
export function parseToolAccess(raw: string | null | undefined): ToolAccess {
  if (!raw) return { ...DEFAULT_TOOL_ACCESS };
  try {
    const parsed = JSON.parse(raw) as Partial<ToolAccess>;
    return {
      reports: parsed.reports === true,
      showcase: parsed.showcase === true,
    };
  } catch {
    return { ...DEFAULT_TOOL_ACCESS };
  }
}
