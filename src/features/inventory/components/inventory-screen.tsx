"use client";

import { useState } from "react";
import { Search, Plus, Package, AlertTriangle, Cloud, LayoutGrid, List } from "lucide-react";
import type { Product } from "@/types/domain";
import { useInventory } from "@/features/inventory/hooks/use-inventory";
import { upsertProduct } from "@/lib/db/product-repository";
import { notifyProductAdded } from "@/lib/db/notification-repository";
import { useAuth } from "@/hooks/use-auth";
import { ProductCard, ProductRow } from "./product-card";
import { ProductForm } from "./product-form";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ToggleGroup } from "@/components/ui/toggle-group";

/**
 * Estoque screen. Search + Grid/List toggle + product list. Category removed.
 * Only Admin can add products; Lojista/Admin can edit. Adding a product as
 * Admin emits a notification (Ref/Nome/Quantidade) to other users.
 */
export function InventoryScreen() {
  const inv = useInventory();
  const { canAddProducts, canEditProducts } = useAuth();
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const closeModal = () => {
    setEditing(null);
    setCreating(false);
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
      imageUrl: values.imageUrl ?? editing?.imageUrl ?? null,
      active: true,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    };
    await upsertProduct(product);
    // A new product added by an Admin notifies the other users.
    if (isNew && canAddProducts) {
      await notifyProductAdded(product);
    }
    closeModal();
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-md border-b border-outline-variant/50 px-margin py-md">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant" strokeWidth={1.75} />
          <input
            value={inv.query}
            onChange={(e) => inv.setQuery(e.target.value)}
            placeholder="Pesquisar produtos ou referência..."
            aria-label="Pesquisar produtos"
            className="h-14 w-full rounded-full border border-outline-variant bg-surface pl-14 pr-6 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary-container focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 rounded-full bg-surface-container px-4 py-2 text-label-sm font-semibold text-on-surface-variant">
          <Cloud className="h-4 w-4" strokeWidth={1.75} />
          Cloud Sync
        </div>

        {canAddProducts && (
          <Button size="lg" onClick={() => setCreating(true)}>
            <Plus className="h-5 w-5" strokeWidth={2} />
            Adicionar Novo Produto
          </Button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-margin py-md">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <div>
            <h1 className="text-headline-lg text-primary">Gestão de Estoque</h1>
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
              <ProductCard key={p.id} product={p} onEdit={setEditing} canEdit={canEditProducts} />
            ))}
          </div>
        ) : (
          <div className="mt-md space-y-sm">
            {inv.products.map((p) => (
              <ProductRow key={p.id} product={p} onEdit={setEditing} canEdit={canEditProducts} />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={creating || editing !== null}
        onClose={closeModal}
        title={editing ? "Editar produto" : "Adicionar novo produto"}
      >
        <ProductForm product={editing} onSubmit={handleSubmit} onCancel={closeModal} />
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
