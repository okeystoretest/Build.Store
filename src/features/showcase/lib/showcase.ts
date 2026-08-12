import type { ShowcaseMedia, ShowcaseSeason, ShowcaseTab } from "@/types/domain";

/** Retenção da Vitrine: mídias com upload há mais de 90 dias expiram. */
export const RETENTION_DAYS = 90;

/** Corte de retenção (ISO) — uploads anteriores a este instante expiraram. */
export function retentionCutoffISO(now = new Date()): string {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  return cutoff.toISOString();
}

type Row = Record<string, unknown>;

export function toMedia(r: Row): ShowcaseMedia {
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
