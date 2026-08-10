import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Select nativo estilizado para casar com a linguagem dos inputs.
 *
 * O campo visível é totalmente controlável: borda arredondada (rounded-full),
 * mesmo tom das demais bordas, e a seta (chevron) desenhada por nós, recuada
 * da borda direita (right-4) em vez da seta padrão do navegador (removida via
 * appearance-none).
 *
 * `className` é aplicado ao container (largura/altura, ex.: "w-52", "h-11"),
 * e o <select> preenche o container (h-full). Assim a seta customizada
 * acompanha o tamanho do campo em todos os usos.
 *
 * Observação: o popover de <option> de um <select> nativo é renderizado pelo
 * sistema operacional e não aceita border-radius por CSS de forma confiável
 * entre navegadores. Arredondamos e padronizamos tudo que é controlável
 * (o campo/gatilho); a lista suspensa segue o visual nativo do SO.
 */
export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className={cn("relative h-14 w-full", className)}>
    <select
      ref={ref}
      className="h-full w-full appearance-none rounded-full border border-outline-variant bg-surface pl-6 pr-12 text-body-md text-on-surface focus:border-primary-container focus:outline-none"
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      aria-hidden="true"
      strokeWidth={1.75}
      className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant"
    />
  </div>
));
Select.displayName = "Select";
