import { createClient } from "@/lib/supabase/client";
import type {
  ShowcaseMedia,
  ShowcaseSeason,
  ShowcaseTab,
} from "@/types/domain";

/**
 * Vitrine (showcase): mídias por coleção/temporada. Online-only — lê e escreve
 * direto no Supabase (tabela `showcase_media`).
 *
 * Retenção: qualquer mídia com upload há mais de 90 dias é removida. A limpeza
 * é acionada por uma rotina agendada (ver /app/api/showcase/cleanup) e também,
 * de forma defensiva, na leitura da lista, para que conteúdo expirado nunca
 * apareça mesmo que o cron atrase.
 */

const RETENTION_DAYS = 90;

type Row = Record<string, unknown>;

function toMedia(r: Row): ShowcaseMedia {
  return {
    id: r.id as string,
    tab: r.tab as ShowcaseTab,
    title: (r.title as string) ?? "",
    fileUrl: (r.file_url as string) ?? "",
    mimeType: (r.mime_type as string | null) ?? null,
    collectionName: (r.collection_name as string) ?? "",
    season: r.season as ShowcaseSeason,
    releaseMonth: Number(r.release_month) || 1,
    releaseYear: Number(r.release_year) || new Date().getFullYear(),
    createdAt: r.created_at as string,
  };
}

/** Corte de retenção (ISO) — uploads anteriores a este instante expiraram. */
export function retentionCutoffISO(now = new Date()): string {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  return cutoff.toISOString();
}

/**
 * Lista as mídias de uma aba, mais recentes primeiro. Aplica o corte de 90
 * dias na própria query (defensivo contra atraso do cron).
 */
export async function listShowcaseMedia(
  tab: ShowcaseTab,
  storeId?: string | null,
): Promise<ShowcaseMedia[]> {
  const supabase = createClient();
  let q = supabase
    .from("showcase_media")
    .select("*")
    .eq("tab", tab)
    .gte("created_at", retentionCutoffISO());
  // Admin em "todas as lojas" (storeId null/undefined) vê tudo que a RLS
  // permitir; com uma loja ativa, filtra por ela.
  if (storeId) q = q.eq("store_id", storeId);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toMedia);
}

export interface NewShowcaseMedia {
  tab: ShowcaseTab;
  title: string;
  fileUrl: string;
  mimeType: string | null;
  collectionName: string;
  season: ShowcaseSeason;
  releaseMonth: number;
  releaseYear: number;
  /** Loja dona da mídia (a Vitrine é isolada por loja). */
  storeId: string;
}

/** Publica uma nova mídia na Vitrine. */
export async function addShowcaseMedia(input: NewShowcaseMedia): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("showcase_media").insert({
    tab: input.tab,
    title: input.title,
    file_url: input.fileUrl,
    mime_type: input.mimeType,
    collection_name: input.collectionName,
    season: input.season,
    release_month: input.releaseMonth,
    release_year: input.releaseYear,
    store_id: input.storeId,
  });
  if (error) throw error;
}

/** Remove uma mídia da Vitrine. */
export async function deleteShowcaseMedia(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("showcase_media").delete().eq("id", id);
  if (error) throw error;
}
