"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Store,
  Video,
  ImageIcon,
  Play,
  Trash2,
  FileVideo,
} from "lucide-react";
import type { ShowcaseMedia, ShowcaseSeason, ShowcaseTab } from "@/types/domain";
import { useShowcase } from "@/features/showcase/hooks/use-showcase";
import { useAuth } from "@/hooks/use-auth";
import { deleteShowcaseMediaAction } from "@/features/showcase/actions/showcase";
import { queryKeys } from "@/lib/db/query-keys";
import { useToast } from "@/components/ui/toast";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LoadingArea } from "@/components/ui/spinner";
import { UploadModal } from "./upload-modal";
import { MediaViewer } from "./media-viewer";

const SEASON_LABEL: Record<ShowcaseSeason, string> = {
  primavera_verao: "Primavera/Verão",
  outono_inverno: "Outono/Inverno",
};

const MONTHS_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/**
 * Vitrine — distribuição de mídia por coleção com três abas:
 * Workshop, Vídeos da Coleção e Fotos da Coleção. Cada aba envia arquivos
 * (metadados obrigatórios no modal), filtra por coleção e lista os conteúdos
 * em ordem alfanumérica pelo padrão de nomenclatura (título ou nome do
 * arquivo). Mídias com mais de 90 dias são removidas pela rotina
 * agendada (/api/showcase/cleanup) e nunca aparecem aqui.
 */
export function ShowcaseScreen() {
  const [tab, setTab] = useState<ShowcaseTab>("workshop");
  const [uploadOpen, setUploadOpen] = useState(false);
  // Índice da mídia aberta no visualizador; null = fechado.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const sc = useShowcase(tab);
  const { canUploadShowcase } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.showcase });

  const handleDelete = async (m: ShowcaseMedia) => {
    await deleteShowcaseMediaAction(m.id);
    refresh();
    toast.success("Mídia removida.");
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-outline-variant/50 px-margin py-md">
        <h1 className="font-logo text-headline-lg-mobile text-primary sm:text-headline-lg">
          Vitrine
        </h1>
        <div className="ml-auto">
          <ToggleGroup
            aria-label="Aba da vitrine"
            value={tab}
            onChange={setTab}
            options={[
              { value: "workshop", label: "Workshop", icon: <Store className="h-4 w-4" strokeWidth={1.75} /> },
              { value: "collection_videos", label: "Vídeos da Coleção", icon: <Video className="h-4 w-4" strokeWidth={1.75} /> },
              { value: "collection_photos", label: "Fotos da Coleção", icon: <ImageIcon className="h-4 w-4" strokeWidth={1.75} /> },
            ]}
          />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-md border-b border-outline-variant/50 px-margin py-sm">
        <div className="min-w-[12rem] flex-1 sm:max-w-xs">
          <Select
            aria-label="Filtrar por coleção"
            value={sc.collection}
            onChange={(e) => sc.setCollection(e.target.value)}
            className="h-11"
          >
            <option value={sc.allValue}>Todas as coleções</option>
            {sc.collections.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        {canUploadShowcase && (
          <Button size="lg" onClick={() => setUploadOpen(true)} className="shrink-0">
            <Upload className="h-5 w-5" strokeWidth={2} />
            Enviar arquivo
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-margin py-md">
        {sc.loading ? (
          <LoadingArea label="Carregando vitrine..." />
        ) : sc.media.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {sc.media.map((m, i) => (
              <MediaCard
                key={m.id}
                media={m}
                onOpen={() => setViewerIndex(i)}
                // Excluir mídia segue restrito a quem pode publicar. A Vitrine
                // passou a ser visível para a vendedora (requisito 2); sem esta
                // linha, ela veria o botão de lixeira em cima do material da
                // coleção.
                onDelete={canUploadShowcase ? () => handleDelete(m) : null}
              />
            ))}
          </div>
        )}
      </div>

      <UploadModal
        open={uploadOpen}
        tab={tab}
        onClose={() => setUploadOpen(false)}
        onUploaded={refresh}
      />

      <MediaViewer
        media={viewerIndex !== null ? (sc.media[viewerIndex] ?? null) : null}
        onClose={() => setViewerIndex(null)}
        hasPrev={viewerIndex !== null && viewerIndex > 0}
        hasNext={viewerIndex !== null && viewerIndex < sc.media.length - 1}
        onPrev={() => setViewerIndex((i) => (i === null ? null : Math.max(0, i - 1)))}
        onNext={() =>
          setViewerIndex((i) =>
            i === null ? null : Math.min(sc.media.length - 1, i + 1),
          )
        }
      />
    </div>
  );
}

function MediaCard({
  media,
  onOpen,
  onDelete,
}: {
  media: ShowcaseMedia;
  onOpen: () => void;
  /** null = usuário sem permissão para excluir; o botão nem é renderizado. */
  onDelete: (() => void) | null;
}) {
  const isImage = (media.mimeType ?? "").startsWith("image/");
  const isVideo = (media.mimeType ?? "").startsWith("video/");

  return (
    <div className="group flex flex-col overflow-hidden rounded-md bg-surface-container-lowest shadow-level-1">
      <div className="relative flex h-32 w-full items-center justify-center overflow-hidden bg-surface-container">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.fileUrl} alt={media.title} className="h-full w-full object-cover" />
        ) : isVideo ? (
          <video src={media.fileUrl} className="h-full w-full object-cover" />
        ) : (
          <FileVideo className="h-8 w-8 text-on-surface-variant/40" strokeWidth={1.5} />
        )}

        {/* Abre o visualizador interno — sem nova aba nem sair do app. */}
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Abrir ${media.title}`}
          className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all hover:bg-black/30 hover:opacity-100 focus-visible:bg-black/30 focus-visible:opacity-100 group-hover:bg-black/30 group-hover:opacity-100"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface/90 text-primary">
            <Play className="h-5 w-5" strokeWidth={2} />
          </span>
        </button>

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Remover mídia"
            title="Remover"
            className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-on-surface-variant opacity-0 transition-all hover:bg-error-container hover:text-on-error-container group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div className="p-sm">
        <p className="line-clamp-1 text-label-md text-on-surface">{media.title}</p>
        <p className="mt-0.5 line-clamp-1 text-label-sm text-primary">
          {media.collectionName}
        </p>
        <p className="mt-0.5 text-label-sm text-on-surface-variant">
          {SEASON_LABEL[media.season]} ·{" "}
          {MONTHS_SHORT[(media.releaseMonth - 1 + 12) % 12]}/{media.releaseYear}
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-xl flex flex-col items-center justify-center gap-3 py-xl text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
        <Store className="h-7 w-7 text-on-surface-variant/60" strokeWidth={1.5} />
      </div>
      <p className="text-body-md text-on-surface-variant">
        Nenhuma mídia nesta aba ainda.
      </p>
    </div>
  );
}
