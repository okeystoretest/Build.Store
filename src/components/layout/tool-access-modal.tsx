"use client";

import { useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
  LOCKABLE_ROLES,
  ROLE_LABEL,
  type LockableRole,
  type RoleAccess,
  type ToolKey,
  toolLabel,
} from "@/features/settings/tool-access";

/**
 * Modal do cadeado — escolhe a quais perfis a ferramenta fica liberada.
 *
 * O cadeado tem só duas funções: **bloquear** e **desbloquear**. O terceiro
 * estado ("segue o padrão do papel") sumiu da interface: o modal já abre
 * mostrando o estado atual de cada perfil, então o padrão continua valendo até
 * o admin decidir o contrário — só que agora ele vê, e não deduz, o que cada
 * perfil enxerga.
 *
 * Admin não aparece na lista: o cadeado é editado pela própria sidebar, e um
 * admin que se trancasse fora de Gestão só voltaria por SQL.
 */
export function ToolAccessModal({
  tool,
  atual,
  unlockable,
  saving,
  onClose,
  onSave,
}: {
  tool: ToolKey;
  /** Estado efetivo de cada perfil hoje (liberado = true). */
  atual: Record<LockableRole, boolean>;
  /** false = a ferramenta não pode ser liberada para não-admin (`stores`). */
  unlockable: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (papeis: RoleAccess) => void;
}) {
  const [estado, setEstado] = useState<Record<LockableRole, boolean>>(atual);

  const mudou = LOCKABLE_ROLES.some((r) => estado[r] !== atual[r]);

  const aplicarTodos = (liberado: boolean) => {
    const novo = {} as Record<LockableRole, boolean>;
    for (const r of LOCKABLE_ROLES) novo[r] = liberado && unlockable ? true : liberado;
    setEstado(novo);
  };

  return (
    <Modal open onClose={onClose} title={`Acesso — ${toolLabel(tool)}`}>
      <div className="flex flex-col gap-md">
        <p className="text-body-md text-on-surface-variant">
          Selecione os perfis que podem usar{" "}
          <strong className="text-on-surface">{toolLabel(tool)}</strong> nesta
          loja.
        </p>

        <ul className="flex flex-col gap-2">
          {LOCKABLE_ROLES.map((papel) => {
            const liberado = estado[papel];
            const travado = !unlockable;
            return (
              <li
                key={papel}
                className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface p-3"
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    liberado
                      ? "bg-primary-fixed/60 text-primary"
                      : "bg-error/10 text-error",
                  )}
                >
                  {liberado ? (
                    <LockOpen className="h-5 w-5" strokeWidth={1.75} />
                  ) : (
                    <Lock className="h-5 w-5" strokeWidth={1.75} />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-label-lg font-medium text-on-surface">
                    {ROLE_LABEL[papel]}
                  </p>
                  <p className="text-label-sm text-on-surface-variant">
                    {liberado ? "Liberado" : "Bloqueado"}
                  </p>
                </div>

                <Button
                  size="sm"
                  variant={liberado ? "outline" : "primary"}
                  disabled={saving || (travado && !liberado)}
                  onClick={() =>
                    setEstado((s) => ({ ...s, [papel]: !s[papel] }))
                  }
                >
                  {liberado ? "Bloquear" : "Desbloquear"}
                </Button>
              </li>
            );
          })}
        </ul>

        {!unlockable && (
          <p className="text-label-sm text-on-surface-variant">
            {toolLabel(tool)} exclui a loja inteira em cascata — só pode ser
            bloqueada, nunca liberada para fora do Admin.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => aplicarTodos(true)}
            disabled={saving || !unlockable}
            className="text-label-sm text-primary hover:underline disabled:pointer-events-none disabled:opacity-40"
          >
            Liberar para todos
          </button>
          <span className="text-on-surface-variant/40">·</span>
          <button
            type="button"
            onClick={() => aplicarTodos(false)}
            disabled={saving}
            className="text-label-sm text-error hover:underline disabled:pointer-events-none disabled:opacity-40"
          >
            Bloquear para todos
          </button>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            disabled={saving || !mudou}
            onClick={() => {
              const papeis: RoleAccess = {};
              for (const r of LOCKABLE_ROLES) papeis[r] = estado[r];
              onSave(papeis);
            }}
          >
            {saving ? "Salvando..." : "Salvar acesso"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
