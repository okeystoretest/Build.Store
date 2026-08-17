import { cn } from "@/lib/utils/cn";

/** Caminho único do símbolo da plataforma (versão transparente). */
export const BRAND_MARK = "/icons/brand-mark.png";

/**
 * Símbolo da plataforma (o "B" manuscrito sobre o disco rosa).
 *
 * PNG transparente: o disco faz parte do desenho, então o arquivo não precisa
 * de fundo próprio e assenta igual no tema claro e no escuro.
 *
 * `alt` vazio + `aria-hidden` por padrão: quando o símbolo aparece ao lado da
 * palavra "Build.Sales" (ver `BrandLockup`), anunciar os dois faria o leitor de
 * tela repetir o nome da marca. Onde ele aparece sozinho, passe `alt`.
 */
export function BrandMark({
  className,
  alt = "",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND_MARK}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      className={cn("shrink-0 select-none object-contain", className)}
    />
  );
}

/**
 * Marca nominal "Build.Sales". A divisão usa os dois tokens de marca do
 * sistema — `primary` em "Build." e `secondary` em "Sales" — nenhuma cor solta.
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-logo select-none leading-none", className)}>
      <span className="text-primary">Build.</span>
      <span className="text-secondary">Sales</span>
    </span>
  );
}

/**
 * Assinatura horizontal: símbolo + marca nominal. Usada onde há largura para as
 * duas (cabeçalho da sidebar expandida, tela de login).
 */
export function BrandLockup({
  className,
  markClassName,
  wordClassName,
}: {
  className?: string;
  markClassName?: string;
  wordClassName?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      title="Build.Sales"
      aria-label="Build.Sales"
      role="img"
    >
      <BrandMark className={cn("h-8 w-8", markClassName)} />
      <BrandWordmark className={cn("text-[1.6rem]", wordClassName)} />
    </span>
  );
}
