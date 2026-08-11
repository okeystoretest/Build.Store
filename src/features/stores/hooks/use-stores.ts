"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listStores,
  createStore,
  updateStore,
  deleteStore,
} from "@/lib/db/store-repository";
import type { Store } from "@/types/domain";

const STORES_KEY = ["stores"] as const;

/** Lista de lojas (para o seletor global e o módulo Gestão › Lojas). */
export function useStores() {
  const query = useQuery<Store[]>({
    queryKey: STORES_KEY,
    queryFn: listStores,
  });

  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: STORES_KEY });

  const create = useMutation({
    mutationFn: createStore,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (vars: {
      id: string;
      patch: Partial<Pick<Store, "name" | "logoUrl" | "active">>;
    }) => updateStore(vars.id, vars.patch),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteStore(id),
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
