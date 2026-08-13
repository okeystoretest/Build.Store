"use client";

import { useRef, useState } from "react";
import { Upload, FileVideo, FileImage, File as FileIcon } from "lucide-react";
import type { ShowcaseSeason, ShowcaseTab } from "@/types/domain";
import { addShowcaseMediaAction } from "@/features/showcase/actions/showcase";
import { useStoreContext } from "@/features/stores/store-context";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { uploadFile, type UploadProgress } from "@/lib/utils/upload-file";
import { UploadProgressBar } from "@/components/ui/upload-progress";

interface UploadModalProps {
  open: boolean;
  tab: ShowcaseTab;
  onClose: () => void;
  onUploaded: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** Ícone conforme a aba, para a prévia do arquivo. */
function TabIcon({ tab }: { tab: ShowcaseTab }) {
  if (tab === "collection_videos")
    return <FileVideo className="h-8 w-8 text-on-surface-variant/50" strokeWidth={1.5} />;
  if (tab === "collection_photos")
    return <FileImage className="h-8 w-8 text-on-surface-variant/50" strokeWidth={1.5} />;
  return <FileIcon className="h-8 w-8 text-on-surface-variant/50" strokeWidth={1.5} />;
}

/**
 * Modal de envio: escolhe o arquivo e exige os metadados obrigatórios
 * (coleção, temporada, mês/ano). Só habilita "Publicar" com tudo preenchido.
 */
export function UploadModal({ open, tab, onClose, onUploaded }: UploadModalProps) {
  const toast = useToast();
  const { activeStoreId } = useStoreContext();
  const [file, setFile] = useState<{ name: string; url: string; type: string } | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [season, setSeason] = useState<ShowcaseSeason>("primavera_verao");
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Guarda o envio em andamento para poder cancelar ao fechar o modal.
  const abortRef = useRef<AbortController | null>(null);

  const reset = () => {
    setFile(null);
    setCollectionName("");
    setSeason("primavera_verao");
    setMonth(new Date().getMonth() + 1);
    setYear(CURRENT_YEAR);
    setProgress(null);
    setUploadError(null);
  };

  /** Cancela um envio em curso e limpa o formulário. */
  const handleClose = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setUploading(false);
    setProgress(null);
    setUploadError(null);
    onClose();
  };

  /**
   * Envia o arquivo para /api/upload assim que é escolhido, com barra de
   * progresso. Antes ele virava data URL e ia embutido na Server Action —
   * inviável para vídeo de coleção. A prévia usa a própria URL retornada.
   */
  const pickFile = async (f: File | undefined) => {
    if (!f) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setUploading(true);
    setUploadError(null);
    setFile(null);
    setProgress({ loaded: 0, total: f.size, percent: 0, phase: "enviando" });

    try {
      const up = await uploadFile(f, "showcase", {
        signal: controller.signal,
        onProgress: setProgress,
      });
      setFile({ name: up.fileName, url: up.url, type: up.mimeType });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao enviar o arquivo.";
      // Cancelamento é ação do usuário — não merece alarde.
      if (msg !== "Envio cancelado.") {
        setUploadError(msg);
        toast.error(msg);
      }
      setProgress(null);
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  };

  const canSubmit =
    !!file &&
    !uploading &&
    collectionName.trim().length > 0 &&
    !!month &&
    !!year;

  const submit = async () => {
    if (!canSubmit || !file) return;
    if (!activeStoreId) {
      toast.error(
        "Selecione uma loja específica no seletor para publicar mídia.",
      );
      return;
    }
    setSaving(true);
    try {
      await addShowcaseMediaAction({
        tab,
        title: file.name,
        fileUrl: file.url,
        mimeType: file.type || null,
        collectionName: collectionName.trim(),
        season,
        releaseMonth: month,
        releaseYear: year,
        storeId: activeStoreId,
      });
      toast.success("Mídia publicada na Vitrine.");
      reset();
      onUploaded();
      onClose();
    } catch {
      toast.error("Não foi possível publicar a mídia.");
    } finally {
      setSaving(false);
    }
  };

  const accept =
    tab === "collection_videos"
      ? "video/*"
      : tab === "collection_photos"
        ? "image/*"
        : undefined;

  return (
    <Modal open={open} onClose={handleClose} title="Enviar mídia">
      <div className="space-y-md">
        <div className="space-y-1.5">
          <Label>Arquivo</Label>
          <div className="flex items-center gap-md">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-container">
              {file && file.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={file.url} alt="Prévia" className="h-full w-full object-cover" />
              ) : (
                <TabIcon tab={tab} />
              )}
            </div>
            <label
              className="flex cursor-pointer items-center gap-2 rounded-full border border-primary-container px-4 py-2.5 text-label-md text-primary transition-colors hover:bg-primary-fixed/40 aria-disabled:pointer-events-none aria-disabled:opacity-60"
              aria-disabled={uploading}
            >
              <Upload className="h-4 w-4" strokeWidth={1.75} />
              {uploading
                ? "Enviando..."
                : file
                  ? "Trocar arquivo"
                  : "Escolher arquivo"}
              <input
                type="file"
                accept={accept}
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  void pickFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {file && !uploading && (
            <p className="truncate px-1 text-label-sm text-on-surface-variant">
              {file.name}
            </p>
          )}

          <UploadProgressBar
            progress={progress}
            error={uploadError}
            className="px-1 pt-1"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Nome da Coleção</Label>
          <Input
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            placeholder="Ex.: Coleção Aurora"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Temporada</Label>
          <Select
            value={season}
            onChange={(e) => setSeason(e.target.value as ShowcaseSeason)}
          >
            <option value="primavera_verao">Primavera/Verão</option>
            <option value="outono_inverno">Outono/Inverno</option>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-md">
          <div className="space-y-1.5">
            <Label>Mês de lançamento</Label>
            <Select
              value={String(month)}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ano de lançamento</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              min={2000}
              max={CURRENT_YEAR + 5}
            />
          </div>
        </div>

        <div className="flex justify-end gap-sm border-t border-outline-variant/40 pt-md">
          <Button variant="ghost" onClick={handleClose}>
            {uploading ? "Cancelar envio" : "Cancelar"}
          </Button>
          <Button onClick={submit} disabled={!canSubmit || saving}>
            {saving ? "Publicando..." : "Publicar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
