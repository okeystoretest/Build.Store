"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import { CameraOff, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

type ScanState = "starting" | "scanning" | "denied" | "error";

// Formatos comuns em varejo de roupas/calçados (EAN/UPC) + Code128/39.
const FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
  BarcodeFormat.QR_CODE,
];

/**
 * Modal que abre a câmera TRASEIRA e lê códigos de barras com @zxing.
 *
 * Pontos-chave da implementação (corrigem os problemas de leitura):
 *  - Câmera traseira explícita: getUserMedia com facingMode "environment".
 *    Sem isso, muitos celulares abriam a câmera frontal e nunca liam o código.
 *  - Decodifica a partir do stream já obtido (decodeFromStream), garantindo que
 *    o <video> está montado e tocando antes de começar.
 *  - Hints com os formatos de varejo + TRY_HARDER, melhorando a taxa de leitura.
 *
 * Requer HTTPS (ou localhost) — navegadores bloqueiam a câmera em origem
 * insegura (ex.: acessar por http://192.168...).
 */
export function BarcodeScanner({
  open,
  onClose,
  onDetected,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<ScanState>("starting");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints);

    const stopAll = () => {
      try {
        controlsRef.current?.stop();
      } catch {
        /* ignore */
      }
      controlsRef.current = null;
      // Garante que a câmera desliga (o controls.stop nem sempre solta o stream).
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
        streamRef.current = null;
      }
    };

    const start = async () => {
      setState("starting");
      setMessage("");
      try {
        // 1) Pede explicitamente a câmera traseira.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) {
          setState("error");
          setMessage("Falha ao iniciar o vídeo da câmera.");
          return;
        }

        // 2) Decodifica a partir do stream (vídeo garantidamente disponível).
        const controls = await reader.decodeFromStream(
          stream,
          video,
          (result, _err, ctrl) => {
            if (cancelled) return;
            if (result) {
              const text = result.getText();
              if (text) {
                ctrl.stop();
                stopAll();
                onDetected(text);
                onClose();
              }
            }
          },
        );
        controlsRef.current = controls;
        if (!cancelled) setState("scanning");
      } catch (e) {
        if (cancelled) return;
        const name =
          e && typeof e === "object" && "name" in e
            ? String((e as { name: unknown }).name)
            : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setState("denied");
          setMessage(
            "Permissão de câmera negada. Autorize o acesso à câmera nas configurações do navegador e tente novamente.",
          );
        } else if (
          name === "NotFoundError" ||
          name === "OverconstrainedError" ||
          name === "DevicesNotFoundError"
        ) {
          setState("error");
          setMessage("Nenhuma câmera encontrada neste dispositivo.");
        } else if (name === "NotReadableError" || name === "TrackStartError") {
          setState("error");
          setMessage(
            "A câmera está em uso por outro aplicativo. Feche-o e tente novamente.",
          );
        } else {
          setState("error");
          setMessage(
            "Não foi possível abrir a câmera. A leitura por câmera exige HTTPS (cadeado no navegador).",
          );
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [open, onDetected, onClose]);

  return (
    <Modal open={open} onClose={onClose} title="Ler código de barras">
      <div className="space-y-md">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-black sm:aspect-video">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            autoPlay
            playsInline
          />

          {state === "scanning" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-1/3 w-4/5 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          )}

          {state === "starting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
              <Loader2 className="h-8 w-8 animate-spin" strokeWidth={1.75} />
              <p className="text-label-md">Abrindo a câmera...</p>
            </div>
          )}

          {(state === "denied" || state === "error") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-white">
              <CameraOff className="h-8 w-8" strokeWidth={1.75} />
              <p className="text-body-md">{message}</p>
            </div>
          )}
        </div>

        <p className="min-h-[1.25rem] text-center text-label-md text-on-surface-variant">
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
