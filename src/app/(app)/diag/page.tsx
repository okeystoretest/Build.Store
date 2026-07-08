"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/sync/transport";

/**
 * Página de diagnóstico de sincronização (/diag).
 *
 * Roda cada leitura do Supabase isoladamente e mostra, NA TELA, o resultado de
 * cada uma: quantidade de linhas ou o erro exato (código Postgres + mensagem +
 * hint). Serve para identificar rapidamente qual pull retorna 500/empty e por
 * quê, sem depender de decifrar o console. Não altera dados.
 */

interface ProbeResult {
  name: string;
  ok: boolean;
  count?: number;
  code?: string | null;
  message?: string | null;
  hint?: string | null;
  details?: string | null;
}

export default function DiagPage() {
  const [session, setSession] = useState<{
    userId: string | null;
    email: string | null;
    storeId: string | null;
    storeIdError: string | null;
  }>({ userId: null, email: null, storeId: null, storeIdError: null });
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    const run = async () => {
      setRunning(true);
      if (!isSupabaseConfigured()) {
        setResults([
          { name: "config", ok: false, message: "Supabase não configurado." },
        ]);
        setRunning(false);
        return;
      }

      const supabase = createClient();

      // Sessão + store_id
      const {
        data: { session: sess },
      } = await supabase.auth.getSession();

      const rpc = await supabase.rpc("current_store_id");
      setSession({
        userId: sess?.user?.id ?? null,
        email: sess?.user?.email ?? null,
        storeId: (rpc.data as string) ?? null,
        storeIdError: rpc.error?.message ?? null,
      });

      // Probes: um SELECT com count exato por tabela. head:true evita trazer
      // dados — só queremos o status e a contagem sob RLS do usuário atual.
      const tables = [
        "profiles",
        "products",
        "orders",
        "order_items",
        "campaigns",
        "goals",
        "stock_movements",
        "notifications",
      ];

      const out: ProbeResult[] = [];
      for (const t of tables) {
        const { count, error } = await supabase
          .from(t)
          .select("*", { count: "exact", head: true });
        if (error) {
          out.push({
            name: t,
            ok: false,
            code: error.code ?? null,
            message: error.message ?? null,
            hint: error.hint ?? null,
            details: error.details ?? null,
          });
        } else {
          out.push({ name: t, ok: true, count: count ?? 0 });
        }
      }
      setResults(out);
      setRunning(false);
    };
    void run();
  }, []);

  return (
    <div className="min-h-screen bg-background p-6 text-on-surface">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold text-primary">
          Diagnóstico de sincronização
        </h1>

        <section className="rounded-lg border border-outline-variant/40 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
            Sessão
          </h2>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
            <dt className="text-on-surface-variant">Usuário</dt>
            <dd className="break-all">{session.userId ?? "—"}</dd>
            <dt className="text-on-surface-variant">E-mail</dt>
            <dd className="break-all">{session.email ?? "—"}</dd>
            <dt className="text-on-surface-variant">store_id</dt>
            <dd className="break-all">
              {session.storeId ?? (
                <span className="text-error">
                  NULL{session.storeIdError ? ` — ${session.storeIdError}` : ""}
                </span>
              )}
            </dd>
          </dl>
          {!session.storeId && (
            <p className="mt-3 rounded bg-error-container px-3 py-2 text-sm text-on-error-container">
              store_id nulo: o usuário logado não tem uma linha em `profiles`
              com `store_id`, ou a RPC current_store_id() não resolveu. Sem
              store_id, todas as políticas viram `store_id = NULL` e nenhum dado
              aparece (sem necessariamente dar 500).
            </p>
          )}
        </section>

        <section className="rounded-lg border border-outline-variant/40 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">
            Tabelas {running && "(verificando…)"}
          </h2>
          <div className="space-y-2">
            {results.map((r) => (
              <div
                key={r.name}
                className={`rounded-md px-3 py-2 text-sm ${
                  r.ok
                    ? "bg-surface-container"
                    : "bg-error-container text-on-error-container"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.name}</span>
                  <span>
                    {r.ok ? `OK — ${r.count} linha(s)` : `ERRO ${r.code ?? ""}`}
                  </span>
                </div>
                {!r.ok && (
                  <div className="mt-1 space-y-0.5 text-xs">
                    {r.message && <div>message: {r.message}</div>}
                    {r.details && <div>details: {r.details}</div>}
                    {r.hint && <div>hint: {r.hint}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <p className="text-xs text-on-surface-variant">
          Esta página é somente leitura. Remova a rota /diag após concluir o
          diagnóstico, se preferir.
        </p>
      </div>
    </div>
  );
}
