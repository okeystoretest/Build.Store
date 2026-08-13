import "server-only";
import { randomUUID } from "crypto";
import { createReadStream } from "fs";
import { mkdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";

/**
 * Storage de mídia em disco.
 *
 * ANTES: toda imagem/vídeo era gravado como data URL (base64) na própria coluna
 * do Postgres. Isso inchava o banco e os backups, duplicava a imagem em cada
 * item de venda (order_items.image_url) e estourava o limite de corpo das
 * Server Actions (1 MB por padrão no Next 14) em qualquer arquivo real.
 *
 * AGORA: o arquivo vai para o disco (volume persistente) e o banco guarda só a
 * URL pública `/api/media/<escopo>/<aaaa-mm>/<uuid>.<ext>`.
 *
 * O diretório raiz vem de MEDIA_DIR (padrão `/app/data/media`) e PRECISA estar
 * num volume — sem isso as mídias somem a cada deploy.
 */

export const MEDIA_ROOT = path.resolve(
  process.env.MEDIA_DIR ?? "/app/data/media",
);

/** Prefixo das URLs servidas pela rota de leitura. */
export const MEDIA_URL_PREFIX = "/api/media";

/** Escopos válidos — mantém os arquivos organizados e barra caminho arbitrário. */
export const MEDIA_SCOPES = [
  "showcase",
  "products",
  "stores",
  "logos",
] as const;

export type MediaScope = (typeof MEDIA_SCOPES)[number];

export function isMediaScope(v: string): v is MediaScope {
  return (MEDIA_SCOPES as readonly string[]).includes(v);
}

/** Teto por tipo. Vídeo só é aceito no escopo da Vitrine. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024; // 300 MB

/** MIME permitido → extensão. Nada fora desta lista é gravado. */
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function extForMime(mime: string): string | null {
  return MIME_EXT[mime.toLowerCase()] ?? null;
}

export function mimeForExt(ext: string): string {
  const found = Object.entries(MIME_EXT).find(([, e]) => e === ext.toLowerCase());
  return found?.[0] ?? "application/octet-stream";
}

export function isVideoMime(mime: string): boolean {
  return mime.toLowerCase().startsWith("video/");
}

export function maxBytesForMime(mime: string): number {
  return isVideoMime(mime) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

/** Pasta por mês — evita diretórios com dezenas de milhares de arquivos. */
function currentBucket(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Resolve um caminho relativo (`showcase/2026-08/uuid.jpg`) para o caminho
 * absoluto em disco, recusando qualquer coisa que escape da raiz.
 * Esta é a única porta de entrada de path vindo do cliente — nunca ler um
 * caminho sem passar por aqui (path traversal).
 */
export function resolveMediaPath(relative: string): string | null {
  if (!relative || relative.includes("\0")) return null;
  const clean = relative.replace(/^\/+/, "");
  const [scope] = clean.split("/");
  if (!scope || !isMediaScope(scope)) return null;

  const abs = path.resolve(MEDIA_ROOT, clean);
  const root = MEDIA_ROOT.endsWith(path.sep) ? MEDIA_ROOT : MEDIA_ROOT + path.sep;
  if (!abs.startsWith(root)) return null;
  return abs;
}

export interface SavedMedia {
  /** Caminho relativo à raiz (o que guardamos internamente). */
  relativePath: string;
  /** URL pública para gravar no banco e usar em <img>/<video>. */
  url: string;
  bytes: number;
}

/** Grava o arquivo e devolve a URL pública. */
export async function saveMedia(
  scope: MediaScope,
  data: Buffer,
  mime: string,
): Promise<SavedMedia> {
  const ext = extForMime(mime);
  if (!ext) throw new Error(`Tipo de arquivo não suportado: ${mime}`);

  const relativeDir = path.posix.join(scope, currentBucket());
  const fileName = `${randomUUID()}.${ext}`;
  const relativePath = path.posix.join(relativeDir, fileName);

  const absDir = path.resolve(MEDIA_ROOT, relativeDir);
  await mkdir(absDir, { recursive: true });
  await writeFile(path.join(absDir, fileName), data);

  return {
    relativePath,
    url: `${MEDIA_URL_PREFIX}/${relativePath}`,
    bytes: data.byteLength,
  };
}

/** URL pública (`/api/media/...`) → caminho relativo, ou null se não for nossa. */
export function relativeFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.startsWith(`${MEDIA_URL_PREFIX}/`)) return null;
  return url.slice(MEDIA_URL_PREFIX.length + 1);
}

/**
 * Apaga o arquivo de uma URL pública. Silencioso quando o arquivo já não
 * existe ou quando a URL não é nossa (ex.: data URL legada, link externo) —
 * a limpeza nunca deve derrubar a operação que a chamou.
 */
export async function deleteMediaByUrl(url: string | null): Promise<boolean> {
  const relative = relativeFromUrl(url);
  if (!relative) return false;
  const abs = resolveMediaPath(relative);
  if (!abs) return false;
  try {
    await unlink(abs);
    return true;
  } catch {
    return false;
  }
}

/** Metadados para a rota de leitura (tamanho e mtime para o ETag). */
export async function statMedia(abs: string) {
  try {
    const s = await stat(abs);
    return s.isFile() ? s : null;
  } catch {
    return null;
  }
}

export { createReadStream };
