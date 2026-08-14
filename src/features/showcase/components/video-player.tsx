"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Player de vídeo da Vitrine.
 *
 * Substitui o `controls` nativo, que muda de cara em cada navegador (barra
 * cinza do Chrome, botão azul do Safari) e destoa da identidade da plataforma.
 * Aqui a barra é rosa da paleta, com cantos arredondados e a mesma linguagem de
 * forma do resto do app.
 *
 * O elemento `<video>` continua sendo o de sempre — só os controles são nossos.
 * Isso preserva aceleração de hardware, legendas e o comportamento de rede
 * (com Range na rota de mídia, arrastar a linha do tempo busca só o trecho
 * pedido em vez de rebaixar o arquivo inteiro).
 */
export function VideoPlayer({
  src,
  poster,
  autoPlay = false,
  className,
}: {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [tocando, setTocando] = useState(false);
  const [mudo, setMudo] = useState(false);
  const [volume, setVolume] = useState(1);
  const [tempo, setTempo] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [terminou, setTerminou] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  // Controles somem sozinhos durante a reprodução; qualquer movimento traz de
  // volta. Sem isso, a barra fica em cima do vestido na hora de olhar a peça.
  const [mostrarControles, setMostrarControles] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const agendarOcultar = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMostrarControles(true);
    timerRef.current = setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused) setMostrarControles(false);
    }, 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const onFs = () => setTelaCheia(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const alternarPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      void v.play();
    } else {
      v.pause();
    }
    agendarOcultar();
  }, [agendarOcultar]);

  const alternarMudo = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMudo(v.muted);
  };

  const alternarTelaCheia = async () => {
    const alvo = wrapRef.current;
    if (!alvo) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await alvo.requestFullscreen().catch(() => {});
  };

  const irPara = (segundos: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(segundos)) return;
    v.currentTime = Math.max(0, Math.min(segundos, v.duration || 0));
    setTempo(v.currentTime);
  };

  const progresso = duracao > 0 ? (tempo / duracao) * 100 : 0;

  return (
    <div
      ref={wrapRef}
      className={cn(
        "group/player relative overflow-hidden rounded-2xl bg-black shadow-level-2 ring-1 ring-white/10",
        className,
      )}
      onMouseMove={agendarOcultar}
      onMouseLeave={() => {
        const v = videoRef.current;
        if (v && !v.paused) setMostrarControles(false);
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        playsInline
        // preload="metadata": o player só precisa da duração para desenhar a
        // barra; o resto chega conforme a reprodução avança.
        preload="metadata"
        className="max-h-[75vh] w-full bg-black object-contain"
        onClick={alternarPlay}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDuracao(v.duration || 0);
          setVolume(v.volume);
          setMudo(v.muted);
          setCarregando(false);
        }}
        onWaiting={() => setCarregando(true)}
        onPlaying={() => {
          setCarregando(false);
          setTerminou(false);
        }}
        onTimeUpdate={(e) => setTempo(e.currentTarget.currentTime)}
        onPlay={() => {
          setTocando(true);
          agendarOcultar();
        }}
        onPause={() => {
          setTocando(false);
          setMostrarControles(true);
        }}
        onEnded={() => {
          setTocando(false);
          setTerminou(true);
          setMostrarControles(true);
        }}
      />

      {carregando && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/25 border-t-[#f7cac9]" />
        </div>
      )}

      {/* Botão central: só quando parado, para não tapar a peça durante o vídeo */}
      {!tocando && !carregando && (
        <button
          type="button"
          onClick={alternarPlay}
          aria-label={terminou ? "Assistir de novo" : "Reproduzir"}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f7cac9]/90 text-[#5a3436] shadow-level-2 transition-transform hover:scale-105">
            {terminou ? (
              <RotateCcw className="h-7 w-7" strokeWidth={2} />
            ) : (
              <Play className="ml-1 h-8 w-8" strokeWidth={2} fill="currentColor" />
            )}
          </span>
        </button>
      )}

      {/* Barra de controles */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-3 pt-8 transition-opacity duration-200",
          mostrarControles ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {/* Linha do tempo. `appearance-none` + gradiente = trilha rosa preenchida. */}
        <input
          type="range"
          min={0}
          max={duracao || 0}
          step={0.1}
          value={tempo}
          onChange={(e) => irPara(Number(e.target.value))}
          aria-label="Linha do tempo"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/25 outline-none [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
          style={{
            background: `linear-gradient(to right, #f7cac9 ${progresso}%, rgba(255,255,255,0.25) ${progresso}%)`,
          }}
        />

        <div className="mt-2 flex items-center gap-3 text-white">
          <button
            type="button"
            onClick={alternarPlay}
            aria-label={tocando ? "Pausar" : "Reproduzir"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
          >
            {tocando ? (
              <Pause className="h-5 w-5" strokeWidth={2} fill="currentColor" />
            ) : (
              <Play className="h-5 w-5" strokeWidth={2} fill="currentColor" />
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={alternarMudo}
              aria-label={mudo ? "Ativar som" : "Silenciar"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
            >
              {mudo || volume === 0 ? (
                <VolumeX className="h-5 w-5" strokeWidth={1.75} />
              ) : (
                <Volume2 className="h-5 w-5" strokeWidth={1.75} />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={mudo ? 0 : volume}
              onChange={(e) => {
                const v = videoRef.current;
                if (!v) return;
                const novo = Number(e.target.value);
                v.volume = novo;
                v.muted = novo === 0;
                setVolume(novo);
                setMudo(novo === 0);
              }}
              aria-label="Volume"
              className="hidden h-1 w-20 cursor-pointer appearance-none rounded-full outline-none sm:block [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
              style={{
                background: `linear-gradient(to right, #f7cac9 ${(mudo ? 0 : volume) * 100}%, rgba(255,255,255,0.25) ${(mudo ? 0 : volume) * 100}%)`,
              }}
            />
          </div>

          <span className="ml-auto shrink-0 font-mono text-label-sm tabular-nums text-white/85">
            {formatarTempo(tempo)} / {formatarTempo(duracao)}
          </span>

          <button
            type="button"
            onClick={() => void alternarTelaCheia()}
            aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
          >
            {telaCheia ? (
              <Minimize2 className="h-5 w-5" strokeWidth={1.75} />
            ) : (
              <Maximize2 className="h-5 w-5" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** mm:ss (ou h:mm:ss quando passa da hora). */
function formatarTempo(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const total = Math.floor(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const seg = total % 60;
  const doisDigitos = (n: number) => String(n).padStart(2, "0");
  return h > 0
    ? `${h}:${doisDigitos(m)}:${doisDigitos(seg)}`
    : `${m}:${doisDigitos(seg)}`;
}
