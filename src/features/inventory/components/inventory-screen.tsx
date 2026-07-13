"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Search, Plus, Package, AlertTriangle, Cloud, LayoutGrid, List, Trash2 } from "lucide-react";
import type { Product } from "@/types/domain";
import { useInventory } from "@/features/inventory/hooks/use-inventory";
import { upsertProduct, deleteProduct } from "@/lib/db/product-repository";
import { useToast } from "@/components/ui/toast";
import { notifyProductAdded } from "@/lib/db/notification-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { useAuth } from "@/hooks/use-auth";
import { ProductCard, ProductRow } from "./product-card";
import { ProductForm } from "./product-form";
import { ProductDetail } from "./product-detail";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { LoadingArea } from "@/components/ui/spinner";

/**
 * Estoque screen. Search + Grid/List toggle + product list. Category removed.
 * Somente Admin pode adicionar, editar ou excluir produtos. Lojista e Vendedora
 * apenas visualizam o produto (imagem, ref, nome, preço e grade). Adicionar um
 * produto como Admin emite uma notificação (Ref/Nome/Quantidade).
 */
export function InventoryScreen() {
  const inv = useInventory();
  const toast = useToast();
  const queryClient = useQueryClient();
  // Apenas Admin gerencia o estoque (adicionar/editar/excluir).
  const { canAddProducts } = useAuth();
  const canManage = canAddProducts;
  const [editing, setEditing] = useState<Product | null>(null);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const closeModal = () => {
    setEditing(null);
    setViewing(null);
    setCreating(false);
  };

  // Clique no produto: Admin edita; demais perfis abrem a visualização.
  const handleProductClick = (product: Product) => {
    if (canManage) setEditing(product);
    else setViewing(product);
  };

  const handleDelete = async (product: Product) => {
    if (!canManage) return;
    await deleteProduct(product.id);
    await queryClient.invalidateQueries({ queryKey: queryKeys.products });
    toast.success("Produto removido do estoque.");
    closeModal();
  };

  const handleSubmit = async (values: Partial<Product>) => {
    const now = new Date().toISOString();
    const isNew = !editing;
    const product: Product = {
      id: editing?.id ?? crypto.randomUUID(),
      sku: values.sku!,
      barcode: values.barcode ?? null,
      name: values.name!,
      description: editing?.description ?? null,
      category: values.category ?? "outros",
      costCents: values.costCents ?? 0,
      priceCents: values.priceCents ?? 0,
      unit: "unidade",
      stock: values.stock ?? 0,
      lowStockThreshold: values.lowStockThreshold ?? 5,
      color: values.color ?? editing?.color ?? null,
      size: values.size ?? editing?.size ?? null,
      grade: values.grade ?? editing?.grade ?? [],
      imageUrl: values.imageUrl ?? editing?.imageUrl ?? null,
      active: true,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    };
    await upsertProduct(product);
    // A new product added by an Admin notifies the other users.
    if (isNew && canAddProducts) {
      await notifyProductAdded(product);
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.products });
    toast.success(isNew ? "Produto cadastrado." : "Produto atualizado.");
    closeModal();
  };

  if (inv.loading) {
    return (
      <div className="h-full px-margin py-md">
        <LoadingArea label="Carregando estoque..." />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-outline-variant/50 px-margin py-md sm:gap-md">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant sm:left-5" strokeWidth={1.75} />
          <input
            value={inv.query}
            onChange={(e) => inv.setQuery(e.target.value)}
            placeholder="Pesquisar produtos ou referência..."
            aria-label="Pesquisar produtos"
            className="h-12 w-full rounded-full border border-outline-variant bg-surface pl-12 pr-12 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary-container focus:outline-none sm:h-14 sm:pl-14 sm:pr-14"
          />
          {inv.query.length > 0 && (
            <button
              type="button"
              onClick={() => inv.setQuery("")}
              aria-label="Limpar busca"
              title="Limpar busca"
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface sm:right-4"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </div>

        <div className="hidden items-center gap-2 rounded-full bg-surface-container px-4 py-2 text-label-sm font-semibold text-on-surface-variant lg:flex">
          <Cloud className="h-4 w-4" strokeWidth={1.75} />
          Cloud Sync
        </div>

        {canManage && (
          <Button size="lg" onClick={() => setCreating(true)} className="shrink-0">
            <Plus className="h-5 w-5" strokeWidth={2} />
            <span className="hidden sm:inline">Adicionar Novo Produto</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-margin py-md">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <div>
            <h1 className="font-logo text-headline-lg-mobile text-primary sm:text-headline-lg">Gestão de Estoque</h1>
            <div className="mt-2 flex items-center gap-md">
              <span className="flex items-center gap-2 text-label-md text-on-surface-variant">
                <Package className="h-4 w-4" strokeWidth={1.75} />
                {inv.stats.total.toLocaleString("pt-BR")} itens totais
              </span>
              {inv.stats.lowStock > 0 && (
                <span className="flex items-center gap-2 text-label-md font-semibold text-error">
                  <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
                  {inv.stats.lowStock} com estoque baixo
                </span>
              )}
            </div>
          </div>

          <ToggleGroup
            aria-label="Modo de exibição"
            value={inv.view}
            onChange={inv.setView}
            options={[
              { value: "grid", label: "Grid", icon: <LayoutGrid className="h-4 w-4" strokeWidth={1.75} /> },
              { value: "list", label: "Lista", icon: <List className="h-4 w-4" strokeWidth={1.75} /> },
            ]}
          />
        </div>

        {inv.products.length === 0 ? (
          <EmptyState />
        ) : inv.view === "grid" ? (
          <div className="mt-md grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {inv.products.map((p) => (
              <ProductCard key={p.id} product={p} onOpen={handleProductClick} canManage={canManage} />
            ))}
          </div>
        ) : (
          <div className="mt-md space-y-sm">
            {inv.products.map((p) => (
              <ProductRow key={p.id} product={p} onOpen={handleProductClick} canManage={canManage} />
            ))}
          </div>
        )}
      </div>

      {/* Admin: criar/editar (com opção de excluir na edição). */}
      <Modal
        open={creating || editing !== null}
        onClose={closeModal}
        title={editing ? "Editar produto" : "Adicionar novo produto"}
        className="max-w-3xl"
      >
        <ProductForm product={editing} onSubmit={handleSubmit} onCancel={closeModal} />
        {editing && canManage && (
          <div className="mt-md border-t border-outline-variant/40 pt-md">
            <button
              onClick={() => handleDelete(editing)}
              className="flex items-center gap-2 rounded-full border border-error/40 px-5 py-2.5 text-label-md text-error transition-colors hover:bg-error-container hover:text-on-error-container"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              Excluir produto
            </button>
          </div>
        )}
      </Modal>

      {/* Lojista/Vendedora: visualização somente leitura. */}
      <Modal
        open={viewing !== null}
        onClose={closeModal}
        title="Detalhes do produto"
      >
        {viewing && <ProductDetail product={viewing} />}
      </Modal>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-xl flex flex-col items-center justify-center gap-3 py-xl text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
        <Package className="h-7 w-7 text-on-surface-variant/60" strokeWidth={1.5} />
      </div>
      <p className="text-body-md text-on-surface-variant">
        Nenhum produto encontrado.
      </p>
    </div>
  );
}
