/**
 * Nome das derivadas de imagem — a MESMA regra no servidor (que grava) e no
 * cliente (que pede). Módulo sem `server-only` de propósito: é só manipulação
 * de string, e duplicar a convenção em dois lugares é como as duas pontas
 * deixam de combinar.
 *
 * `/api/media/products/2026-08/uuid.jpg`
 *   → `/api/media/products/2026-08/uuid.thumb.webp`  (480px, grades)
 *   → `/api/media/products/2026-08/uuid.lg.webp`     (1600px, tela cheia)
 *
 * A derivada pode não existir: arquivo antigo, formato que não convertemos
 * (GIF animado, HEIC), ou caso em que a conversão ficou MAIOR que o original e
 * foi descartada. Por isso quem exibe usa `MediaImage`, que cai no original no
 * `onError` — a URL derivada é uma aposta, nunca uma promessa.
 */

export const MEDIA_URL_PREFIX = "/api/media";

/** Largura máxima de cada variante, em pixels. */
export const VARIANT_WIDTH = {
  thumb: 480,
  lg: 1600,
} as const;

export type MediaVariant = keyof typeof VARIANT_WIDTH;

/** Sufixos das derivadas — usados também para apagá-las junto do original. */
export const VARIANT_SUFFIXES = Object.keys(VARIANT_WIDTH).map(
  (v) => `.${v}.webp`,
);

/**
 * Extensões que o servidor sabe derivar. Vídeo NÃO entra: pedir
 * `uuid.lg.webp` para um `.mov` é um 404 garantido, e o `<video>` não tem
 * `onError` com fallback como o `<img>`.
 */
const EXT_DERIVAVEIS = new Set(["jpg", "jpeg", "png", "webp", "avif"]);

/** É uma mídia servida por nós? Data URL legada e link externo ficam de fora. */
export function isInternalMedia(url: string | null | undefined): boolean {
  return Boolean(url && url.startsWith(`${MEDIA_URL_PREFIX}/`));
}

/** A própria URL já é uma derivada? (evita gerar `uuid.thumb.thumb.webp`). */
export function isVariantUrl(url: string): boolean {
  return VARIANT_SUFFIXES.some((s) => url.endsWith(s));
}

/**
 * URL da derivada, ou a original quando não se aplica (mídia externa, vídeo,
 * caminho sem extensão).
 */
export function mediaVariantUrl(
  url: string | null | undefined,
  variant: MediaVariant,
): string | null {
  if (!url) return null;
  if (!isInternalMedia(url) || isVariantUrl(url)) return url;

  const ponto = url.lastIndexOf(".");
  const barra = url.lastIndexOf("/");
  // Sem extensão no último segmento não há como nomear a derivada.
  if (ponto <= barra) return url;

  const ext = url.slice(ponto + 1).toLowerCase();
  if (!EXT_DERIVAVEIS.has(ext)) return url;

  return `${url.slice(0, ponto)}.${variant}.webp`;
}
