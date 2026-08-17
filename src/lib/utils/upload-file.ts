"use client";

/**
 * Envia um arquivo para /api/upload e devolve a URL pública para gravar no
 * banco.
 *
 * Usa XMLHttpRequest, e não fetch, por um motivo específico: o `fetch` do
 * navegador NÃO expõe progresso de UPLOAD (só de download). Como a Vitrine
 * envia vídeo de dezenas/centenas de MB, a barra de progresso é o que evita a
 * sensação de travamento — então o XHR se paga aqui.
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

export interface UploadProgress {
  /** Bytes já enviados. */
  loaded: number;
  /** Total de bytes (0 se o navegador não souber informar). */
  total: number;
  /** 0–100. Fica em 100 quando o envio termina e o servidor está processando. */
  percent: number;
  /** Fase atual, para a UI escolher o texto. */
  phase: "enviando" | "processando";
}

export interface UploadOptions {
  onProgress?: (p: UploadProgress) => void;
  /** Permite cancelar (ex.: fechar o modal no meio do envio). */
  signal?: AbortSignal;
}

export function uploadFile(
  file: File,
  scope: UploadScope,
  options: UploadOptions = {},
): Promise<UploadedFile> {
  const { onProgress, signal } = options;

  return new Promise<UploadedFile>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Envio cancelado."));
      return;
    }

    // Corta antes de subir: não faz sentido gastar 10 minutos de upload para o
    // servidor recusar no fim por tamanho.
    const max = maxBytesFor(file.type);
    if (file.size > max) {
      reject(
        new Error(
          `Arquivo acima do limite de ${Math.floor(max / (1024 * 1024))} MB.`,
        ),
      );
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/upload?scope=${encodeURIComponent(scope)}`);
    // O corpo é o arquivo puro, em streaming no servidor. Multipart obrigaria
    // o servidor a bufferizar tudo em memória — foi o que causava 502 com
    // vídeos grandes.
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));

    xhr.upload.onprogress = (e) => {
      if (!onProgress) return;
      const total = e.lengthComputable ? e.total : file.size;
      const percent = total > 0 ? Math.round((e.loaded / total) * 100) : 0;
      onProgress({
        loaded: e.loaded,
        total,
        // Segura em 99% até o servidor responder: 100% com a tela ainda
        // parada passa a impressão de que travou.
        percent: Math.min(percent, 99),
        phase: "enviando",
      });
    };

    // Bytes entregues; agora o servidor grava em disco e responde.
    xhr.upload.onload = () => {
      onProgress?.({
        loaded: file.size,
        total: file.size,
        percent: 99,
        phase: "processando",
      });
    };

    xhr.onerror = () => reject(new Error("Sem conexão para enviar o arquivo."));
    xhr.ontimeout = () => reject(new Error("O envio demorou demais."));
    xhr.onabort = () => reject(new Error("Envio cancelado."));

    xhr.onload = () => {
      let body: { ok?: boolean; url?: string; error?: string; bytes?: number; mimeType?: string; fileName?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // resposta sem corpo JSON (ex.: 413 vindo do proxy)
      }

      if (xhr.status < 200 || xhr.status >= 300 || !body.ok || !body.url) {
        reject(new Error(body.error ?? mensagemPorStatus(xhr.status)));
        return;
      }

      onProgress?.({
        loaded: file.size,
        total: file.size,
        percent: 100,
        phase: "processando",
      });

      resolve({
        url: body.url,
        bytes: Number(body.bytes ?? file.size),
        mimeType: body.mimeType ?? file.type ?? "",
        fileName: body.fileName ?? file.name,
      });
    };

    if (signal) {
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });
}

/**
 * Traduz o status HTTP para algo que a lojista possa agir a respeito.
 *
 * O caso que motivou isto: com vários envios simultâneos, o proxy devolvia
 * **502** e a tela dizia apenas "Falha ao enviar o arquivo" — três vezes, sem
 * pista do motivo nem do que fazer. 502/503/504 não vêm da aplicação: quem
 * responde é o proxy, porque o processo por trás caiu ou demorou demais. A
 * mensagem precisa dizer isso, e não sugerir que o arquivo está errado.
 */
function mensagemPorStatus(status: number): string {
  if (status === 413) return "Arquivo grande demais para o servidor.";
  if (status === 401 || status === 403)
    return "Sua sessão expirou. Entre novamente para enviar.";
  if (status === 502 || status === 503 || status === 504)
    return "O servidor não concluiu o envio. Aguarde alguns segundos e use \"Tentar de novo\" — se repetir, o arquivo pode estar grande demais para a conexão da loja.";
  if (status === 0) return "A conexão caiu durante o envio.";
  return "Falha ao enviar o arquivo.";
}

/** Espelha os limites do servidor (ver lib/storage/media.ts). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;

function maxBytesFor(mime: string): number {
  return mime.toLowerCase().startsWith("video/")
    ? MAX_VIDEO_BYTES
    : MAX_IMAGE_BYTES;
}

/** "12,4 MB" — para mostrar ao lado da barra. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
