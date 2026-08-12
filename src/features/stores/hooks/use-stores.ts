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
    queryFn: listStoresAction,
  });

  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: STORES_KEY });

  const create = useMutation({
    mutationFn: createStoreAction,
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
