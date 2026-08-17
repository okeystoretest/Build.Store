"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { mediaVariantUrl } from "@/lib/storage/media-url";

/** Imagem padrão para loja sem foto cadastrada (ou com URL quebrada). */
export const STORE_PLACEHOLDER = "/icons/store-placeholder.svg";

interface StoreAvatarProps {
  /** URL da foto/logotipo da loja. null/vazio cai na imagem padrão. */
  src?: string | null;
  alt?: string;
  /** Classes do contêiner redondo (tamanho, anel, etc.). */
  className?: string;
}

/**
 * Foto de perfil da loja com fallback.
 *
 * Dois casos caem na imagem padrão, e os dois aconteciam na prática: a loja
 * nunca cadastrou foto, e a URL cadastrada não carrega (mídia removida do
 * disco, caminho antigo do Supabase). Sem o `onError`, o segundo caso deixava
 * o ícone quebrado do navegador dentro do círculo do cabeçalho.
 */
export function StoreAvatar({ src, alt = "Loja", className }: StoreAvatarProps) {
  const url = src && src.trim() ? src : null;
  const [falhou, setFalhou] = useState(false);

  // Nova URL merece nova tentativa — sem isto, uma falha antiga travaria a
  // imagem padrão mesmo depois de a loja cadastrar uma foto válida.
  useEffect(() => {
    setFalhou(false);
  }, [url]);

  // O avatar tem 40–56px: a miniatura de 480px já é generosa, e era aqui que
  // o logotipo de vários MB da loja era baixado em toda tela do aplicativo.
  const fonte =
    !url || falhou ? STORE_PLACEHOLDER : (mediaVariantUrl(url, "thumb") ?? url);

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-full bg-primary-fixed/60 ring-2 ring-primary-container transition-all",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fonte}
        alt={alt}
        className="h-full w-full object-cover"
        onError={(e) => {
          // Escada de fallback: miniatura → original → imagem padrão. Sem o
          // degrau do meio, uma loja com logotipo antigo (sem derivada) ficaria
          // com a imagem genérica.
          const img = e.currentTarget;
          if (url && img.src.endsWith(".thumb.webp")) {
            img.src = url;
            return;
          }
          setFalhou(true);
        }}
      />
    </div>
  );
}
