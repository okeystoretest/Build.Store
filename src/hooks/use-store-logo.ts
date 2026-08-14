"use client";

import { useQuery } from "@tanstack/react-query";
import { getStoreLogoAction } from "@/features/settings/actions/settings";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";
import { useStoreContext } from "@/features/stores/store-context";
import { useAuth } from "@/hooks/use-auth";

/**
 * Logotipo da loja ATIVA. Segue a mesma resolução de loja do useStoreName.
 * Retorna null quando não há logo (ou admin em "todas as lojas") — quem exibe
 * trata o nulo com a imagem padrão (ver `StoreAvatar`).
 *
 * Assim como no nome, a foto que veio na sessão (`me()`) é o valor imediato
 * para vendedora/lojista: a query depende do `storeId` do contexto, que só
 * existe depois da resposta do `me()`. Era esse intervalo — com o resultado
 * nulo já gravado no cache sob a chave `[..., null]` — que deixava o perfil
 * sem foto logo depois do login.
 */
export function useStoreLogo(): string | null {
  const { activeStoreId } = useStoreContext();
  const { storeId: sessionStoreId, storeLogoUrl } = useAuth();
  useRealtimeInvalidation("settings", ["settings"]);

  const { data } = useQuery({
    queryKey: ["settings", "logo", activeStoreId],
    queryFn: () => getStoreLogoAction(activeStoreId),
    enabled: Boolean(activeStoreId),
  });

  const daSessao =
    sessionStoreId && (!activeStoreId || activeStoreId === sessionStoreId)
      ? storeLogoUrl
      : null;

  return data ?? daSessao ?? null;
}
