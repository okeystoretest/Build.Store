"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { CameraOff, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  /** Chamado com o texto do código lido. Recebe o valor bruto decodificado. */
  onDetected: (code: string) => void;
}

type ScanState = "starting" | "scanning" | "denied" | "error";

/**
 * Modal que abre a câmera do dispositivo e lê códigos de barras (EAN/UPC/Code128
 * etc.) com @zxing/browser. Ao detectar um código, para a câmera, fecha e
 * entrega o valor via onDetected — que reaproveita o mesmo fluxo do findByCode
 * do PDV.
 *
 * Requer HTTPS (ou localhost): navegadores bloqueiam a câmera em origem
 * insegura. Trata explicitamente permissão negada e ausência de câmera.
 */
export function BarcodeScanner({
  open,
  onClose,
  onDetected,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [state, setState] = useState<ScanState>("starting");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    setState("starting");
    setMessage("");

    const start = async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined, // deviceId undefined => câmera padrão (traseira no mobile)
          videoRef.current!,
          (result, err, ctrl) => {
            if (cancelled) return;
            controlsRef.current = ctrl;
            if (result) {
              const text = result.getText();
              if (text) {
                ctrl.stop();
                onDetected(text);
                onClose();
              }
            }
            // `err` a cada frame sem código é normal; ignoramos.
          },
        );
        controlsRef.current = controls;
        if (!cancelled) setState("scanning");
      } catch (e) {
        if (cancelled) return;
        // Diferencia permissão negada de outros erros.
        const name =
          e && typeof e === "object" && "name" in e
            ? String((e as { name: unknown }).name)
            : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setState("denied");
          setMessage(
            "Permissão de câmera negada. Autorize o acesso à câmera nas configurações do navegador e tente de novo.",
          );
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setState("error");
          setMessage("Nenhuma câmera encontrada neste dispositivo.");
        } else {
          setState("error");
          setMessage(
            "Não foi possível abrir a câmera. Verifique se a página está em HTTPS e se nenhum outro app está usando a câmera.",
          );
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      try {
        controlsRef.current?.stop();
      } catch {
        /* ignore */
      }
      controlsRef.current = null;
    };
  }, [open, onDetected, onClose]);

  return (
    <Modal open={open} onClose={onClose} title="Ler código de barras">
      <div className="space-y-md">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-black sm:aspect-video">
          {/* Vídeo da câmera */}
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
          />

          {/* Moldura de mira */}
          {state === "scanning" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-1/3 w-4/5 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          )}

          {/* Estado: iniciando */}
          {state === "starting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
              <Loader2 className="h-8 w-8 animate-spin" strokeWidth={1.75} />
              <p className="text-label-md">Abrindo a câmera...</p>
            </div>
          )}

          {/* Estado: erro / negado */}
          {(state === "denied" || state === "error") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white">
              <CameraOff className="h-8 w-8" strokeWidth={1.75} />
              <p className="text-body-md">{message}</p>
            </div>
          )}
        </div>

        <p className="text-center text-label-md text-on-surface-variant">
          {state === "scanning"
            ? "Aponte a câmera para o código de barras do produto."
            : ""}
        </p>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            {state === "scanning" ? "Cancelar" : "Fechar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
