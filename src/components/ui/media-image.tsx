"use client";

import { useEffect, useState } from "react";
import { mediaVariantUrl, type MediaVariant } from "@/lib/storage/media-url";
import { cn } from "@/lib/utils/cn";

interface MediaImageProps {
  src: string | null | undefined;
  alt: string;
  /** Tamanho pedido. `thumb` (480px) para grades, `lg` (1600px) para tela cheia. */
  variant?: MediaVariant;
  className?: string;
  /** Imagem acima da dobra (primeira da grade): sem lazy. */
  eager?: boolean;
  /** Renderizado quando não há `src`. */
  fallback?: React.ReactNode;
}

/**
 * `<img>` que pede a derivada e cai no original se ela não existir.
 *
 * A derivada é uma aposta: arquivo antigo (anterior ao Sharp), GIF animado,
 * HEIC, ou caso em que a conversão ficou maior que o original e foi
 * descartada — em todos, o `.thumb.webp` não está no disco e a rota devolve
 * 404. O `onError` troca para a URL original, então o pior caso é o
 * comportamento de hoje, nunca um quadrado vazio.
 *
 * `loading="lazy"` + `decoding="async"`: numa grade de 15 fotos, o navegador
 * só busca o que entrou na tela e decodifica fora da thread principal.
 */
export function MediaImage({
  src,
  alt,
  variant = "thumb",
  className,
  eager = false,
  fallback = null,
}: MediaImageProps) {
  const preferida = mediaVariantUrl(src, variant);
  const [usarOriginal, setUsarOriginal] = useState(false);

  // Nova imagem merece nova tentativa na derivada — sem isto, um 404 antigo
  // travaria o componente no original mesmo depois do backfill.
  useEffect(() => {
    setUsarOriginal(false);
  }, [preferida]);

  if (!src) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={usarOriginal ? src : (preferida ?? src)}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={() => setUsarOriginal(true)}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
