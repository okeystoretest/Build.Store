"use client";

import { useEffect, useState } from "react";

/**
 * Detecta se o dispositivo é um "mobile real" com câmera, para condicionar a
 * exibição do botão de leitura por câmera.
 *
 * Regra (decisão 1b — por capacidade, não só por breakpoint):
 *  - ponteiro grosseiro (toque) via matchMedia("(pointer: coarse)"), e
 *  - ao menos uma câmera de vídeo disponível (enumerateDevices).
 *
 * Só roda no cliente. Enquanto não confirmado, retorna false (o botão não
 * aparece até termos certeza de que há câmera — evita mostrar e falhar).
 *
 * Observação: a contagem de câmeras via enumerateDevices pode exigir permissão
 * concedida para expor o `kind` em alguns navegadores; por isso combinamos com
 * a checagem de toque, que já elimina desktops. Se a enumeração falhar mas o
 * dispositivo for touch e tiver a API de mídia, assumimos que há câmera.
 */
export function useIsMobileScanner(): boolean {
  const [capable, setCapable] = useState(false);

  useEffect(() => {
    let active = true;

    const detect = async () => {
      // 1) Precisa ser um dispositivo de toque (elimina desktop com janela
      //    estreita, que tem ponteiro fino).
      const coarse =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches;

      if (!coarse) {
        if (active) setCapable(false);
        return;
      }

      // 2) Precisa ter suporte a getUserMedia (acesso à câmera).
      const hasMedia =
        typeof navigator !== "undefined" &&
        !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function";

      if (!hasMedia) {
        if (active) setCapable(false);
        return;
      }

      // 3) Confirma que existe ao menos uma câmera. Se a enumeração não
      //    conseguir classificar (sem permissão ainda), mas o device é touch
      //    com getUserMedia, assumimos que há câmera (celular).
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some((d) => d.kind === "videoinput");
        const cannotTell = devices.every((d) => !d.kind);
        if (active) setCapable(hasCamera || cannotTell);
      } catch {
        if (active) setCapable(true); // touch + getUserMedia: provavelmente há câmera
      }
    };

    void detect();
    return () => {
      active = false;
    };
  }, []);

  return capable;
}
