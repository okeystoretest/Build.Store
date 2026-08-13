import { NextResponse } from "next/server";
import { Readable } from "stream";
import { getCurrentSession } from "@/lib/auth/session";
import {
  extForMime,
  isMediaScope,
  isVideoMime,
  maxBytesForMime,
  saveMediaStream,
} from "@/lib/storage/media";

/**
 * Upload de mídia — corpo BINÁRIO puro, em streaming.
 *
 * ## Por que não é multipart/form-data
 *
 * A primeira versão usava `request.formData()` e depois
 * `Buffer.from(await file.arrayBuffer())`. Isso põe o arquivo inteiro na
 * memória duas vezes. Com vídeo de coleção (centenas de MB) e três envios
 * simultâneos, o processo Node estourava a memória do container, era morto, e
 * o Traefik devolvia **502 Bad Gateway** — exatamente o erro visto em produção.
 *
 * Agora o corpo da requisição é o próprio arquivo, e os bytes vão do socket
 * direto para o disco (`saveMediaStream`). O pico de memória é de alguns KB por
 * envio, não importa o tamanho do arquivo.
 *
 * ## Contrato
 *
 *   POST /api/upload?scope=showcase
 *   Content-Type: <mime do arquivo>
 *   X-File-Name: <nome original, URI-encoded>
 *   corpo: bytes do arquivo
 *
 * Resposta: { ok: true, url, bytes, mimeType, fileName }.
 *
 * Exige sessão: o middleware não roda em /api, então a checagem é aqui.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vídeo grande em conexão de loja leva tempo; o padrão do Next derrubaria antes.
export const maxDuration = 3600;

function erro(status: number, mensagem: string) {
  return NextResponse.json({ ok: false, error: mensagem }, { status });
}

export async function POST(request: Request) {
  const { user } = await getCurrentSession();
  if (!user) return erro(401, "Não autenticado.");

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "";
  if (!isMediaScope(scope)) return erro(400, "Escopo inválido.");

  // Content-Type é o mime do arquivo; charset/boundary não se aplicam aqui.
  const mime = (request.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!extForMime(mime)) return erro(415, "Tipo de arquivo não suportado.");

  // Vídeo só na Vitrine — logo de loja e foto de produto são sempre imagem.
  if (isVideoMime(mime) && scope !== "showcase") {
    return erro(415, "Vídeo só é permitido na Vitrine.");
  }

  const max = maxBytesForMime(mime);

  // Recusa cedo pelo tamanho declarado, para não gastar banda à toa. O limite
  // real é aplicado durante a gravação (o header pode mentir).
  const declarado = Number(request.headers.get("content-length") ?? 0);
  if (declarado > max) {
    const mb = Math.floor(max / (1024 * 1024));
    return erro(413, `Arquivo acima do limite de ${mb} MB.`);
  }

  if (!request.body) return erro(400, "Nenhum arquivo enviado.");

  const nomeBruto = request.headers.get("x-file-name") ?? "arquivo";
  let fileName = "arquivo";
  try {
    fileName = decodeURIComponent(nomeBruto).slice(0, 200);
  } catch {
    fileName = nomeBruto.slice(0, 200);
  }

  try {
    const stream = Readable.fromWeb(request.body as never);
    const saved = await saveMediaStream(scope, stream, mime, max);

    return NextResponse.json({
      ok: true,
      url: saved.url,
      bytes: saved.bytes,
      mimeType: mime,
      fileName,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao gravar o arquivo.";
    // Limite estourado durante a gravação → 413, não 500.
    const status = msg.includes("acima do limite") ? 413 : 500;
    return erro(status, msg);
  }
}
