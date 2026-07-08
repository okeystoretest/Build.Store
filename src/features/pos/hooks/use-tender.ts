"use client";

import { useState, useCallback } from "react";

/**
 * Tender entry driven by the keypad. Digits accumulate as centavos
 * (calculator-style): pressing 1, 5, 0 yields R$ 1,50. Keeps the input
 * unambiguous on a touch keypad with no decimal key.
 */
export function useTender() {
  const [cents, setCents] = useState(0);

  const pushDigit = useCallback((digit: string) => {
    const n = Number(digit);
    if (Number.isNaN(n)) return;
    setCents((prev) => {
      const next = prev * 10 + n;
      // Cap to avoid overflow on absurd inputs (R$ 999.999,99).
      return Math.min(next, 99_999_999);
    });
  }, []);

  const backspace = useCallback(
    () => setCents((prev) => Math.floor(prev / 10)),
    [],
  );

  const clear = useCallback(() => setCents(0), []);

  /**
   * Define o valor recebido a partir de um texto em reais digitado pelo
   * usuário (ex.: "12,50" ou "12.50"). Converte para centavos; entradas
   * inválidas ou vazias zeram o valor.
   */
  const setFromReais = useCallback((input: string) => {
    const normalized = input.replace(/\./g, "").replace(",", ".").trim();
    if (normalized === "") {
      setCents(0);
      return;
    }
    const value = Number(normalized);
    if (Number.isNaN(value) || value < 0) return;
    setCents(Math.min(Math.round(value * 100), 99_999_999));
  }, []);

  return { cents, pushDigit, backspace, clear, set: setCents, setFromReais };
}
