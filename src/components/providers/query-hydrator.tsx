"use client";

import { useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Ponte entre o que o servidor já sabe e o cache do cliente.
 *
 * O layout de `(app)` roda no servidor com o cookie de sessão em mãos: ele já
 * conhece o papel do usuário e a lista de lojas antes de o navegador pintar
 * qualquer pixel. Sem esta ponte, esse conhecimento era jogado fora e o
 * cliente recomeçava do zero — montava a interface como "vendedora anônima",
 * disparava `me()`, e só depois da resposta redesenhava com o papel certo.
 * Nesse intervalo o seletor de loja não existia e as telas de admin exibiam a
 * negativa de permissão.
 *
 * Semeando o cache aqui, o PRIMEIRO render já tem os dados certos: nada de
 * piscada, nada de segunda ida ao servidor.
 *
 * ## Por que semear durante o render, e não num efeito
 *
 * Um `useEffect` só roda DEPOIS que os filhos renderizaram — tarde demais,
 * porque o primeiro render é justamente o que queremos consertar. Gravar no
 * cache durante o render é o mesmo mecanismo que o `HydrationBoundary` do
 * próprio TanStack usa, e é idempotente: o guarda de assinatura abaixo impede
 * que a repetição do render (StrictMode) grave duas vezes.
 */

export interface HydrationEntry {
  key: readonly unknown[];
  data: unknown;
  /**
   * - `always` (padrão): o servidor é a verdade; sobrescreve o que estiver lá.
   *   É o caso da sessão — um retrato anônimo remanescente precisa cair.
   * - `if-missing`: só preenche o vazio, para não atropelar dados que o
   *   cliente já revalidou (ex.: a lista de lojas depois de criar uma).
   */
  mode?: "always" | "if-missing";
}

export function QueryHydrator({
  entries,
  children,
}: {
  entries: HydrationEntry[];
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  // Assinatura do que já foi semeado. Enquanto o servidor mandar o mesmo
  // payload, não tocamos no cache; quando ele mudar (router.refresh(), nova
  // navegação de documento), semeamos de novo.
  const semeado = useRef<string | null>(null);
  const assinatura = JSON.stringify(entries);

  if (semeado.current !== assinatura) {
    for (const { key, data, mode = "always" } of entries) {
      if (data === undefined) continue;
      if (mode === "if-missing" && queryClient.getQueryData(key) !== undefined) {
        continue;
      }
      queryClient.setQueryData(key, data);
    }
    semeado.current = assinatura;
  }

  return <>{children}</>;
}
