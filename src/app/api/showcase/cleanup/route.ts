import { NextResponse } from "next/server";
import { retentionCutoffISO } from "@/lib/db/showcase-repository";

export const dynamic = "force-dynamic";

/**
 * Rotina agendada de retenção da Vitrine.
 *
 * Remove do banco (e, com Supabase Storage em produção, do storage) qualquer
 * mídia cujo upload tenha ocorrido há mais de 90 dias. Deve ser chamada por um
 * cron (ex.: Vercel Cron, ou um agendador externo batendo neste endpoint).
 *
 * Autenticação: protegida por um segredo em `CRON_SECRET`. Envie-o como
 * `Authorization: Bearer <CRON_SECRET>` ou `?secret=<CRON_SECRET>`.
 *
 * Usa a service-role key (bypassa RLS) — roda só no servidor.
 */
export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecret = process.env.CRON_SECRET;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "Supabase não configurado no servidor." },
      { status: 500 },
    );
  }

  // Verificação do segredo do cron (header Bearer ou query param).
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

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cutoff = retentionCutoffISO();

  const { data, error } = await admin
    .from("showcase_media")
    .delete()
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, deleted: data?.length ?? 0, cutoff });
}
