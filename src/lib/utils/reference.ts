/** Generate a human-facing order reference like "#SRN-8842". */
export function orderReference(seq?: number): string {
  const n = seq ?? Math.floor(1000 + Math.random() * 9000);
  return `#SRN-${n}`;
}
