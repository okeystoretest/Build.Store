import type { ShowcaseMedia, ShowcaseSeason, ShowcaseTab } from "@/types/domain";
import { toIsoString } from "@/lib/utils/date";

/** Retenção da Vitrine: mídias com upload há mais de 90 dias expiram. */
export const RETENTION_DAYS = 90;

/** Corte de retenção (ISO) — uploads anteriores a este instante expiraram. */
export function retentionCutoffISO(now = new Date()): string {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  return cutoff.toISOString();
}

/**
 * Comparador alfanumérico da Vitrine.
 *
 * `numeric: true` faz "Look 2" vir antes de "Look 10" — a ordenação puramente
 * lexicográfica colocaria "Look 10" primeiro, quebrando exatamente o padrão de
 * nomenclatura numerada que a vitrine usa. `sensitivity: "base"` ignora caixa e
 * acento, para "Ática" e "atica" não caírem em blocos separados.
 */
const COLLATOR = new Intl.Collator("pt-BR", {
  numeric: true,
  sensitivity: "base",
});

/** Nome do arquivo em `/api/media/<escopo>/<aaaa-mm>/<uuid>.<ext>`. */
function fileNameOf(url: string): string {
  const semQuery = url.split("?")[0] ?? "";
  return decodeURIComponent(semQuery.split("/").pop() ?? "");
}

/**
 * Chave de ordenação: o título cadastrado e, se vazio, o nome do arquivo.
 * Toda mídia tem uma das duas — sem isso, itens sem título afundariam no fim da
 * lista em ordem imprevisível.
 */
export function sortKey(m: ShowcaseMedia): string {
  const t = (m.title ?? "").trim();
  return t || fileNameOf(m.fileUrl ?? "");
}

/**
 * Ordena mídia da Vitrine de forma alfanumérica pelo padrão de nomenclatura.
 * Empate no nome cai para a data de envio, só para a ordem ser estável.
 */
export function sortMediaAlphanumeric(list: ShowcaseMedia[]): ShowcaseMedia[] {
  return [...list].sort((a, b) => {
    const cmp = COLLATOR.compare(sortKey(a), sortKey(b));
    if (cmp !== 0) return cmp;
    return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
  });
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
    createdAt: toIsoString(r.created_at),
  };
}
