import { GRADE_SIZES, type GradeItem } from "@/types/domain";

/**
 * Utilidades da grade de peças (cor × tamanho fixo 36/38/40).
 * Uma fonte só de regras para somar estoque e criar/normalizar linhas.
 */

/** Cria uma linha de grade vazia (todas as quantidades zeradas). */
export function emptyGradeRow(color = ""): GradeItem {
  const sizes: Record<string, number> = {};
  for (const s of GRADE_SIZES) sizes[s] = 0;
  return { color, sizes };
}

/** Quantidade de uma variação específica (0 se ausente). */
export function variationQty(item: GradeItem, size: string): number {
  return Number(item.sizes?.[size]) || 0;
}

/** Estoque total de uma linha (soma dos tamanhos). */
export function rowTotal(item: GradeItem): number {
  return GRADE_SIZES.reduce((sum, s) => sum + variationQty(item, s), 0);
}

/** Estoque total do produto (soma de todas as linhas da grade). */
export function gradeTotal(grade: GradeItem[]): number {
  return (grade ?? []).reduce((sum, row) => sum + rowTotal(row), 0);
}

/**
 * Normaliza a grade para o formato canônico: garante que cada linha tenha as
 * três chaves de tamanho, converte valores para inteiros ≥ 0 e descarta linhas
 * sem cor e sem nenhuma quantidade.
 */
export function normalizeGrade(grade: GradeItem[]): GradeItem[] {
  return (grade ?? [])
    .map((row) => {
      const sizes: Record<string, number> = {};
      for (const s of GRADE_SIZES) {
        sizes[s] = Math.max(0, Math.floor(Number(row.sizes?.[s]) || 0));
      }
      const color = row.color?.trim() ? row.color.trim() : null;
      return { color, sizes };
    })
    .filter((row) => row.color !== null || rowTotal(row) > 0);
}
