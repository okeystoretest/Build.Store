"use client";

import { useState } from "react";
import { Building2, Pencil, Trash2, Plus, Upload, ImageIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useStores } from "@/features/stores/hooks/use-stores";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { LoadingArea } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { uploadFile, type UploadProgress } from "@/lib/utils/upload-file";
import { UploadProgressBar } from "@/components/ui/upload-progress";
import type { Store } from "@/types/domain";

/**
 * Lojas — CRUD de lojas (tenants), na barra lateral. Admin apenas.
 *
 * Ponto ÚNICO de cadastro de nome e foto da loja: a antiga aba Gestão › Loja
 * foi removida. O nome salvo aqui é o que aparece estilizado na sidebar, e a
 * foto vira a imagem de perfil da loja e de todos os usuários vinculados a ela.
 *
 * - Criar: nome + foto da loja (upload de imagem).
 * - Editar: nome, logo, ativa/inativa.
 * - Excluir: HARD-DELETE. Apaga a loja e, em cascata, TODOS os dados dela
 *   (produtos, vendas, clientes, etc). Irreversível — exige que o admin digite
 *   o nome exato da loja para confirmar.
 *
 * O gate real de escrita é a RLS (só admin); aqui espelhamos na UI.
 */
export function StoresScreen() {
  const { role, loading: authLoading } = useAuth();
  const isAdmin = role === "admin";
  const { stores, isLoading, create, update, remove } = useStores();
  const toast = useToast();

  const [editing, setEditing] = useState<Store | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Store | null>(null);

  if (authLoading) {
    return (
      <div className="h-full px-margin py-md">
        <LoadingArea label="Carregando..." />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-margin text-center">
        <Building2 className="h-10 w-10 text-on-surface-variant" strokeWidth={1.5} />
        <p className="text-body-md text-on-surface-variant">
          Apenas administradores podem gerenciar lojas.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-outline-variant/50 px-margin py-md">
        <h1 className="font-logo text-headline-lg-mobile text-primary sm:text-headline-lg">
          Lojas
        </h1>
        <div className="ml-auto">
          <Button size="lg" onClick={() => setCreating(true)}>
            <Plus className="h-5 w-5" strokeWidth={2} />
            Nova loja
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-margin py-md">
        {isLoading ? (
          <LoadingArea label="Carregando lojas..." />
        ) : stores.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">
            Nenhuma loja cadastrada ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {stores.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-surface p-3"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-fixed/60">
                  {s.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.logoUrl}
                      alt={s.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Building2 className="h-5 w-5 text-primary" strokeWidth={1.75} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-label-lg font-medium text-on-surface">
                    {s.name}
                  </p>
                  <Badge tone={s.active ? "primary" : "neutral"}>
                    {s.active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  aria-label={`Editar ${s.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
                >
                  <Pencil className="h-5 w-5" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(s)}
                  aria-label={`Excluir ${s.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-error transition-colors hover:bg-error/10"
                >
                  <Trash2 className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(creating || editing) && (
        <StoreFormModal
          store={editing}
          saving={create.isPending || update.isPending}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (values) => {
            try {
              if (editing) {
                await update.mutateAsync({ id: editing.id, patch: values });
                toast.success("Loja atualizada.");
              } else {
                await create.mutateAsync({
                  name: values.name ?? "",
                  logoUrl: values.logoUrl ?? null,
                });
                toast.success("Loja criada.");
              }
              setCreating(false);
              setEditing(null);
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : "Falha ao salvar a loja.",
              );
            }
          }}
        />
      )}

      {deleting && (
        <DeleteStoreModal
          store={deleting}
          deleting={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(deleting.id);
              toast.success("Loja excluída.");
              setDeleting(null);
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : "Falha ao excluir a loja.",
              );
            }
          }}
        />
      )}
    </div>
  );
}

function StoreFormModal({
  store,
  saving,
  onClose,
  onSubmit,
}: {
  store: Store | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (
    values: Partial<Pick<Store, "name" | "logoUrl" | "active">>,
  ) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(store?.name ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(store?.logoUrl ?? null);
  const [active, setActive] = useState(store?.active ?? true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const canSave = name.trim().length > 0 && !saving && !uploading;

  /**
   * Upload da foto: o arquivo vai para o disco via /api/upload e a coluna
   * `logo_url` guarda só a URL.
   */
  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    setUploading(true);
    setProgress({ loaded: 0, total: file.size, percent: 0, phase: "enviando" });
    try {
      const { url } = await uploadFile(file, "stores", {
        onProgress: setProgress,
      });
      setLogoUrl(url);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Falha ao enviar a imagem.",
      );
      setProgress(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={store ? "Editar loja" : "Nova loja"}>
      <div className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label>Nome da loja</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Loja Centro"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label>Foto da loja</Label>
          <div className="flex items-center gap-md">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-container">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Prévia da foto da loja"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon
                  className="h-8 w-8 text-on-surface-variant/40"
                  strokeWidth={1.5}
                />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex w-max cursor-pointer items-center gap-2 rounded-full border border-primary-container px-4 py-2.5 text-label-md text-primary transition-colors hover:bg-primary-fixed/40 aria-disabled:pointer-events-none aria-disabled:opacity-60" aria-disabled={uploading}>
                <Upload className="h-4 w-4" strokeWidth={1.75} />
                {uploading ? "Enviando..." : logoUrl ? "Trocar foto" : "Enviar foto"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    void handlePhoto(e.target.files?.[0]);
                    // Permite reenviar o mesmo arquivo depois de remover.
                    e.target.value = "";
                  }}
                />
              </label>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl(null)}
                  className="w-max text-label-sm text-error hover:underline"
                >
                  Remover foto
                </button>
              )}
            </div>
          </div>
          <UploadProgressBar progress={uploading ? progress : null} className="px-1" />
          <p className="px-1 text-label-sm text-on-surface-variant">
            JPG, PNG ou WebP, até 8 MB.
          </p>
        </div>
        {store && (
          <label className="flex items-center gap-2 text-body-md text-on-surface">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4"
            />
            Loja ativa
          </label>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            disabled={!canSave}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                logoUrl: logoUrl || null,
                ...(store ? { active } : {}),
              })
            }
          >
            {saving ? "Salvando..." : store ? "Salvar" : "Criar loja"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteStoreModal({
  store,
  deleting,
  onClose,
  onConfirm,
}: {
  store: Store;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === store.name;

  return (
    <Modal open onClose={onClose} title="Excluir loja">
      <div className="flex flex-col gap-4">
        <p className="text-body-md text-on-surface">
          Esta ação é <strong>permanente</strong>. Excluir{" "}
          <strong>{store.name}</strong> apaga a loja e todos os dados vinculados
          a ela — produtos, vendas, clientes, metas e mídia. Não há como desfazer.
        </p>
        <div className="space-y-1.5">
          <Label>
            Digite <strong>{store.name}</strong> para confirmar
          </Label>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={store.name}
            autoFocus
          />
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={deleting}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!matches || deleting}
            onClick={onConfirm}
          >
            {deleting ? "Excluindo..." : "Excluir permanentemente"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
