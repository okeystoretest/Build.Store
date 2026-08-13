import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import {
  extForMime,
  isMediaScope,
  isVideoMime,
  maxBytesForMime,
  saveMedia,
} from "@/lib/storage/media";

/**
 * Upload de mídia (multipart/form-data).
 *
 * Route Handler em vez de Server Action de propósito: Server Action tem limite
 * de corpo (1 MB por padrão) e obrigaria a trafegar o arquivo em base64 — 33%
 * maior e todo em memória. Aqui o arquivo sobe binário e vai direto pro disco.
 *
 * Campos: `file` (File) e `scope` (showcase | products | stores | logos).
 * Resposta: { ok: true, url } — a URL é o que se grava no banco.
 *
 * Exige sessão: o middleware não cobre /api, então a checagem é aqui.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user } = await getCurrentSession();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Não autenticado." },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Envio inválido." },
      { status: 400 },
    );
  }

  const scope = String(form.get("scope") ?? "");
  if (!isMediaScope(scope)) {
    return NextResponse.json(
      { ok: false, error: "Escopo inválido." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { ok: false, error: "Nenhum arquivo enviado." },
      { status: 400 },
    );
  }

  const mime = file.type || "";
  if (!extForMime(mime)) {
    return NextResponse.json(
      { ok: false, error: "Tipo de arquivo não suportado." },
      { status: 415 },
    );
  }

  // Vídeo só na Vitrine — logo de loja e foto de produto são sempre imagem.
  if (isVideoMime(mime) && scope !== "showcase") {
    return NextResponse.json(
      { ok: false, error: "Vídeo só é permitido na Vitrine." },
      { status: 415 },
    );
  }

  const max = maxBytesForMime(mime);
  if (file.size > max) {
    const mb = Math.floor(max / (1024 * 1024));
    return NextResponse.json(
      { ok: false, error: `Arquivo acima do limite de ${mb} MB.` },
      { status: 413 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await saveMedia(scope, buffer, mime);
    return NextResponse.json({
      ok: true,
      url: saved.url,
      bytes: saved.bytes,
      mimeType: mime,
      fileName: file.name,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Falha ao gravar o arquivo.",
      },
      { status: 500 },
    );
  }
}
