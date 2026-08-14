/**
 * Cabeçalho HTTP `Range` — em módulo próprio, e não dentro da rota, porque um
 * route handler do Next só aceita exportar os nomes que ele conhece (GET, POST,
 * runtime, ...): qualquer outro export quebra a checagem de tipos do build.
 * Aqui a função também fica testável isoladamente.
 */

/** "bytes=0-1023" / "bytes=500-" / "bytes=-500" → intervalo absoluto. */
export function parseRange(
  header: string | null,
  size: number,
): { start: number; end: number } | null | "invalido" {
  if (!header) return null;

  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return "invalido";

  const [, cruStart, cruEnd] = m;
  let start: number;
  let end: number;

  if (cruStart === "") {
    // Sufixo: os últimos N bytes.
    const n = Number(cruEnd);
    if (!Number.isFinite(n) || n <= 0) return "invalido";
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(cruStart);
    end = cruEnd === "" ? size - 1 : Number(cruEnd);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return "invalido";
  if (start > end || start >= size) return "invalido";

  return { start, end: Math.min(end, size - 1) };
}
