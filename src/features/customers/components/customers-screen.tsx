"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { useCustomers } from "@/features/customers/hooks/use-customers";
import {
  createCustomer,
  updateCustomer,
  deleteCustomer,
  nextCustomerCode,
} from "@/lib/db/customer-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { formatPhone } from "@/lib/utils/phone";
import type { Customer } from "@/types/domain";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { LoadingArea } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";

/**
 * Módulo de Clientes. Formulário de cadastro (código automático + único, nome,
 * contato com máscara, endereço) ao lado da lista viva de clientes, com editar
 * e excluir. Acessível a todos os usuários.
 */
export function CustomersScreen() {
  const { customers, loading } = useCustomers();
  const [editing, setEditing] = useState<Customer | null>(null);
  const [confirm, setConfirm] = useState<Customer | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.customers });

  if (loading) {
    return (
      <div className="h-full px-margin py-md">
        <LoadingArea label="Carregando clientes..." />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-outline-variant/50 px-margin py-md sm:gap-md">
        <h1 className="font-logo text-headline-lg-mobile text-primary sm:text-headline-lg">Clientes</h1>
        <span className="ml-auto text-label-md text-on-surface-variant">
          {customers.length}{" "}
          {customers.length === 1 ? "cliente" : "clientes"}
        </span>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-md overflow-y-auto px-margin py-md lg:grid-cols-[minmax(340px,420px)_1fr]">
        <div className="rounded-lg bg-surface-container-lowest p-md shadow-level-1">
          <div className="mb-md flex items-center gap-2 text-on-surface">
            <UserPlus className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <h2 className="text-headline-md">Cadastrar cliente</h2>
          </div>
          <CustomerForm
            onSaved={() => {
              refresh();
              toast.success("Cliente cadastrado.");
            }}
          />
        </div>

        <div className="rounded-lg bg-surface-container-lowest p-md shadow-level-1">
          <h2 className="mb-md text-headline-md text-on-surface">
            Clientes cadastrados
          </h2>
          {customers.length === 0 ? (
            <p className="py-lg text-center text-body-md text-on-surface-variant">
              Nenhum cliente cadastrado ainda.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-outline-variant/50 scrollbar-slim">
              <table className="w-full min-w-[520px] text-body-md">
                <thead>
                  <tr className="bg-surface-container text-label-sm uppercase tracking-wide text-on-surface-variant">
                    <th className="px-3 py-2 text-left font-medium">Código</th>
                    <th className="px-3 py-2 text-left font-medium">Nome</th>
                    <th className="px-3 py-2 text-left font-medium">Contato</th>
                    <th className="px-3 py-2 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      className="animate-fade-in-up border-t border-outline-variant/40"
                    >
                      <td className="px-3 py-2 font-medium text-primary">
                        {c.code ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-on-surface">{c.name}</td>
                      <td className="px-3 py-2 text-on-surface-variant">
                        {c.phone ? formatPhone(c.phone) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <IconBtn
                            label="Editar"
                            onClick={() => setEditing(c)}
                          >
                            <Pencil className="h-4 w-4" strokeWidth={1.75} />
                          </IconBtn>
                          <IconBtn
                            label="Excluir"
                            danger
                            onClick={() => setConfirm(c)}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Editar */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Editar cliente"
      >
        {editing && (
          <CustomerForm
            initial={editing}
            submitLabel="Salvar alterações"
            onSaved={() => {
              setEditing(null);
              refresh();
              toast.success("Cliente atualizado.");
            }}
          />
        )}
      </Modal>

      {/* Confirmar exclusão */}
      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title="Excluir cliente"
      >
        <div className="space-y-md">
          <p className="text-body-md text-on-surface">
            Remover <strong>{confirm?.name}</strong>? Esta ação não pode ser
            desfeita.
          </p>
          <div className="flex justify-end gap-sm">
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!confirm) return;
                try {
                  await deleteCustomer(confirm.id);
                  refresh();
                  toast.success("Cliente removido.");
                } catch {
                  toast.error("Não foi possível remover.");
                } finally {
                  setConfirm(null);
                }
              }}
            >
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** Formulário reutilizado no cadastro e na edição. */
function CustomerForm({
  initial,
  submitLabel = "Cadastrar cliente",
  onSaved,
}: {
  initial?: Customer;
  submitLabel?: string;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(
    initial?.phone ? formatPhone(initial.phone) : "",
  );
  const [address, setAddress] = useState(initial?.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No cadastro (sem initial), sugere o próximo código automático.
  useEffect(() => {
    if (initial) return;
    let active = true;
    nextCustomerCode()
      .then((c) => {
        if (active) setCode(c);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [initial]);

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError("Informe o nome completo do cliente.");
      return;
    }
    setSaving(true);
    try {
      if (initial) {
        await updateCustomer(initial.id, {
          code: code.trim() || null,
          name: name.trim(),
          phone: phone || null,
          address: address.trim() || null,
        });
      } else {
        await createCustomer({
          code: code.trim(),
          name: name.trim(),
          phone: phone || null,
          address: address.trim() || null,
        });
      }
      onSaved();
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Falha ao salvar o cliente.";
      setError(msg);
      toast.error("Não foi possível salvar o cliente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-md">
      <div className="space-y-1.5">
        <Label>Código</Label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="CLI-0001"
        />
        <p className="px-2 text-label-sm text-on-surface-variant">
          Gerado automaticamente; pode ser ajustado. Deve ser único.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Nome completo</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Maria Souza"
          autoComplete="name"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Contato</Label>
        <Input
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder="(85) 91234-5678"
          inputMode="numeric"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Endereço</Label>
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Rua, número, bairro, cidade"
        />
      </div>

      {error && <p className="px-2 text-label-sm text-error">{error}</p>}

      <Button onClick={submit} disabled={saving || name.trim().length < 2}>
        {saving ? "Salvando..." : submitLabel}
      </Button>
    </div>
  );
}

function IconBtn({
  label,
  children,
  onClick,
  danger,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={
        "flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors " +
        (danger
          ? "hover:bg-error-container hover:text-on-error-container"
          : "hover:bg-surface-container hover:text-on-surface")
      }
    >
      {children}
    </button>
  );
}
