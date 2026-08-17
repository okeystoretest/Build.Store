"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  FileVideo,
  FileImage,
  File as FileIcon,
  X,
  Check,
  AlertCircle,
  Clock,
  RotateCcw,
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
 * Regras de lote por aba.
 *
 * Os tetos são assimétricos de propósito, porque o custo de um arquivo é
 * assimétrico: uma foto de coleção tem alguns MB, um vídeo tem centenas. Quinze
 * fotos cabem no envio de uma coleção inteira sem esforço; quinze vídeos são
 * gigabytes atravessando a conexão da loja no meio do expediente — foi
 * exatamente esse lote que vinha derrubando o envio em 502.
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
    max: 5,
    accept: "video/*",
    rotulo: "vídeo",
    descricaoLabel: "Descrição",
  },
  collection_photos: {
    max: 15,
    accept: "image/*",
    rotulo: "foto",
    descricaoLabel: "Legenda",
  },
};

type ItemStatus = "aguardando" | "enviando" | "pronto" | "erro";

interface Item {
  /** id local, só para o React — não é o id da mídia. */
  id: string;
  /** Mantido para poder repetir o envio sem o usuário reescolher o arquivo. */
  file: File;
  fileName: string;
  /** `blob:` local, para pré-visualizar a foto antes mesmo de ela subir. */
  previewUrl?: string;
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
    return <FileImage className="h-6 w-6 text-on-surface-variant/50" strokeWidth={1.5} />;
  if (tab === "workshop" || tab === "collection_videos")
    return <FileVideo className="h-6 w-6 text-on-surface-variant/50" strokeWidth={1.5} />;
  return <FileIcon className="h-6 w-6 text-on-surface-variant/50" strokeWidth={1.5} />;
}

let contador = 0;
const novoId = () => `item-${++contador}`;

/**
 * Modal de envio da Vitrine — LOTE, um arquivo de cada vez.
 *
 * Cada arquivo tem a própria pré-visualização, barra de progresso e campo de
 * descrição (vazio por padrão), que substitui o nome do arquivo como título da
 * mídia. Os metadados da coleção (nome, temporada, mês/ano) valem para o lote
 * inteiro, já que um lote é sempre de uma mesma coleção.
 *
 * ## Envio serial
 *
 * Os arquivos sobem assim que são escolhidos, mas **em fila: um termina, o
 * próximo começa**. A versão anterior mandava três de uma vez, e três vídeos de
 * coleção subindo em paralelo é o cenário que estourava o servidor — o
 * navegador ainda reportava `Falha ao enviar o arquivo` em cima de um 502 do
 * proxy, com os três perdidos de uma vez.
 *
 * A fila é ÚNICA e vive num ref, não por chamada de `pickFiles`. Se fosse por
 * chamada, clicar em "Adicionar mais" no meio de um envio abriria uma segunda
 * fila em paralelo — o problema de volta, só que mais difícil de enxergar.
 *
 * "Publicar" só grava as linhas no banco. Assim a lojista preenche as
 * descrições enquanto os arquivos ainda estão subindo, em vez de esperar parada.
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

  /**
   * Rabo da fila de envios. Cada arquivo se encadeia no anterior, então nunca
   * há dois uploads no ar ao mesmo tempo — independentemente de quantas vezes
   * o usuário escolha arquivos ou peça uma nova tentativa.
   */
  const filaRef = useRef<Promise<void>>(Promise.resolve());

  const patchItem = useCallback((id: string, patch: Partial<Item>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  }, []);

  /** Envia um arquivo e reflete o progresso no item correspondente. */
  const enviar = useCallback(
    async (item: Item) => {
      // Removido (ou modal fechado) enquanto esperava a vez: não gasta banda.
      if (item.controller.signal.aborted) return;

      patchItem(item.id, {
        status: "enviando",
        error: undefined,
        progress: {
          loaded: 0,
          total: item.file.size,
          percent: 0,
          phase: "enviando",
        },
      });

      try {
        const up = await uploadFile(item.file, "showcase", {
          signal: item.controller.signal,
          onProgress: (p) => patchItem(item.id, { progress: p }),
        });
        patchItem(item.id, {
          status: "pronto",
          url: up.url,
          mimeType: up.mimeType,
          progress: {
            loaded: item.file.size,
            total: item.file.size,
            percent: 100,
            phase: "processando",
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha no envio.";
        patchItem(item.id, { status: "erro", error: msg, progress: null });
      }
    },
    [patchItem],
  );

  /** Encadeia uma tarefa no fim da fila. Uma falha não pode parar as seguintes. */
  const enfileirar = useCallback((tarefa: () => Promise<void>) => {
    filaRef.current = filaRef.current.then(tarefa).catch(() => {});
  }, []);

  /** Libera o `blob:` da pré-visualização — senão o arquivo fica preso na memória. */
  const soltarPreview = (item: Item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  };

  const reset = useCallback(() => {
    setItems([]);
    setCollectionName("");
    setSeason("primavera_verao");
    setMonth(new Date().getMonth() + 1);
    setYear(CURRENT_YEAR);
  }, []);

  // Desmontagem inesperada (troca de aba, navegação): não deixa `blob:` para trás.
  useEffect(() => {
    return () => {
      for (const it of itemsRef.current) soltarPreview(it);
    };
  }, []);

  /** Seleção: valida o teto da aba e enfileira os envios, um a um. */
  const pickFiles = (lista: FileList | null) => {
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
      file: f,
      fileName: f.name,
      previewUrl: f.type.startsWith("image/")
        ? URL.createObjectURL(f)
        : undefined,
      description: "",
      status: "aguardando",
      progress: null,
      controller: new AbortController(),
    }));

    setItems((prev) => [...prev, ...novos]);
    for (const item of novos) enfileirar(() => enviar(item));
  };

  /** Reenfileira um arquivo que falhou, sem obrigar a reescolher no disco. */
  const tentarNovamente = (item: Item) => {
    // Controller novo: o antigo pode ter sido abortado, e um AbortSignal já
    // disparado recusaria o envio na hora.
    const renovado: Item = {
      ...item,
      controller: new AbortController(),
      status: "aguardando",
      error: undefined,
      progress: null,
    };
    setItems((prev) => prev.map((it) => (it.id === item.id ? renovado : it)));
    enfileirar(() => enviar(renovado));
  };

  /** Remove um item: cancela o envio em curso e apaga o arquivo já gravado. */
  const removerItem = (item: Item) => {
    item.controller.abort();
    soltarPreview(item);
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    if (item.url) void discardUploadedMediaAction(item.url);
  };

  const handleClose = () => {
    // Nada publicado: cancela o que está subindo e limpa os arquivos órfãos.
    for (const it of itemsRef.current) {
      it.controller.abort();
      soltarPreview(it);
      if (it.url) void discardUploadedMediaAction(it.url);
    }
    reset();
    onClose();
  };

  const prontos = items.filter((i) => i.status === "pronto");
  const naFila = items.filter(
    (i) => i.status === "enviando" || i.status === "aguardando",
  );
  const emAndamento = naFila.length > 0;

  const canSubmit =
    prontos.length > 0 &&
    !emAndamento &&
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

    for (const it of itemsRef.current) soltarPreview(it);
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
                pickFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          <p className="px-1 text-label-sm text-on-surface-variant">
            Até {regra.max} {regra.rotulo}s por envio, enviados{" "}
            <strong className="font-medium">um de cada vez</strong>. Deixe a{" "}
            {regra.descricaoLabel.toLowerCase()} em branco para usar o nome do
            arquivo.
          </p>
        </div>

        {items.length > 0 && (
          <ul className="max-h-80 space-y-sm overflow-y-auto pr-1">
            {items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "flex gap-3 rounded-md p-sm transition-colors",
                  item.status === "erro"
                    ? "bg-error-container/40"
                    : "bg-surface-container-low",
                )}
              >
                {/*
                  Miniatura grande e real. Antes era um quadrado de 36px que só
                  ganhava a imagem DEPOIS do upload terminar — quem enviava
                  quinze fotos de uma coleção não conseguia distinguir uma da
                  outra na hora de escrever as legendas. O `blob:` local mostra
                  a foto no instante da escolha, sem esperar rede nenhuma.
                */}
                <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-container">
                  {item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.previewUrl}
                      alt={`Prévia de ${item.fileName}`}
                      className="h-full w-full object-cover"
                    />
                  ) : item.status === "pronto" &&
                    (item.mimeType ?? "").startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <TabIcon tab={tab} />
                  )}

                  {/* Selo de estado por cima da prévia. */}
                  {item.status !== "enviando" && (
                    <span
                      className={cn(
                        "absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full",
                        item.status === "pronto" && "bg-primary text-on-primary",
                        item.status === "erro" && "bg-error text-on-error",
                        item.status === "aguardando" &&
                          "bg-surface/90 text-on-surface-variant",
                      )}
                    >
                      {item.status === "pronto" ? (
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      ) : item.status === "erro" ? (
                        <AlertCircle className="h-3.5 w-3.5" strokeWidth={2.5} />
                      ) : (
                        <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                      )}
                    </span>
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

                  {item.status === "aguardando" && (
                    <p className="px-1 text-label-sm text-on-surface-variant">
                      Na fila — começa quando o anterior terminar.
                    </p>
                  )}

                  {item.status === "enviando" && (
                    <UploadProgressBar progress={item.progress} className="px-1" />
                  )}

                  {item.status === "erro" && (
                    <div className="flex flex-wrap items-center gap-2 px-1">
                      <p className="text-label-sm text-error" role="alert">
                        {item.error}
                      </p>
                      <button
                        type="button"
                        onClick={() => tentarNovamente(item)}
                        className="flex items-center gap-1 rounded-full border border-primary-container px-2.5 py-1 text-label-sm text-primary transition-colors hover:bg-primary-fixed/40"
                      >
                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                        Tentar de novo
                      </button>
                    </div>
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
          {emAndamento && (
            <span className="mr-auto text-label-sm text-on-surface-variant">
              {naFila.length === 1
                ? "Enviando 1 arquivo..."
                : `Enviando — faltam ${naFila.length} arquivos na fila.`}
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
