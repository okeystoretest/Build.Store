"use server";

import { randomUUID } from "crypto";
import { withCurrentUser } from "@/lib/db/with-current-user";
import { toMedia, retentionCutoffISO } from "@/features/showcase/lib/showcase";
import { deleteMediaByUrl } from "@/lib/storage/media";
import type {
  ShowcaseMedia,
  ShowcaseSeason,
  ShowcaseTab,
} from "@/types/domain";

/**
 * Server Actions da Vitrine — Kysely + RLS por sessão. Corte de 90 dias aplicado
 * na leitura (defensivo contra atraso do cron de limpeza). Insert só admin
 * (RLS 0004) e sempre carimbando a loja ativa.
 */

export async function listShowcaseMediaAction(
  tab: ShowcaseTab,
  storeId?: string | null,
): Promise<ShowcaseMedia[]> {
  const cutoff = retentionCutoffISO();
  return withCurrentUser(async (trx) => {
    let q = trx
      .selectFrom("showcase_media")
      .selectAll()
      .where("tab", "=", tab)
      .where("created_at", ">=", cutoff);
    if (storeId) q = q.where("store_id", "=", storeId);
    const rows = await q.orderBy("created_at", "desc").execute();
    return rows.map((r) => toMedia(r as Record<string, unknown>));
  });
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
  storeId: string;
}

export async function addShowcaseMediaAction(
  input: NewShowcaseMedia,
): Promise<void> {
  await withCurrentUser(async (trx) => {
    await trx
      .insertInto("showcase_media")
      .values({
        id: randomUUID(),
        tab: input.tab,
        title: input.title,
        file_url: input.fileUrl,
        mime_type: input.mimeType,
        collection_name: input.collectionName,
        season: input.season,
        release_month: input.releaseMonth,
        release_year: input.releaseYear,
        store_id: input.storeId,
        created_at: new Date().toISOString(),
      } as never)
      .execute();
  });
}

/**
 * Remove a mídia do banco E o arquivo do disco. Sem o unlink, cada exclusão
 * deixaria um órfão ocupando o volume para sempre.
 * (Mídia antiga em data URL não tem arquivo — deleteMediaByUrl ignora.)
 */
/**
 * Descarta um arquivo que subiu mas não chegou a ser publicado — o caso de
 * fechar o modal de envio no meio, ou remover um item do lote.
 *
 * Sem isto, cada envio abandonado deixaria um arquivo órfão no volume; com
 * lotes de até 15 vídeos, isso vira lixo de verdade rápido.
 *
 * Só apaga se NENHUMA linha da Vitrine referenciar a URL, para nunca destruir
 * mídia já publicada.
 */
export async function discardUploadedMediaAction(url: string): Promise<void> {
  if (!url.startsWith("/api/media/showcase/")) return;

  const emUso = await withCurrentUser(async (trx) => {
    const row = await trx
      .selectFrom("showcase_media")
      .select("id")
      .where("file_url", "=", url)
      .executeTakeFirst();
    return Boolean(row);
  });

  if (!emUso) await deleteMediaByUrl(url);
}

export async function deleteShowcaseMediaAction(id: string): Promise<void> {
  const fileUrl = await withCurrentUser(async (trx) => {
    const row = await trx
      .selectFrom("showcase_media")
      .select("file_url")
      .where("id", "=", id)
      .executeTakeFirst();
    await trx.deleteFrom("showcase_media").where("id", "=", id).execute();
    return (row?.file_url as string | null) ?? null;
  });

  await deleteMediaByUrl(fileUrl);
}
