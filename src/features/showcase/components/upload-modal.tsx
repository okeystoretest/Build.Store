"use client";

import { useCallback, useRef, useState } from "react";
import {
  Upload,
  FileVideo,
  FileImage,
  File as FileIcon,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import type { ShowcaseSeason, ShowcaseTab } from "@/types/domain";
import {
  addShowcaseMediaAction,
  discardUploadedMediaAction,
} from "@/features/showcase/actions/showcase";
import { useStoreContext } from "@/features/stores/store-context";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { uploadFile, type UploadProgress } from "@/lib/utils/upload-file";
import { UploadProgressBar } from "@/components/ui/upload-progress";
import { cn } from "@/lib/utils/cn";

interface UploadModalProps {
  open: boolean;
  tab: ShowcaseTab;
  onClose: () => void;
  onUploaded: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/**
 * Regras de lote por aba. O teto existe para não deixar a lojista enfileirar
 * 40 vídeos e travar a conexão da loja no meio do expediente.
 */
const REGRAS: Record<
  ShowcaseTab,
  { max: number; accept: string; rotulo: string; descricaoLabel: string }
> = {
  workshop: {
    max: 5,
    accept: "video/*",
    rotulo: "vídeo",
    descricaoLabel: "Descrição",
  },
  collection_videos: {
    max: 15,
    accept: "video/*",
    rotulo: "vídeo",
    descricaoLabel: "Descrição",
  },
  collection_photos: {
    max: 5,
    accept: "image/*",
    rotulo: "foto",
    descricaoLabel: "Legenda",
  },
};

/**
 * Quantos arquivos sobem ao mesmo tempo. Três é o meio-termo: aproveita a
 * banda sem estrangular a conexão da loja nem estourar memória do servidor
 * com vários vídeos grandes simultâneos. O resto fica na fila.
 */
const CONCORRENCIA = 3;

type ItemStatus = "enviando" | "pronto" | "erro";

interface Item {
  /** id local, só para o React — não é o id da mídia. */
  id: string;
  fileName: string;
  /** Descrição personalizada. Começa VAZIA por especificação. */
  description: string;
  status: ItemStatus;
  progress: UploadProgress | null;
  /** URL definitiva, quando o envio conclui. */
  url?: string;
  mimeType?: string;
  error?: string;
  controller: AbortController;
}

function TabIcon({ tab }: { tab: ShowcaseTab }) {
  if (tab === "collection_photos")
    return <FileImage className="h-5 w-5 text-on-surface-variant/50" strokeWidth={1.5} />;
  if (tab === "workshop" || tab === "collection_videos")
    return <FileVideo className="h-5 w-5 text-on-surface-variant/50" strokeWidth={1.5} />;
  return <FileIcon className="h-5 w-5 text-on-surface-variant/50" strokeWidth={1.5} />;
}

let contador = 0;
const novoId = () => `item-${++contador}`;

/**
 * Modal de envio da Vitrine — LOTE.
 *
 * Cada arquivo tem a própria barra de progresso e o próprio campo de descrição
 * (vazio por padrão), que substitui o nome do arquivo como título da mídia.
 * Os metadados da coleção (nome, temporada, mês/ano) valem para o lote inteiro,
 * já que um lote é sempre de uma mesma coleção.
 *
 * Os arquivos sobem assim que são escolhidos, em paralelo limitado; "Publicar"
 * só grava as linhas no banco. Assim a lojista preenche as descrições enquanto
 * os vídeos ainda estão subindo, em vez de esperar parada.
 */
export function UploadModal({ open, tab, onClose, onUploaded }: UploadModalProps) {
  const toast = useToast();
  const { activeStoreId } = useStoreContext();
  const regra = REGRAS[tab];

  const [items, setItems] = useState<Item[]>([]);
  const [collectionName, setCollectionName] = useState("");
  const [season, setSeason] = useState<ShowcaseSeason>("primavera_verao");
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [saving, setSaving] = useState(false);

  // Espelho do estado para uso dentro de callbacks assíncronas sem depender de
  // closure velha (o upload dura mais que um render).
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  const patchItem = useCallback((id: string, patch: Partial<Item>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  }, []);

  const reset = () => {
    setItems([]);
    setCollectionName("");
    setSeason("primavera_verao");
    setMonth(new Date().getMonth() + 1);
    setYear(CURRENT_YEAR);
  };

  /** Envia um arquivo e reflete o progresso no item correspondente. */
  const enviar = useCallback(
    async (item: Item, file: File) => {
      try {
        const up = await uploadFile(file, "showcase", {
          signal: item.controller.signal,
          onProgress: (p) => patchItem(item.id, { progress: p }),
        });
        patchItem(item.id, {
          status: "pronto",
          url: up.url,
          mimeType: up.mimeType,
          progress: { loaded: file.size, total: file.size, percent: 100, phase: "processando" },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha no envio.";
        patchItem(item.id, { status: "erro", error: msg, progress: null });
      }
    },
    [patchItem],
  );

  /** Seleção: valida o teto da aba e dispara os envios com concorrência limitada. */
  const pickFiles = async (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;

    const escolhidos = Array.from(lista);
    const espacoLivre = regra.max - itemsRef.current.length;

    if (espacoLivre <= 0) {
      toast.error(`Limite de ${regra.max} ${regra.rotulo}s por envio.`);
      return;
    }
    if (escolhidos.length > espacoLivre) {
      toast.error(
        `Só cabem mais ${espacoLivre} ${regra.rotulo}${espacoLivre > 1 ? "s" : ""} neste envio. O excedente foi ignorado.`,
      );
    }

    const aceitos = escolhidos.slice(0, espacoLivre);

    const novos: Item[] = aceitos.map((f) => ({
      id: novoId(),
      fileName: f.name,
      description: "",
      status: "enviando",
      progress: { loaded: 0, total: f.size, percent: 0, phase: "enviando" },
      controller: new AbortController(),
    }));

    setItems((prev) => [...prev, ...novos]);

    // Fila com concorrência limitada.
    let cursor = 0;
    const trabalhador = async () => {
      while (cursor < novos.length) {
        const i = cursor++;
        await enviar(novos[i], aceitos[i]);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCORRENCIA, novos.length) }, trabalhador),
    );
  };

  /** Remove um item: cancela o envio em curso e apaga o arquivo já gravado. */
  const removerItem = (item: Item) => {
    item.controller.abort();
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    if (item.url) void discardUploadedMediaAction(item.url);
  };

  const handleClose = () => {
    // Nada publicado: cancela o que está subindo e limpa os arquivos órfãos.
    for (const it of itemsRef.current) {
      it.controller.abort();
      if (it.url) void discardUploadedMediaAction(it.url);
    }
    reset();
    onClose();
  };

  const prontos = items.filter((i) => i.status === "pronto");
  const enviando = items.some((i) => i.status === "enviando");

  const canSubmit =
    prontos.length > 0 &&
    !enviando &&
    !saving &&
    collectionName.trim().length > 0 &&
    !!month &&
    !!year;

  const submit = async () => {
    if (!canSubmit) return;
    if (!activeStoreId) {
      toast.error("Selecione uma loja específica no seletor para publicar mídia.");
      return;
    }

    setSaving(true);
    let publicados = 0;
    const falhas: string[] = [];

    for (const item of prontos) {
      try {
        await addShowcaseMediaAction({
          tab,
          // Descrição vazia cai no nome do arquivo: melhor um título feio do
          // que um card sem identificação nenhuma na grade.
          title: item.description.trim() || item.fileName,
          fileUrl: item.url!,
          mimeType: item.mimeType ?? null,
          collectionName: collectionName.trim(),
          season,
          releaseMonth: month,
          releaseYear: year,
          storeId: activeStoreId,
        });
        publicados++;
      } catch {
        falhas.push(item.description.trim() || item.fileName);
      }
    }

    setSaving(false);

    if (publicados > 0) {
      toast.success(
        publicados === 1
          ? "Mídia publicada na Vitrine."
          : `${publicados} mídias publicadas na Vitrine.`,
      );
      onUploaded();
    }
    if (falhas.length > 0) {
      toast.error(
        `Não foi possível publicar: ${falhas.slice(0, 3).join(", ")}${falhas.length > 3 ? "..." : ""}`,
      );
      return; // mantém o modal aberto para nova tentativa
    }

    reset();
    onClose();
  };

  const restantes = regra.max - items.length;

  return (
    <Modal open={open} onClose={handleClose} title="Enviar mídia">
      <div className="space-y-md">
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <Label>Arquivos</Label>
            <span className="text-label-sm text-on-surface-variant">
              {items.length} de {regra.max}
            </span>
          </div>

          <label
            className={cn(
              "flex w-max cursor-pointer items-center gap-2 rounded-full border border-primary-container px-4 py-2.5 text-label-md text-primary transition-colors hover:bg-primary-fixed/40",
              restantes <= 0 && "pointer-events-none opacity-50",
            )}
            aria-disabled={restantes <= 0}
          >
            <Upload className="h-4 w-4" strokeWidth={1.75} />
            {items.length === 0
              ? `Escolher ${regra.rotulo}s`
              : `Adicionar mais (${restantes})`}
            <input
              type="file"
              multiple
              accept={regra.accept}
              className="hidden"
              disabled={restantes <= 0}
              onChange={(e) => {
                void pickFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          <p className="px-1 text-label-sm text-on-surface-variant">
            Até {regra.max} {regra.rotulo}s por envio. Deixe a{" "}
            {regra.descricaoLabel.toLowerCase()} em branco para usar o nome do
            arquivo.
          </p>
        </div>

        {items.length > 0 && (
          <ul className="max-h-72 space-y-sm overflow-y-auto pr-1">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex gap-3 rounded-md bg-surface-container-low p-sm"
              >
                <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-container">
                  {item.status === "pronto" &&
                  (item.mimeType ?? "").startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  ) : item.status === "erro" ? (
                    <AlertCircle className="h-5 w-5 text-error" strokeWidth={1.75} />
                  ) : item.status === "pronto" ? (
                    <Check className="h-5 w-5 text-primary" strokeWidth={2} />
                  ) : (
                    <TabIcon tab={tab} />
                  )}
                </span>

                <div className="min-w-0 flex-1 space-y-1">
                  <Input
                    value={item.description}
                    onChange={(e) =>
                      patchItem(item.id, { description: e.target.value })
                    }
                    placeholder={`${regra.descricaoLabel} (opcional)`}
                    aria-label={`${regra.descricaoLabel} de ${item.fileName}`}
                    className="h-9"
                  />
                  <p className="truncate px-1 text-label-sm text-on-surface-variant">
                    {item.fileName}
                  </p>
                  {item.status !== "pronto" && (
                    <UploadProgressBar
                      progress={item.progress}
                      error={item.error}
                      className="px-1"
                    />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removerItem(item)}
                  aria-label={`Remover ${item.fileName}`}
                  title="Remover"
                  className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}

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

        <div className="flex items-center justify-end gap-sm border-t border-outline-variant/40 pt-md">
          {enviando && (
            <span className="mr-auto text-label-sm text-on-surface-variant">
              Aguarde o fim dos envios para publicar.
            </span>
          )}
          <Button variant="ghost" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {saving
              ? "Publicando..."
              : prontos.length > 1
                ? `Publicar ${prontos.length}`
                : "Publicar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
