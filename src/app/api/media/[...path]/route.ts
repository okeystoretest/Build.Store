import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getCurrentSession } from "@/lib/auth/session";
import { mimeForExt, resolveMediaPath, statMedia } from "@/lib/storage/media";

/**
 * Leitura das mídias gravadas em disco: GET /api/media/<escopo>/<aaaa-mm>/<arquivo>.
 *
 * Exige sessão — as mídias são conteúdo da loja, não arquivo público. O
 * middleware não roda em /api, então a checagem é feita aqui.
 *
 * O caminho passa por resolveMediaPath, que recusa qualquer coisa que escape da
 * raiz (path traversal) ou fora dos escopos conhecidos.
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
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  const contentType = mimeForExt(path.extname(abs).replace(".", ""));
  const data = await readFile(abs);

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(info.size),
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: etag,
      // Nunca renderizar HTML/SVG hostil no domínio da app.
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
