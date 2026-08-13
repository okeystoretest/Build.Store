"use client";

import { cn } from "@/lib/utils/cn";
import { formatBytes, type UploadProgress } from "@/lib/utils/upload-file";

/**
 * Barra de progresso de upload — percentual, bytes e estado da transferência.
 *
 * Usada em todos os pontos de envio (Vitrine, produto, foto da loja, logotipo)
 * para o feedback ser o mesmo em qualquer tela.
 *
 * Acessibilidade: role="progressbar" com aria-valuenow, para leitor de tela
 * anunciar o avanço.
 */
export function UploadProgressBar({
  progress,
  error,
  className,
}: {
  /** null quando não há envio em andamento. */
  progress: UploadProgress | null;
  /** Mensagem de falha — substitui a barra. */
  error?: string | null;
  className?: string;
}) {
  if (error) {
    return (
      <p className={cn("text-label-sm text-error", className)} role="alert">
        {error}
      </p>
    );
  }

  if (!progress) return null;

  const concluido = progress.percent >= 100;
  const rotulo = concluido
    ? "Concluído"
    : progress.phase === "processando"
      ? "Processando..."
      : "Enviando...";

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between gap-2 text-label-sm">
        <span className={cn(concluido ? "text-primary" : "text-on-surface-variant")}>
          {rotulo}
        </span>
        <span className="tabular-nums text-on-surface-variant">
          {progress.total > 0 && progress.phase === "enviando"
            ? `${formatBytes(progress.loaded)} de ${formatBytes(progress.total)} · ${progress.percent}%`
            : `${progress.percent}%`}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso do envio"
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200 ease-out",
            concluido ? "bg-primary" : "bg-primary/80",
          )}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}
