"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * Modal acessível. Fecha no Escape e no clique fora.
 *
 * ## Sem `backdrop-blur`
 *
 * O scrim tinha `backdrop-blur-sm`. Desfocar o pano de fundo obriga o
 * navegador a rasterizar a PÁGINA INTEIRA e aplicar o filtro a cada quadro —
 * e atrás do modal de estoque há uma grade de fotos grandes. Era o principal
 * componente dos 840ms de INP medidos ao clicar num item: o clique não
 * "demorava a responder", ele respondia e o desenho do efeito atrasava a
 * pintura. Um scrim mais opaco separa o modal do fundo pelo mesmo preço de um
 * retângulo sólido.
 *
 * ## Borda
 *
 * Contorno em `primary-container/60`, o mesmo dos cards de Fotos da Coleção:
 * no tema claro o painel é branco sobre branco esmaecido, e sem a borda ele só
 * se distingue do fundo pela sombra.
 */
export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 p-margin"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          "w-full max-w-lg rounded-xl border border-primary-container/60 bg-surface-container-lowest shadow-level-2",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-primary-container/40 px-md py-md">
          <h2 className="text-headline-md text-on-surface">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto px-md py-md scrollbar-slim sm:max-h-[70vh]">{children}</div>
      </div>
    </div>
  );
}
