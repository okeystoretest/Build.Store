import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { Readable } from "stream";
import path from "path";
import { getCurrentSession } from "@/lib/auth/session";
import { mimeForExt, resolveMediaPath, statMedia } from "@/lib/storage/media";
import { parseRange } from "@/lib/storage/http-range";

/**
 * Leitura das mídias gravadas em disco: GET /api/media/<escopo>/<aaaa-mm>/<arquivo>.
 *
 * Exige sessão — as mídias são conteúdo da loja, não arquivo público. O
 * middleware não roda em /api, então a checagem é feita aqui.
 *
 * O caminho passa por resolveMediaPath, que recusa qualquer coisa que escape da
 * raiz (path traversal) ou fora dos escopos conhecidos.
 *
 * ## Streaming e Range — o gargalo de carregamento
 *
 * A versão anterior fazia `readFile(abs)`: o arquivo INTEIRO era carregado na
 * memória do servidor antes do primeiro byte sair, e a resposta não anunciava
 * `Accept-Ranges`. As duas coisas somadas explicam a lentidão relatada na
 * Vitrine:
 *
 * 1. Sem streaming, um vídeo de 200 MB significa 200 MB de RSS e vários
 *    segundos de espera antes de o navegador receber qualquer coisa. Com três
 *    ou quatro cards na tela, o processo Node engasga.
 * 2. Sem `Range`, o `<video>` não consegue pedir "só os primeiros KB": ele
 *    baixa o arquivo todo antes de mostrar um frame, e o usuário não pode
 *    arrastar a linha do tempo — cada seek recomeça o download do zero.
 *
 * Agora os bytes vão do disco para o socket via stream, e `Range` é atendido
 * com 206 + Content-Range. O player passa a buscar só o pedaço que precisa.
 *
 * Cache: o nome do arquivo é um UUID e nunca é reescrito, então o conteúdo é
 * imutável — `private, max-age=1 ano, immutable` + ETag por mtime/tamanho.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { path?: string[] } },
) {
  const { user } = await getCurrentSession();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Não autenticado." },
      { status: 401 },
    );
  }

  const segments = params.path ?? [];
  if (segments.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Caminho inválido." },
      { status: 400 },
    );
  }

  const abs = resolveMediaPath(segments.join("/"));
  if (!abs) {
    return NextResponse.json(
      { ok: false, error: "Caminho inválido." },
      { status: 400 },
    );
  }

  const info = await statMedia(abs);
  if (!info) {
    return NextResponse.json(
      { ok: false, error: "Arquivo não encontrado." },
      { status: 404 },
    );
  }

  const etag = `"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
  const contentType = mimeForExt(path.extname(abs).replace(".", ""));

  const comuns: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=31536000, immutable",
    ETag: etag,
    "Accept-Ranges": "bytes",
    // Nunca renderizar HTML/SVG hostil no domínio da app.
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  };

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": comuns["Cache-Control"] },
    });
  }

  // Arquivo de 0 byte não deveria existir (o upload recusa), mas se existir o
  // cálculo de faixa abaixo produziria `end = -1` e um stream inválido.
  if (info.size === 0) {
    return new NextResponse(null, {
      status: 200,
      headers: { ...comuns, "Content-Length": "0" },
    });
  }

  const range = parseRange(request.headers.get("range"), info.size);

  if (range === "invalido") {
    return new NextResponse(null, {
      status: 416,
      headers: { ...comuns, "Content-Range": `bytes */${info.size}` },
    });
  }

  const inicio = range ? range.start : 0;
  const fim = range ? range.end : info.size - 1;
  const tamanho = fim - inicio + 1;

  // `as unknown as ReadableStream`: o Web ReadableStream do Node 18+ é aceito
  // como corpo de Response, mas os tipos do DOM e os do Node não se falam.
  const corpo = Readable.toWeb(
    createReadStream(abs, { start: inicio, end: fim }),
  ) as unknown as ReadableStream;

  return new NextResponse(corpo, {
    status: range ? 206 : 200,
    headers: {
      ...comuns,
      "Content-Length": String(tamanho),
      ...(range
        ? { "Content-Range": `bytes ${inicio}-${fim}/${info.size}` }
        : {}),
    },
  });
}
