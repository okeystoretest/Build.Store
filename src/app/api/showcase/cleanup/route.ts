import { NextResponse } from "next/server";
import { sql } from "kysely";
import { db } from "@/lib/db/kysely";

export const dynamic = "force-dynamic";

/**
 * Rotina agendada de retenção da Vitrine (sem Supabase).
 *
 * Remove do banco qualquer mídia com upload há mais de 90 dias. Chame por um
 * cron (ex.: um agendador na VPS batendo neste endpoint).
 *
 * Autenticação: protegida por `CRON_SECRET`. Envie como
 * `Authorization: Bearer <CRON_SECRET>` ou `?secret=<CRON_SECRET>`.
 *
 * A limpeza usa a função SQL security-definer public.cleanup_showcase() (ver
 * migração 0006), que ignora a RLS de forma controlada — o cron não tem sessão
 * de usuário.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const auth = request.headers.get("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    const qsSecret = new URL(request.url).searchParams.get("secret");
    if (bearer !== cronSecret && qsSecret !== cronSecret) {
      return NextResponse.json(
        { ok: false, error: "Não autorizado." },
        { status: 401 },
      );
    }
  }

  try {
    const res = await sql<{ cleanup_showcase: number }>`
      select public.cleanup_showcase(90) as cleanup_showcase
    `.execute(db);
    const deleted = res.rows[0]?.cleanup_showcase ?? 0;
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Erro na limpeza." },
      { status: 500 },
    );
  }
}
