"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listStoresAction,
  createStoreAction,
  updateStoreAction,
  deleteStoreAction,
} from "@/features/stores/actions/stores";
import type { Store } from "@/types/domain";

const STORES_KEY = ["stores"] as const;

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
      // Uma loja pode ter sumido; recarrega o resto também.
      queryClient.invalidateQueries();
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
