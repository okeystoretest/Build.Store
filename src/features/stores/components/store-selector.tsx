"use client";

import { Select } from "@/components/ui/select";
import { useStoreContext } from "@/features/stores/store-context";
import { useStores } from "@/features/stores/hooks/use-stores";

/**
 * Seletor global de loja — visível só para admin. Define o escopo de todas as
 * telas (dashboard, relatórios, estoque, pedidos, clientes). "Todas as lojas"
 * (valor vazio) coloca o admin em modo consolidado.
 *
 * Para lojista/vendedora nada é renderizado (ficam travados na própria loja).
 */
export function StoreSelector({ compact = false }: { compact?: boolean }) {
  const { isAdmin, activeStoreId, setActiveStoreId } = useStoreContext();
  const { stores, isLoading } = useStores();

  if (!isAdmin) return null;

  return (
    <div className={compact ? "" : "px-sm"}>
      {!compact && (
        <label className="mb-1 block text-label-sm uppercase tracking-wide text-on-surface-variant">
          Loja
        </label>
      )}
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
