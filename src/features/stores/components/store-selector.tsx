"use client";

import { Building2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { useStoreContext } from "@/features/stores/store-context";
import { useStores } from "@/features/stores/hooks/use-stores";

/**
 * Seletor global de loja — visível só para admin. Define o escopo de todas as
 * telas (dashboard, relatórios, estoque, pedidos, clientes, e as edições do
 * admin). "Todas as lojas" (valor vazio) coloca o admin em modo consolidado.
 *
 * Para lojista/vendedora nada é renderizado (ficam travados na própria loja).
 *
 * Variantes:
 * - `full`: rótulo + `<select>`. Sidebar expandida.
 * - `icon`: botão redondo com a inicial da loja ativa. Sidebar recolhida — um
 *   `<select>` espremido em 64px vira um chevron solto sem texto, que não diz
 *   qual loja está ativa. O botão diz, e clicar expande a sidebar para trocar.
 */
export function StoreSelector({
  variant = "full",
  onExpand,
}: {
  variant?: "full" | "icon";
  /** Chamado no clique da variante `icon` — expande a sidebar. */
  onExpand?: () => void;
}) {
  const { isAdmin, activeStoreId, setActiveStoreId } = useStoreContext();
  const { stores, isLoading } = useStores();

  if (!isAdmin) return null;

  const ativa = stores.find((s) => s.id === activeStoreId) ?? null;
  const rotuloAtivo = ativa?.name ?? "Todas as lojas";

  if (variant === "icon") {
    const inicial = ativa ? ativa.name.trim().charAt(0).toUpperCase() : null;
    return (
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onExpand}
          aria-label={`Loja: ${rotuloAtivo}. Expandir para trocar`}
          title={`Loja: ${rotuloAtivo}`}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/60 bg-surface-container-low text-primary transition-colors hover:bg-surface-container"
        >
          {inicial ? (
            <span className="text-label-md font-semibold">{inicial}</span>
          ) : (
            <Building2 className="h-5 w-5" strokeWidth={1.75} />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="px-sm">
      <label className="mb-1 block text-label-sm uppercase tracking-wide text-on-surface-variant">
        Loja
      </label>
      <Select
        className="h-11"
        aria-label="Selecionar loja"
        value={activeStoreId ?? ""}
        disabled={isLoading}
        onChange={(e) => setActiveStoreId(e.target.value || null)}
      >
        <option value="">Todas as lojas</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
