"use client";

import { useCallback, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { ShowcaseMedia } from "@/types/domain";
import { VideoPlayer } from "./video-player";
import { MediaImage } from "@/components/ui/media-image";

const SEASON_LABEL: Record<string, string> = {
  primavera_verao: "Primavera/Verão",
  outono_inverno: "Outono/Inverno",
};

const MONTHS_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/**
 * Visualizador de mídia da Vitrine (lightbox).
 *
 * Substitui o antigo `<a target="_blank">`, que jogava o arquivo numa aba do
 * navegador e tirava a lojista de dentro do app. Aqui vídeo e foto abrem por
 * cima da grade, com os metadados da coleção à vista.
 *
 * Não usa o <Modal> genérico de propósito: mídia precisa de fundo escuro e da
 * largura toda da tela, enquanto o Modal é uma caixa clara e estreita para
 * formulário.
 *
 * Teclado: Esc fecha, ← → navegam entre as mídias da aba atual.
 */
export function MediaViewer({
  media,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  media: ShowcaseMedia | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev?.();
      if (e.key === "ArrowRight" && hasNext) onNext?.();
    },
    [onClose, onPrev, onNext, hasPrev, hasNext],
  );

  useEffect(() => {
    if (!media) return;
    window.addEventListener("keydown", handleKey);
    // Trava a rolagem do fundo enquanto o visualizador está aberto.
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = anterior;
    };
  }, [media, handleKey]);

  if (!media) return null;

  const isImage = (media.mimeType ?? "").startsWith("image/");
  const isVideo = (media.mimeType ?? "").startsWith("video/");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={media.title}
      // Sem `backdrop-blur`: sobre um preto a 90% o desfoque não é visível, mas
      // custa um passe de rasterização da página inteira por quadro.
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      // Clicar no fundo fecha; cliques na mídia não sobem (stopPropagation).
      onClick={onClose}
    >
      <header className="flex shrink-0 items-start gap-3 p-md text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate text-label-lg font-medium">{media.title}</p>
          <p className="truncate text-label-sm text-white/70">
            {media.collectionName} · {SEASON_LABEL[media.season] ?? media.season} ·{" "}
            {MONTHS_SHORT[(media.releaseMonth - 1 + 12) % 12]}/{media.releaseYear}
          </p>
        </div>

        <a
          href={media.fileUrl}
          download={media.title}
          onClick={(e) => e.stopPropagation()}
          aria-label="Baixar arquivo"
          title="Baixar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Download className="h-5 w-5" strokeWidth={1.75} />
        </a>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          title="Fechar (Esc)"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-md pb-lg">
        {hasPrev && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrev?.();
            }}
            aria-label="Anterior"
            className="absolute left-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/70"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2} />
          </button>
        )}

        <div
          className="flex max-h-full w-full max-w-5xl items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {isVideo ? (
            // Player próprio: os controles nativos mudam de aparência em cada
            // navegador e destoam da identidade visual da plataforma.
            <VideoPlayer
              src={media.fileUrl}
              autoPlay
              className="w-full max-w-5xl"
            />
          ) : isImage ? (
            // `lg` (1600px): cobre qualquer tela de loja com sobra e evita
            // baixar o arquivo de câmera inteiro só para olhar a foto.
            <MediaImage
              src={media.fileUrl}
              alt={media.title}
              variant="lg"
              eager
              className="max-h-[75vh] max-w-full rounded-2xl object-contain"
            />
          ) : (
            // Tipo sem player nativo (PDF, etc.): oferece o download.
            <div className="rounded-md bg-surface p-lg text-center">
              <p className="text-body-md text-on-surface">
                Este tipo de arquivo não pode ser exibido aqui.
              </p>
              <a
                href={media.fileUrl}
                download={media.title}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-label-md text-on-primary"
              >
                <Download className="h-4 w-4" strokeWidth={1.75} />
                Baixar arquivo
              </a>
            </div>
          )}
        </div>

        {hasNext && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNext?.();
            }}
            aria-label="Próxima"
            className="absolute right-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/70"
          >
            <ChevronRight className="h-6 w-6" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}
