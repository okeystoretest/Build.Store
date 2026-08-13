import { NextResponse } from "next/server";
import { sql } from "kysely";
import { db } from "@/lib/db/kysely";
import { deleteMediaByUrl } from "@/lib/storage/media";

export const runtime = "nodejs";
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
    // cleanup_showcase_files (migração 0007) apaga as linhas e devolve o
    // file_url de cada uma, para removermos também o arquivo do volume.
    const res = await sql<{ file_url: string | null }>`
      select public.cleanup_showcase_files(90) as file_url
    `.execute(db);

    const urls = res.rows.map((r) => r.file_url);
    let filesDeleted = 0;
    for (const url of urls) {
      if (await deleteMediaByUrl(url)) filesDeleted += 1;
    }

    return NextResponse.json({
      ok: true,
      deleted: urls.length,
      filesDeleted,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Erro na limpeza." },
      { status: 500 },
    );
  }
}
