import "server-only";
import { stat, unlink, writeFile } from "fs/promises";
import sharp from "sharp";
import { VARIANT_WIDTH, type MediaVariant } from "@/lib/storage/media-url";

/**
 * Derivadas de imagem (miniatura e versão de tela cheia).
 *
 * ## Por que isto existe
 *
 * O original é gravado como veio da câmera: 3–8 MB, 4000px de largura. A grade
 * de Estoque mostra essa imagem num quadrado de ~200px, e a Vitrine mostra 15
 * delas de uma vez. Sem derivada, uma tela de 15 fotos baixa dezenas de MB para
 * exibir o equivalente a menos de 1 MB de pixels — é a causa direta da
 * lentidão relatada, e nenhuma otimização de banco resolve isso.
 *
 * ## As regras que a análise de mídia fixou
 *
 * - **Redimensionar importa mais que converter.** Só converter para WebP dá
 *   ~6×; converter E redimensionar para 480px dá ~100×. Por isso a variante é
 *   definida pela LARGURA, e o formato é consequência.
 * - **Converta apenas quando o resultado for menor.** WebP e AVIF de entrada
 *   frequentemente incham ao reencodar. Geramos em memória, comparamos com o
 *   original e só gravamos se valer a pena — senão, quem exibe cai no original.
 * - **`.rotate()` antes de tudo.** Sem ler a orientação do EXIF, foto de
 *   retrato sai deitada na miniatura.
 * - **Metadados fora.** O sharp descarta EXIF por padrão (não chamamos
 *   `withMetadata`): economiza bytes e, principalmente, não publica a
 *   coordenada GPS de onde a foto da loja foi tirada.
 * - **GIF, HEIC e vídeo ficam de fora.** GIF animado perderia a animação em
 *   silêncio; os binários pré-compilados do sharp não decodificam HEIC; e
 *   sharp é libvips — imagem, nunca vídeo.
 */

// Um worker por operação: o container da loja tem poucos núcleos e o upload
// não pode competir com o atendimento das telas.
sharp.concurrency(1);

/** Formatos que sabemos reencodar com segurança. */
const DERIVAVEIS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

/** Qualidade do WebP: acima disso o ganho de tamanho some. */
const WEBP_QUALITY = 72;

export function podeDerivar(mime: string): boolean {
  return DERIVAVEIS.has(mime.toLowerCase());
}

/** Caminho em disco da derivada, seguindo a mesma convenção da URL. */
export function caminhoDaVariante(absOriginal: string, variant: MediaVariant) {
  const ponto = absOriginal.lastIndexOf(".");
  const base = ponto > 0 ? absOriginal.slice(0, ponto) : absOriginal;
  return `${base}.${variant}.webp`;
}

async function tamanho(abs: string): Promise<number> {
  try {
    return (await stat(abs)).size;
  } catch {
    return 0;
  }
}

/**
 * Gera uma variante. Devolve os bytes gravados, ou `null` quando a derivada
 * não foi criada — formato não suportado, imagem já menor que o alvo, ou
 * resultado maior que o original.
 */
export async function gerarVariante(
  absOriginal: string,
  mime: string,
  variant: MediaVariant,
): Promise<number | null> {
  if (!podeDerivar(mime)) return null;

  const alvo = VARIANT_WIDTH[variant];
  const bytesOriginal = await tamanho(absOriginal);
  if (bytesOriginal === 0) return null;

  try {
    const entrada = sharp(absOriginal, { failOn: "error" });
    const meta = await entrada.metadata();

    // Imagem menor que o alvo e já enxuta: reencodar só gastaria CPU. O
    // consumidor cai no original, que já é do tamanho certo.
    if ((meta.width ?? 0) <= alvo && bytesOriginal <= 120 * 1024) return null;

    const buffer = await entrada
      // Orientação do EXIF aplicada aos pixels — senão retrato vira paisagem.
      .rotate()
      .resize({ width: alvo, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer();

    // A regra: converta quando o resultado for menor.
    if (buffer.byteLength >= bytesOriginal) return null;

    const destino = caminhoDaVariante(absOriginal, variant);
    await writeFile(destino, buffer);
    return buffer.byteLength;
  } catch {
    // Derivada é otimização: falhar aqui não pode derrubar o upload. Sem ela,
    // a tela mostra o original.
    return null;
  }
}

/**
 * Gera todas as variantes de uma imagem recém-gravada. Erros são engolidos de
 * propósito (ver acima).
 */
export async function gerarDerivadas(
  absOriginal: string,
  mime: string,
): Promise<Partial<Record<MediaVariant, number>>> {
  const out: Partial<Record<MediaVariant, number>> = {};
  if (!podeDerivar(mime)) return out;

  for (const variant of Object.keys(VARIANT_WIDTH) as MediaVariant[]) {
    const bytes = await gerarVariante(absOriginal, mime, variant);
    if (bytes !== null) out[variant] = bytes;
  }
  return out;
}

/** Extensão do original → MIME. Local de propósito: `media.ts` importa este
 *  módulo, então importar de volta fecharia um ciclo. */
const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  heic: "image/heic",
};

/**
 * Gerações em andamento, por caminho. Numa grade de quinze fotos o navegador
 * dispara os pedidos em paralelo; sem isto, dois pedidos do MESMO arquivo
 * fariam o Sharp trabalhar duas vezes e escreveriam no mesmo destino ao mesmo
 * tempo.
 */
const emAndamento = new Map<string, Promise<string | null>>();

async function existe(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve o pedido de uma derivada que não está no disco.
 *
 * Recebe o caminho pedido (`.../uuid.thumb.webp`), localiza o original,
 * tenta gerar a derivada e devolve o caminho do que deve ser servido:
 *
 * - a derivada, se foi gerada;
 * - o ORIGINAL, quando a geração não se aplica (GIF animado, HEIC, ou
 *   resultado maior que a entrada) — melhor entregar a imagem grande do que
 *   um 404;
 * - `null` se nem o original existe.
 */
export async function garantirVariante(
  absPedido: string,
): Promise<string | null> {
  const m = /^(.*)\.(thumb|lg)\.webp$/.exec(absPedido);
  if (!m) return null;

  const [, base, variant] = m;

  const emCurso = emAndamento.get(absPedido);
  if (emCurso) return emCurso;

  const trabalho = (async (): Promise<string | null> => {
    for (const ext of Object.keys(EXT_MIME)) {
      const original = `${base}.${ext}`;
      if (!(await existe(original))) continue;

      const bytes = await gerarVariante(
        original,
        EXT_MIME[ext],
        variant as MediaVariant,
      );
      return bytes !== null ? absPedido : original;
    }
    return null;
  })();

  emAndamento.set(absPedido, trabalho);
  try {
    return await trabalho;
  } finally {
    emAndamento.delete(absPedido);
  }
}

/** Apaga as derivadas de um original (chamado junto da exclusão do arquivo). */
export async function apagarDerivadas(absOriginal: string): Promise<void> {
  for (const variant of Object.keys(VARIANT_WIDTH) as MediaVariant[]) {
    await unlink(caminhoDaVariante(absOriginal, variant)).catch(() => {});
  }
}
