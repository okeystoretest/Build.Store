"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listStoresAction,
  createStoreAction,
  updateStoreAction,
  deleteStoreAction,
} from "@/features/stores/actions/stores";
import { queryKeys } from "@/lib/db/query-keys";
import type { Store } from "@/types/domain";

/**
 * Mesma chave usada pelo layout de `(app)` para semear a lista no servidor —
 * por isso ela mora em `query-keys`, e não solta aqui dentro. Divergir as duas
 * grafias significaria semear uma chave que ninguém lê, e o seletor voltaria a
 * abrir vazio.
 */
const STORES_KEY = queryKeys.stores;

/** Lista de lojas (para o seletor global e o módulo Gestão › Lojas). */
export function useStores() {
  const query = useQuery<Store[]>({
    queryKey: STORES_KEY,
    // IMPORTANTE: tem que ser arrow function. Passar a Server Action direto faz
    // o React Query chamá-la com o QueryFunctionContext ({ queryKey, signal,
    // client, ... }), que contém instâncias de classe (AbortSignal, QueryClient).
    // Server Action só aceita objeto simples como argumento, então isso dispara
    // "Only plain objects, and a few built-ins, can be passed to Server Actions"
    // e a query falha (a lista fica sempre vazia).
    queryFn: () => listStoresAction(),
  });

  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: STORES_KEY });

  const create = useMutation({
    // Mesmo motivo do queryFn acima: sempre envolver em arrow function.
    mutationFn: (vars: { name: string; logoUrl?: string | null }) =>
      createStoreAction(vars),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (vars: {
      id: string;
      patch: Partial<Pick<Store, "name" | "logoUrl" | "active">>;
    }) => updateStoreAction(vars.id, vars.patch),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteStoreAction(id),
    onSuccess: () => {
      invalidate();
      // Uma loja pode ter sumido; recarrega o resto também — menos a sessão,
      // que não muda por causa disso e cujo descarte faria menu e permissões
      // voltarem ao estado "carregando" sem motivo.
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== queryKeys.auth[0],
      });
    },
  });

  return {
    stores: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    create,
    update,
    remove,
  };
}
