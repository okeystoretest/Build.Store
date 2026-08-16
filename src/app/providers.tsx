"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";

/**
 * Providers do layout RAIZ — os que valem para todas as rotas, inclusive
 * `/login`: cache de dados e avisos.
 *
 * O `StoreProvider` NÃO mora mais aqui. Ele consulta `useAuth()`, e o layout
 * raiz também serve a tela de login: o resultado era disparar a busca da
 * sessão com o usuário ainda deslogado, gravar o retrato anônimo no cache como
 * se fosse resposta boa, e mantê-lo lá depois do login (a navegação pós-login
 * não recarregava o documento, então o cache sobrevivia). Daí a interface
 * incompleta até o `Ctrl+Shift+R`. Agora o seletor de loja vive dentro do
 * layout de `(app)`, que só existe atrás da autenticação.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
