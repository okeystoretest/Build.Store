"use client";

import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus, Megaphone, Target, Pencil, Trash2 } from "lucide-react";
import { useManagement } from "@/features/management/hooks/use-management";
import {
  updateUser,
  deleteUser,
  updateCampaign,
  deleteCampaign,
  updateGoal,
  deleteGoal,
} from "@/lib/db/management-repository";
import { parseToCents } from "@/lib/utils/money";
import { queryKeys } from "@/lib/db/query-keys";
import { setStoreName } from "@/lib/db/settings-repository";
import { useStoreName } from "@/hooks/use-store-name";
import { Store } from "lucide-react";
import type { User, Campaign, Goal, Role } from "@/types/domain";
import { UserForm, ROLE_LABELS } from "./user-form";
import { CampaignForm } from "./campaign-form";
import { GoalForm } from "./goal-form";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/utils/money";

type Tool = "users" | "campaigns" | "goals" | "store";

/**
 * Gestão screen — three management tools: user registration, campaign creation
 * and goal definition. Each is paired with a live list of what already exists.
 * Access is gated to lojista/admin at the sidebar + route level.
 */
export function ManagementScreen() {
  const m = useManagement();
  const [tool, setTool] = useState<Tool>("users");

  // Invalidação por área após escritas; o Realtime também converge entre
  // dispositivos. Cada lista abaixo cuida da própria invalidação.
  const queryClient = useQueryClient();
  const refreshAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.users });
    void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns });
    void queryClient.invalidateQueries({ queryKey: queryKeys.goals });
  }, [queryClient]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-md border-b border-outline-variant/50 px-margin py-md">
        <h1 className="text-headline-lg text-primary">Gestão</h1>
        <div className="ml-auto">
          <ToggleGroup
            aria-label="Ferramenta de gestão"
            value={tool}
            onChange={setTool}
            options={[
              { value: "users", label: "Usuários", icon: <UserPlus className="h-4 w-4" strokeWidth={1.75} /> },
              { value: "campaigns", label: "Campanhas", icon: <Megaphone className="h-4 w-4" strokeWidth={1.75} /> },
              { value: "goals", label: "Metas", icon: <Target className="h-4 w-4" strokeWidth={1.75} /> },
              { value: "store", label: "Loja", icon: <Store className="h-4 w-4" strokeWidth={1.75} /> },
            ]}
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-margin py-md">
        {tool === "store" ? (
          <StoreSettings />
        ) : (
          <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(360px,440px)_1fr]">
          {/* Form column */}
          <div className="rounded-lg bg-surface-container-lowest p-md shadow-level-1">
            {tool === "users" && (
              <>
                <h2 className="mb-md text-headline-md text-on-surface">
                  Cadastrar usuário
                </h2>
                <UserForm onCreated={refreshAll} />
              </>
            )}
            {tool === "campaigns" && (
              <>
                <h2 className="mb-md text-headline-md text-on-surface">
                  Criar campanha
                </h2>
                <CampaignForm onCreated={refreshAll} />
              </>
            )}
            {tool === "goals" && (
              <>
                <h2 className="mb-md text-headline-md text-on-surface">
                  Definir meta
                </h2>
                <GoalForm
                  sellers={m.sellers}
                  campaigns={m.campaigns}
                  onCreated={refreshAll}
                />
              </>
            )}
          </div>

          {/* List column */}
          <div className="rounded-lg bg-surface-container-lowest p-md shadow-level-1">
            {tool === "users" && <UsersList users={m.users} />}
            {tool === "campaigns" && <CampaignsList campaigns={m.campaigns} />}
            {tool === "goals" && (
              <GoalsList
                goals={m.goals}
                sellers={m.sellers}
                campaigns={m.campaigns}
              />
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButtons({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <span className="flex items-center gap-1">
      <button
        onClick={onEdit}
        aria-label="Editar"
        title="Editar"
        className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
      >
        <Pencil className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button
        onClick={onDelete}
        aria-label="Excluir"
        title="Excluir"
        className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </span>
  );
}

function UsersList({ users }: { users: ReturnType<typeof useManagement>["users"] }) {
  const [editing, setEditing] = useState<User | null>(null);
  const [confirm, setConfirm] = useState<User | null>(null);
  const queryClient = useQueryClient();
  const invalidateUsers = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.users });

  return (
    <>
      <h3 className="mb-md text-headline-md text-on-surface">Usuários</h3>
      {users.length === 0 ? (
        <Empty text="Nenhum usuário cadastrado." />
      ) : (
        <ul className="space-y-sm">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-md rounded-md bg-surface-container-low px-md py-sm"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-fixed/60 text-label-sm font-semibold text-primary">
                  {u.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.photoUrl} alt={u.fullName} className="h-full w-full object-cover" />
                  ) : (
                    u.fullName.slice(0, 2).toUpperCase()
                  )}
                </span>
                <span className="text-body-md text-on-surface">{u.fullName}</span>
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={u.role === "admin" ? "primary" : "neutral"}>
                  {ROLE_LABELS[u.role]}
                </Badge>
                <ActionButtons
                  onEdit={() => setEditing(u)}
                  onDelete={() => setConfirm(u)}
                />
              </span>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Editar usuário">
        {editing && (
          <UserEditForm
            user={editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDelete
        open={confirm !== null}
        label={confirm?.fullName ?? ""}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm) { await deleteUser(confirm.id); void invalidateUsers(); }
          setConfirm(null);
        }}
      />
    </>
  );
}

function UserEditForm({ user, onDone }: { user: User; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(user.fullName);
  const [birthDate, setBirthDate] = useState(user.birthDate ?? "");
  const [role, setRole] = useState<Role>(user.role);
  const [photoUrl, setPhotoUrl] = useState<string | null>(user.photoUrl);

  const handlePhoto = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    await updateUser(user.id, {
      fullName: fullName.trim(),
      birthDate: birthDate || null,
      role,
      photoUrl,
    });
    await queryClient.invalidateQueries({ queryKey: queryKeys.users });
    onDone();
  };

  return (
    <div className="space-y-md">
      <div className="space-y-1.5">
        <Label>Foto do usuário</Label>
        <div className="flex items-center gap-md">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-surface-container text-label-md font-semibold text-primary">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Prévia" className="h-full w-full object-cover" />
            ) : (
              user.fullName.slice(0, 2).toUpperCase()
            )}
          </div>
          <label className="cursor-pointer rounded-full border border-primary-container px-5 py-2.5 text-label-md text-primary hover:bg-primary-fixed/40">
            Trocar foto
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhoto(e.target.files?.[0])}
            />
          </label>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Nome completo</Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-md">
        <div className="space-y-1.5">
          <Label>Data de nascimento</Label>
          <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Nível de acesso</Label>
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="vendedora">Vendedora</option>
            <option value="lojista">Lojista</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-sm pt-sm">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={save} disabled={!fullName.trim()}>
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}

function CampaignsList({
  campaigns,
}: {
  campaigns: ReturnType<typeof useManagement>["campaigns"];
}) {
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState<Campaign | null>(null);
  const queryClient = useQueryClient();
  const invalidateCampaigns = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.campaigns });

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setName(c.name);
  };

  return (
    <>
      <h3 className="mb-md text-headline-md text-on-surface">Campanhas</h3>
      {campaigns.length === 0 ? (
        <Empty text="Nenhuma campanha criada." />
      ) : (
        <ul className="space-y-sm">
          {campaigns.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-md rounded-md bg-surface-container-low px-md py-sm"
            >
              <span className="text-body-md text-on-surface">{c.name}</span>
              <span className="flex items-center gap-2">
                <Badge tone={c.active ? "success" : "neutral"}>
                  {c.active ? "Ativa" : "Inativa"}
                </Badge>
                <ActionButtons
                  onEdit={() => openEdit(c)}
                  onDelete={() => setConfirm(c)}
                />
              </span>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Editar campanha">
        {editing && (
          <div className="space-y-md">
            <div className="space-y-1.5">
              <Label>Nome da campanha</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-body-md text-on-surface">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(e) =>
                    setEditing({ ...editing, active: e.target.checked })
                  }
                />
                Campanha ativa
              </label>
            </div>
            <div className="flex justify-end gap-sm pt-sm">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  await updateCampaign(editing.id, {
                    name: name.trim(),
                    active: editing.active,
                  });
                  void invalidateCampaigns();
                  setEditing(null);
                }}
                disabled={!name.trim()}
              >
                Salvar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDelete
        open={confirm !== null}
        label={confirm?.name ?? ""}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm) { await deleteCampaign(confirm.id); void invalidateCampaigns(); }
          setConfirm(null);
        }}
      />
    </>
  );
}

function GoalsList({
  goals,
  sellers,
  campaigns,
}: {
  goals: ReturnType<typeof useManagement>["goals"];
  sellers: ReturnType<typeof useManagement>["sellers"];
  campaigns: ReturnType<typeof useManagement>["campaigns"];
}) {
  const queryClient = useQueryClient();
  const invalidateGoals = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.goals });
  const [editing, setEditing] = useState<Goal | null>(null);
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [confirm, setConfirm] = useState<Goal | null>(null);

  const sellerName = (id: string) =>
    sellers.find((s) => s.id === id)?.fullName ?? "—";
  const campaignName = (id: string | null) =>
    campaigns.find((c) => c.id === id)?.name ?? "—";

  const openEdit = (g: Goal) => {
    setEditing(g);
    setAmount(g.targetCents != null ? (g.targetCents / 100).toString() : "");
    setQuantity(g.targetQuantity != null ? g.targetQuantity.toString() : "");
  };

  return (
    <>
      <h3 className="mb-md text-headline-md text-on-surface">Metas definidas</h3>
      {goals.length === 0 ? (
        <Empty text="Nenhuma meta definida." />
      ) : (
        <ul className="space-y-sm">
          {goals.map((g) => (
            <li key={g.id} className="rounded-md bg-surface-container-low px-md py-sm">
              <div className="flex items-center justify-between">
                <span className="text-body-md font-medium text-on-surface">
                  {sellerName(g.sellerId)}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={g.type === "general" ? "primary" : "neutral"}>
                    {g.type === "general" ? "Geral" : "Campanha"}
                  </Badge>
                  <ActionButtons
                    onEdit={() => openEdit(g)}
                    onDelete={() => setConfirm(g)}
                  />
                </span>
              </div>
              <p className="mt-1 text-label-md text-on-surface-variant">
                {g.type === "general"
                  ? `Meta: ${formatBRL(g.targetCents ?? 0)}`
                  : `${campaignName(g.campaignId)} · ${g.targetQuantity ?? 0} itens`}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Editar meta">
        {editing && (
          <div className="space-y-md">
            <p className="text-body-md text-on-surface-variant">
              {sellerName(editing.sellerId)} ·{" "}
              {editing.type === "general" ? "Meta geral" : campaignName(editing.campaignId)}
            </p>
            {editing.type === "general" ? (
              <div className="space-y-1.5">
                <Label>Meta em valor (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="5.000,00"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Meta em quantidade de itens</Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            )}
            <div className="flex justify-end gap-sm pt-sm">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  await updateGoal(editing.id, {
                    targetCents:
                      editing.type === "general" ? parseToCents(amount) : null,
                    targetQuantity:
                      editing.type === "campaign" ? Number(quantity) || 0 : null,
                  });
                  void invalidateGoals();
                  setEditing(null);
                }}
              >
                Salvar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDelete
        open={confirm !== null}
        label={confirm ? `meta de ${sellerName(confirm.sellerId)}` : ""}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm) { await deleteGoal(confirm.id); void invalidateGoals(); }
          setConfirm(null);
        }}
      />
    </>
  );
}

function ConfirmDelete({
  open,
  label,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title="Confirmar exclusão">
      <div className="space-y-md">
        <p className="text-body-md text-on-surface">
          Tem certeza que deseja excluir <strong>{label}</strong>? Essa ação não
          pode ser desfeita.
        </p>
        <div className="flex justify-end gap-sm">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <button
            onClick={onConfirm}
            className="rounded-full bg-error px-6 py-3 text-label-md font-semibold text-on-error transition-opacity hover:opacity-90"
          >
            Excluir
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-body-md text-on-surface-variant">{text}</p>;
}

/**
 * Configurações da loja. Por ora, apenas o "Nome da Loja", que substitui o
 * título abaixo da logo na sidebar (global, via tabela settings). Salvar
 * invalida o cache; o Realtime propaga para os demais dispositivos.
 */
function StoreSettings() {
  const currentName = useStoreName();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sincroniza o campo com o valor atual quando ele chega/muda.
  useEffect(() => {
    setName(currentName);
  }, [currentName]);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      await setStoreName(name.trim());
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl rounded-lg bg-surface-container-lowest p-md shadow-level-1">
      <h2 className="mb-md text-headline-md text-on-surface">Dados da loja</h2>
      <div className="space-y-1.5">
        <Label>Nome da Loja</Label>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          placeholder="Ex.: Okey Store"
        />
        <p className="px-2 text-label-sm text-on-surface-variant">
          Exibido abaixo da logo, na barra lateral.
        </p>
      </div>
      <div className="mt-md flex items-center gap-md">
        <Button onClick={save} disabled={saving || !name.trim()}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
        {saved && (
          <span className="text-label-md text-primary">Nome atualizado.</span>
        )}
      </div>
    </div>
  );
}
