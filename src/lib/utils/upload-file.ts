"use client";

/**
 * Envia um arquivo para /api/upload e devolve a URL pública para gravar no
 * banco. Substitui o padrão antigo de FileReader → data URL.
 *
 * Erros vêm com mensagem pronta para toast (limite de tamanho, tipo, sessão).
 */

export type UploadScope = "showcase" | "products" | "stores" | "logos";

export interface UploadedFile {
  url: string;
  bytes: number;
  mimeType: string;
  fileName: string;
}

export async function uploadFile(
  file: File,
  scope: UploadScope,
): Promise<UploadedFile> {
  const form = new FormData();
  form.append("file", file);
  form.append("scope", scope);

  let res: Response;
  try {
    res = await fetch("/api/upload", { method: "POST", body: form });
  } catch {
    throw new Error("Sem conexão para enviar o arquivo.");
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // resposta sem corpo JSON (ex.: 413 do proxy) — cai no genérico abaixo
  }

  const body = (payload ?? {}) as { ok?: boolean; url?: string; error?: string };

  if (!res.ok || !body.ok || !body.url) {
    throw new Error(
      body.error ??
        (res.status === 413
          ? "Arquivo grande demais para o servidor."
          : "Falha ao enviar o arquivo."),
    );
  }

  return {
    url: body.url,
    bytes: Number((payload as { bytes?: number }).bytes ?? file.size),
    mimeType:
      (payload as { mimeType?: string }).mimeType ?? file.type ?? "",
    fileName: (payload as { fileName?: string }).fileName ?? file.name,
  };
}
