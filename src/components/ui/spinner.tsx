import { cn } from "@/lib/utils/cn";

/**
 * Spinner minimalista, herda a cor do texto (currentColor). Usado em botões
 * (estado salvando) e como indicador de carregamento em áreas.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/**
 * Ocupa a área disponível e centraliza um spinner. Usado em loading.tsx de rota
 * e em telas enquanto os dados chegam do Supabase.
 */
export function LoadingArea({ label }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[40vh] w-full flex-col items-center justify-center gap-3 text-on-surface-variant">
      <Spinner className="h-8 w-8 text-primary" />
      {label && <p className="text-label-md">{label}</p>}
    </div>
  );
}
