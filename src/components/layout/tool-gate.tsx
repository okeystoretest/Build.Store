"use client";

import { Lock } from "lucide-react";
import { useToolAccess } from "@/hooks/use-tool-access";
import { LoadingArea } from "@/components/ui/spinner";
import { toolLabel, type ToolKey } from "@/features/settings/tool-access";

/**
 * Barreira de tela para o cadeado.
 *
 * Esconder o item da sidebar não basta: sem isto, quem soubesse a URL entrava
 * digitando `/reports` na barra de endereço. Aqui a mesma regra da sidebar é
 * aplicada ao conteúdo da página.
 *
 * Escopo: isto é controle de VISIBILIDADE de tela. O isolamento real de dados
 * entre lojas continua sendo a RLS no Postgres, e as ações sensíveis (criar
 * usuário, estornar venda, cadastrar produto) mantêm as próprias checagens de
 * papel no servidor — liberar a tela não libera o que a tela faz.
 */
export function ToolGate({
  tool,
  children,
}: {
  tool: ToolKey;
  children: React.ReactNode;
}) {
  const { can, loading } = useToolAccess();

  if (loading) {
    return (
      <div className="h-full px-margin py-md">
        <LoadingArea label="Carregando..." />
      </div>
    );
  }

  if (can(tool)) return <>{children}</>;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-margin text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
        <Lock className="h-7 w-7 text-on-surface-variant/60" strokeWidth={1.5} />
      </div>
      <p className="text-body-md text-on-surface-variant">
        <strong>{toolLabel(tool)}</strong> está bloqueado para o seu usuário.
        <br />
        Peça a liberação ao responsável pela loja.
      </p>
    </div>
  );
}
