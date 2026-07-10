"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { Customer } from "@/types/domain";
import { formatPhone } from "@/lib/utils/phone";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

interface CustomerAutocompleteProps {
  /** Texto atual (nome do cliente digitado/selecionado). */
  value: string;
  onChange: (value: string) => void;
  /** Todos os clientes (vindos do cache; a filtragem é local e instantânea). */
  customers: Customer[];
  /** Chamado ao escolher um cliente da lista (define nome + id). */
  onSelect: (customer: Customer) => void;
  /** Limpa a associação com um cliente quando o texto muda manualmente. */
  onClearSelection?: () => void;
}

/**
 * Autocomplete de cliente para o PDV. Ao digitar, sugere clientes que casem por
 * Nome OU Código (mínimo 5 sugestões quando houver). A seleção preenche o nome
 * e devolve o cliente para a venda gravar o customer_id.
 *
 * A busca é local sobre a lista já carregada (cache do TanStack Query),
 * garantindo resposta imediata; o Realtime mantém a lista atualizada.
 */
export function CustomerAutocomplete({
  value,
  onChange,
  customers,
  onSelect,
  onClearSelection,
}: CustomerAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Sugestões: casa por nome ou código; sem texto, mostra os primeiros.
  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    const base = q.length === 0
      ? customers
      : customers.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.code ?? "").toLowerCase().includes(q),
        );
    // Mostra no mínimo 5 (quando existirem); teto de 8 para não poluir.
    return base.slice(0, 8);
  }, [value, customers]);

  // Fecha ao clicar fora.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => setHighlight(0), [value]);

  const choose = (c: Customer) => {
    onSelect(c);
    onChange(c.name);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
          strokeWidth={1.75}
        />
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            onClearSelection?.();
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              setOpen(true);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter" && open && suggestions[highlight]) {
              e.preventDefault();
              choose(suggestions[highlight]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Buscar por nome ou código"
          aria-label="Buscar cliente"
          autoComplete="off"
          className="pl-12"
        />
      </div>

      {open && suggestions.length > 0 && (
        <ul className="animate-fade-in-up absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-outline-variant/60 bg-surface-container-lowest py-1 shadow-level-2 scrollbar-slim">
          {suggestions.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => choose(c)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  i === highlight
                    ? "bg-primary-fixed/50"
                    : "hover:bg-surface-container",
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-label-sm font-semibold text-primary">
                  {c.code ? c.code.replace(/[^0-9]/g, "").slice(-2) : "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-md text-on-surface">
                    {c.name}
                  </span>
                  <span className="block truncate text-label-sm text-on-surface-variant">
                    {c.code ?? "sem código"}
                    {c.phone ? ` · ${formatPhone(c.phone)}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
