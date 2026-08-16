import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { StoreProvider } from "@/features/stores/store-context";
import {
  QueryHydrator,
  type HydrationEntry,
} from "@/components/providers/query-hydrator";
import { loadSessionSnapshot } from "@/features/auth/session-snapshot";
import { listStoresAction } from "@/features/stores/actions/stores";
import { queryKeys } from "@/lib/db/query-keys";

/**
 * Shell das telas autenticadas.
 *
 * Este layout resolve a sessão NO SERVIDOR, antes de o navegador pintar
 * qualquer coisa, e entrega o resultado pronto ao cache do cliente. É o que
 * faz a interface nascer completa: papel correto, seletor de loja no lugar e
 * lista de lojas já carregada no primeiro acesso — sem recarregamento manual.
 *
 * `force-dynamic` porque a resposta depende do cookie de sessão. Sem isso o
 * Next trataria estas rotas como estáticas e serviria a mesma casca a todo
 * mundo (e um proxy à frente poderia guardá-la), que é a outra metade do
 * sintoma de "cache" relatado.
 */
export const dynamic = "force-dynamic";

/**
 * Lista de lojas para semear o seletor do admin. Falha aqui não pode derrubar
 * a página: o cliente refaz a busca por conta própria em seguida.
 */
async function lojasParaOAdmin() {
  try {
    return await listStoresAction();
  } catch {
    return undefined;
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await loadSessionSnapshot();

  // Segunda linha de defesa. O middleware só consegue checar a PRESENÇA do
  // cookie (roda no Edge, sem banco); aqui a sessão é validada de verdade, e
  // um cookie órfão — sessão expirada ou invalidada noutro dispositivo — cai
  // no login em vez de renderizar um shell sem dono.
  if (!session.userId) redirect("/login");

  const entries: HydrationEntry[] = [
    { key: queryKeys.auth, data: session, mode: "always" },
  ];

  // Só o admin alterna entre lojas; para os demais a lista seria peso morto.
  if (session.role === "admin") {
    entries.push({
      key: queryKeys.stores,
      data: await lojasParaOAdmin(),
      mode: "if-missing",
    });
  }

  return (
    <QueryHydrator entries={entries}>
      <StoreProvider>
        <AppShell>{children}</AppShell>
      </StoreProvider>
    </QueryHydrator>
  );
}
