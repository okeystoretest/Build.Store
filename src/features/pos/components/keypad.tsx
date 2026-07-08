"use client";

import { Delete } from "lucide-react";

interface KeypadProps {
  onDigit: (digit: string) => void;
  onClear: () => void;
  onBackspace: () => void;
}

/**
 * Calculadora de dinheiro — layout compacto, responsivo e SEM rolagem vertical.
 * As teclas usam altura fixa (não mais aspect-square, que esticava a coluna),
 * então o teclado inteiro cabe na área de checkout em qualquer altura de tela.
 */
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function Keypad({ onDigit, onClear, onBackspace }: KeypadProps) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {KEYS.map((k) => (
        <KeypadButton key={k} onClick={() => onDigit(k)}>
          {k}
        </KeypadButton>
      ))}
      <KeypadButton onClick={onClear} aria-label="Limpar valor" variant="muted">
        C
      </KeypadButton>
      <KeypadButton onClick={() => onDigit("0")}>0</KeypadButton>
      <KeypadButton
        onClick={onBackspace}
        aria-label="Apagar dígito"
        variant="muted"
      >
        <Delete className="h-4 w-4" strokeWidth={1.75} />
      </KeypadButton>
    </div>
  );
}

function KeypadButton({
  children,
  onClick,
  variant = "default",
  ...props
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "muted";
  "aria-label"?: string;
}) {
  const base =
    "flex h-11 items-center justify-center rounded-xl text-body-lg font-medium transition-colors sm:h-12";
  const skin =
    variant === "muted"
      ? "bg-surface-container text-on-surface-variant hover:bg-primary-fixed/40"
      : "bg-surface-container-low text-on-surface hover:bg-primary-fixed/50 active:bg-primary-fixed";
  return (
    <button onClick={onClick} className={`${base} ${skin}`} {...props}>
      {children}
    </button>
  );
}
