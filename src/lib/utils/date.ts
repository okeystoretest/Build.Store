/**
 * Datas na fronteira do banco e no agrupamento por dia.
 *
 * ## O problema que este arquivo existe para fechar
 *
 * O driver `pg` converte `timestamp`/`timestamptz`/`date` em **objeto `Date`**
 * antes de a linha chegar ao Kysely. O schema, porém, declarava essas colunas
 * como `string`, e os mappers faziam `r.created_at as string` — um `as` não
 * converte nada, só manda o TypeScript calar a boca. O resultado era um `Date`
 * viajando por todo o app com a etiqueta de `string`:
 *
 *   - `tsc` passava limpo;
 *   - `new Date(o.createdAt)` funcionava por acaso (o construtor aceita `Date`);
 *   - `o.createdAt.slice(0, 10)` explodia em `slice is not a function`,
 *     derrubando Relatórios e Pedidos com tela em branco;
 *   - `<input type="date" value={birthDate}>` recebia um `Date` e ficava vazio,
 *     sem erro nenhum.
 *
 * Era uma herança da migração do Supabase: o PostgREST devolvia JSON, com datas
 * em texto. O `pg` não.
 *
 * A regra agora é: **nada sai do mapper sem passar por aqui.** O tipo
 * `ISODateString` do domínio volta a ser verdade.
 *
 * ## Fuso horário
 *
 * `toIsoString` normaliza para UTC, que é o certo para um instante. Mas o dia
 * do relatório NÃO é UTC: uma venda às 21h30 em São Paulo acontece às 00h30 do
 * dia seguinte em UTC. Agrupar por `slice(0, 10)` de um ISO jogava toda venda
 * depois das 21h no relatório do dia errado — e o fechamento de caixa fechava
 * torto. Por isso o agrupamento usa `localDayKey`, no fuso de quem está olhando
 * a tela, que é o fuso da loja.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Qualquer coisa vinda do banco → string ISO 8601 em UTC.
 * Entrada inválida vira string vazia, nunca `undefined`: quem consome espera
 * poder chamar método de string sem checar.
 */
export function toIsoString(valor: unknown): string {
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? "" : valor.toISOString();
  }
  if (typeof valor === "string") {
    if (!valor) return "";
    // Já é ISO com "T": devolve intacto (não reprocessa à toa).
    if (/^\d{4}-\d{2}-\d{2}T/.test(valor)) return valor;
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? valor : d.toISOString();
  }
  if (typeof valor === "number") {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  }
  return "";
}

/** Versão que preserva o nulo — para colunas de data opcionais. */
export function toIsoStringOrNull(valor: unknown): string | null {
  if (valor == null) return null;
  const iso = toIsoString(valor);
  return iso || null;
}

/**
 * Coluna `date` (sem hora) → "YYYY-MM-DD".
 *
 * Lê os componentes LOCAIS de propósito. O `pg` monta a data com
 * `new Date(ano, mes, dia)` no fuso do processo; reler com `toISOString()`
 * deslocaria o dia sempre que o servidor não estivesse em UTC. Com os getters
 * locais, sai exatamente o que o Postgres guardou.
 */
export function toIsoDateOrNull(valor: unknown): string | null {
  if (valor == null) return null;
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    return `${valor.getFullYear()}-${pad(valor.getMonth() + 1)}-${pad(valor.getDate())}`;
  }
  if (typeof valor === "string") return valor.slice(0, 10) || null;
  return null;
}

/**
 * Chave de agrupamento por dia — "YYYY-MM-DD" no fuso de quem está olhando.
 *
 * Aceita `Date` além de string de propósito: se algum dia outra coluna escapar
 * da normalização, o relatório sai certo em vez de derrubar a tela. Um bug de
 * tipo não deveria custar uma tela em branco no meio do expediente.
 */
export function localDayKey(valor: string | Date | null | undefined): string {
  if (!valor) return "";
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * "YYYY-MM-DD" → `Date` à meia-noite LOCAL.
 *
 * `new Date("2026-08-17")` é interpretado como meia-noite **UTC** pela
 * especificação. Formatado depois no fuso de São Paulo, isso vira 16/08 às 21h
 * — e o rótulo do gráfico mostrava o dia anterior ao do dado. Construindo pelos
 * componentes, o dia é o mesmo que a chave.
 */
export function parseDayKey(chave: string): Date {
  const [ano, mes, dia] = chave.split("-").map(Number);
  return new Date(ano ?? 1970, (mes ?? 1) - 1, dia ?? 1);
}
