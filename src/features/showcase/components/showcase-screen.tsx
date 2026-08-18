"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Store,
  Video,
  ImageIcon,
  Play,
  Maximize2,
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
import { cn } from "@/lib/utils/cn";
import { MediaImage } from "@/components/ui/media-image";
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

  // Fotos ganham a grade de galeria; vídeos seguem no card compacto, que é o
  // formato certo para um conteúdo que só se entende ao ser reproduzido.
  const galeria = tab === "collection_photos";

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
          <div
            className={cn(
              "grid gap-md",
              galeria
                ? // Menos colunas que os vídeos, de propósito: a foto de coleção
                  // é o produto, e um card de 128px de altura mostrava um
                  // recorte pequeno demais para escolher a peça pelo olho.
                  "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5",
            )}
          >
            {sc.media.map((m, i) =>
              galeria ? (
                <PhotoCard
                  key={m.id}
                  media={m}
                  onOpen={() => setViewerIndex(i)}
                  onDelete={canUploadShowcase ? () => handleDelete(m) : null}
                />
              ) : (
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
              ),
            )}
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

/**
 * Card de FOTO da coleção.
 *
 * ## O que estava pesado
 *
 * O card anterior empilhava, por item: um `<img>` em tamanho de card, um
 * gradiente preto cobrindo o rodapé, uma camada de `hover:bg-black/25` sobre a
 * área inteira, `shadow-level-1` (sombra de 20px de desfoque), `transition-all`
 * e um `scale(1.05)` na imagem no hover. Cada um desses é barato sozinho;
 * juntos, e multiplicados por quinze cards, o navegador repinta a tela toda a
 * cada movimento do mouse — daí a sensação de travamento, mesmo já com as
 * miniaturas de 480px.
 *
 * Aqui: sombra virou borda (não desfoca), o zoom saiu, `transition-all` virou
 * transição só do que muda, e o gradiente preto deu lugar a uma faixa de
 * legenda sólida. `content-visibility: auto` (classe `.card-galeria`) fecha a
 * conta: o navegador nem calcula o layout dos cards que estão fora da tela.
 *
 * ## Por que ficou mais feminino
 *
 * O gradiente preto era o elemento fora do tom: preto puro sobre uma paleta de
 * rosas, e o texto branco por cima puxava o card para um vocabulário de app de
 * streaming. A foto agora é emoldurada — respiro de 4px em `primary-fixed`,
 * como um passe-partout — e a legenda vem embaixo, em rosa sobre superfície
 * clara, igual ao resto da plataforma. A estação vira uma pílula discreta em
 * vez de mais uma linha de texto cinza.
 *
 * Os tons vêm de `primary-container` (e não de `primary-fixed`) porque
 * `primary-fixed` é o MESMO rosa claro nos dois temas: no escuro ele viraria
 * uma moldura fluorescente em volta de cada foto. `primary-container` escurece
 * junto com o tema.
 */
function PhotoCard({
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
    <div className="card-galeria hover-lift group flex flex-col overflow-hidden rounded-md border border-primary-container/60 bg-surface-container-lowest transition-colors hover:border-primary-container">
      {/* Passe-partout: o respiro rosa em volta da foto é o que dá o ar de
          álbum em vez de grade de arquivos. */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[1.25rem] bg-primary-container/30 p-1">
        <div className="h-full w-full overflow-hidden rounded-[1rem] bg-surface-container">
          <Thumb media={media} isImage={isImage} isVideo={isVideo} />
        </div>

        {/* Abre o visualizador interno — sem nova aba nem sair do app. */}
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Abrir ${media.title}`}
          className="absolute inset-0 flex items-center justify-center rounded-[1.25rem] transition-colors hover:bg-primary/15 focus-visible:bg-primary/15"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface/95 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <Maximize2 className="h-5 w-5" strokeWidth={2} />
          </span>
        </button>

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Remover mídia"
            title="Remover"
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-surface/95 text-on-surface-variant opacity-0 transition-opacity hover:bg-error-container hover:text-on-error-container focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Legenda sólida, na tipografia e nas cores do resto da plataforma. */}
      <div className="flex flex-col gap-1 px-sm pb-sm pt-2">
        <p className="line-clamp-1 text-label-md font-medium text-on-surface">
          {media.title}
        </p>
        <p className="line-clamp-1 text-label-sm text-primary">
          {media.collectionName}
        </p>
        <span className="w-fit rounded-full bg-primary-container/30 px-2 py-0.5 text-label-sm text-on-primary-container">
          {SEASON_LABEL[media.season]} ·{" "}
          {MONTHS_SHORT[(media.releaseMonth - 1 + 12) % 12]}/{media.releaseYear}
        </span>
      </div>
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
    <div className="hover-lift group flex flex-col overflow-hidden rounded-md bg-surface-container-lowest shadow-level-1">
      <div className="relative flex h-32 w-full items-center justify-center overflow-hidden bg-surface-container">
        <Thumb media={media} isImage={isImage} isVideo={isVideo} />

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

/**
 * Miniatura do card — só carrega o arquivo quando o card chega perto da tela.
 *
 * O problema anterior: a grade montava um `<img>` e, pior, um `<video>` por
 * card assim que a aba abria. O `<video>` sem `preload` definido faz o Chrome
 * baixar o arquivo inteiro para pintar o primeiro frame — quinze vídeos de
 * coleção davam alguns GB de download só para desenhar miniaturas.
 *
 * Agora: IntersectionObserver segura a montagem até 300px antes de entrar na
 * viewport, imagem usa `loading="lazy"`, e o vídeo pede `preload="metadata"`
 * com o fragmento `#t=0.1` — com o Range da rota de mídia, isso baixa só o
 * cabeçalho e o pedaço do primeiro frame em vez do arquivo todo.
 */
function Thumb({
  media,
  isImage,
  isVideo,
  mediaClassName,
}: {
  media: ShowcaseMedia;
  isImage: boolean;
  isVideo: boolean;
  /** Classes extras no `<img>`/`<video>` (ex.: o zoom sutil da galeria). */
  mediaClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visivel) return;

    // Navegador sem suporte (ou ambiente de teste): mostra tudo de uma vez.
    if (typeof IntersectionObserver === "undefined") {
      setVisivel(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisivel(true);
          obs.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visivel]);

  return (
    <div ref={ref} className="h-full w-full">
      {!visivel ? (
        <div className="h-full w-full animate-pulse bg-surface-container-high/40" />
      ) : isImage ? (
        // `thumb`: a grade mostra 480px; o original de 4000px só é baixado ao
        // abrir a foto no visualizador.
        <MediaImage
          src={media.fileUrl}
          alt={media.title}
          variant="thumb"
          className={mediaClassName}
        />
      ) : isVideo ? (
        <video
          src={`${media.fileUrl}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          className={cn("h-full w-full object-cover", mediaClassName)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <FileVideo className="h-8 w-8 text-on-surface-variant/40" strokeWidth={1.5} />
        </div>
      )}
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
