"use client";

import { Delete } from "lucide-react";

interface KeypadProps {
  onDigit: (digit: string) => void;
  onClear: () => void;
  onBackspace: () => void;
}

/** Circular keypad per the POS spec. Only the layout; value logic lives above. */
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function Keypad({ onDigit, onClear, onBackspace }: KeypadProps) {
  return (
    <div className="grid grid-cols-3 gap-sm">
      {KEYS.map((k) => (
        <KeypadButton key={k} onClick={() => onDigit(k)}>
          {k}
        </KeypadButton>
      ))}
      <KeypadButton onClick={onClear} aria-label="Limpar valor">
        C
      </KeypadButton>
      <KeypadButton onClick={() => onDigit("0")}>0</KeypadButton>
      <KeypadButton onClick={onBackspace} aria-label="Apagar dígito">
        <Delete className="h-5 w-5" strokeWidth={1.75} />
      </KeypadButton>
    </div>
  );
}

function KeypadButton({
  children,
  onClick,
  ...props
}: {
  children: React.ReactNode;
  onClick: () => void;
  "aria-label"?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex aspect-square items-center justify-center rounded-full bg-surface-container-low text-headline-md font-medium text-on-surface transition-colors hover:bg-primary-fixed/50 active:bg-primary-fixed"
      {...props}
    >
      {children}
    </button>
  );
}
