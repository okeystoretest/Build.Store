"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PaymentMethod } from "@/types/domain";
import { useCart } from "@/features/pos/hooks/use-cart";
import { useProducts } from "@/features/pos/hooks/use-products";
import { useTender } from "@/features/pos/hooks/use-tender";
import { useLiveProductsQuery } from "@/features/inventory/hooks/use-live-products";
import { useSaleMeta } from "@/features/pos/hooks/use-sale-meta";
import { recordSale } from "@/lib/db/order-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { TopBar } from "./top-bar";
import { CartPanel } from "./cart-panel";
import { CheckoutPanel } from "./checkout-panel";
import { SaleMeta } from "./sale-meta";
import { ProductResults } from "./product-results";
import { VariationPicker } from "./variation-picker";
import { LoadingArea } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import type { Product } from "@/types/domain";

/**
 * Container da tela de PDV. Compõe carrinho + checkout + busca de produtos ao
 * vivo e é dono do fluxo de finalizar. Finalizar persiste a venda no Supabase
 * (pedido + itens + movimentos de estoque; o gatilho SQL dá baixa no estoque) e
 * invalida os caches de produtos e pedidos para a tela refletir na hora.
 */
export function POSScreen() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const cart = useCart();
  const productsQ = useLiveProductsQuery();
  const liveProducts = productsQ.data ?? [];
  const { products, query, setQuery, findByCode } = useProducts(liveProducts);
  const tender = useTender();
  const [tenderInput, setTenderInput] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [saving, setSaving] = useState(false);
  const { sellers, campaigns } = useSaleMeta();

  // Atribuição da venda (vendedora responsável + campanha opcional).
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [isCampaign, setIsCampaign] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  // Cliente da venda (obrigatório para finalizar).
  const [customerName, setCustomerName] = useState("");
  // Cliente selecionado no autocomplete (para gravar customer_id na venda).
  const [customerId, setCustomerId] = useState<string | null>(null);
  // Produto aguardando escolha de cor/tamanho no seletor de variação.
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);

  const { totalCents } = cart.totals;
  const isCash = method === "cash";
  const campaignOk = !isCampaign || campaignId !== null;
  const customerOk = customerName.trim().length > 0;
  const canFinalize =
    cart.items.length > 0 &&
    (!isCash || tender.cents >= totalCents) &&
    campaignOk &&
    customerOk;

  // Enter no campo de busca com correspondência exata adiciona o produto.
  const handleQueryChange = (value: string) => {
    setQuery(value);
    const match = findByCode(value);
    if (match) {
      setPendingProduct(match);
      setQuery("");
    }
  };

  const finalize = async () => {
    if (!canFinalize || saving) return;
    setSaving(true);
    try {
      const seller = sellers.find((s) => s.id === sellerId) ?? null;
      await recordSale({
        items: cart.items,
        globalDiscountCents: cart.globalDiscountCents,
        paymentMethod: method,
        tenderedCents: method === "cash" ? tender.cents : null,
        customerId,
        customerName: customerName.trim(),
        sellerId,
        sellerName: seller?.fullName ?? null,
        campaignId: isCampaign ? campaignId : null,
      });
      cart.clear();
      tender.clear();
      setTenderInput("");
      setMethod("cash");
      setIsCampaign(false);
      setCampaignId(null);
      setCustomerName("");
      setCustomerId(null);
      // Reflete a venda na hora: estoque (baixa via gatilho) e histórico.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.products }),
        queryClient.invalidateQueries({ queryKey: queryKeys.orders }),
      ]);
      toast.success("Venda finalizada com sucesso!");
    } finally {
      setSaving(false);
    }
  };

  if (productsQ.isPending) {
    return (
      <div className="h-full px-margin py-md">
        <LoadingArea label="Carregando PDV..." />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar
        query={query}
        onQueryChange={handleQueryChange}
        onCheckout={finalize}
        checkoutDisabled={!canFinalize || saving}
      />

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_minmax(360px,420px)]">
        <div className="grid grid-rows-[auto_1fr] overflow-hidden">
          <ProductResults
            products={products}
            query={query}
            onSelect={setPendingProduct}
          />
          <div className="min-h-0 overflow-hidden">
            <CartPanel cart={cart} />
          </div>
        </div>

        <CheckoutPanel
          totalCents={totalCents}
          method={method}
          onMethodChange={setMethod}
          tenderedCents={tender.cents}
          tenderInput={tenderInput}
          onTenderInput={(value) => {
            setTenderInput(value);
            tender.setFromReais(value);
          }}
          onFinalize={finalize}
          canFinalize={canFinalize}
          saving={saving}
          meta={
            <SaleMeta
              customerName={customerName}
              onCustomerNameChange={(v) => {
                setCustomerName(v);
              }}
              onCustomerSelect={(c) => setCustomerId(c?.id ?? null)}
              sellers={sellers}
              campaigns={campaigns}
              sellerId={sellerId}
              onSellerChange={setSellerId}
              isCampaign={isCampaign}
              onIsCampaignChange={setIsCampaign}
              campaignId={campaignId}
              onCampaignChange={setCampaignId}
            />
          }
        />
      </div>

      <VariationPicker
        product={pendingProduct}
        onClose={() => setPendingProduct(null)}
        onConfirm={(variation, quantity) => {
          if (pendingProduct) cart.add(pendingProduct, variation, quantity);
        }}
      />
    </div>
  );
}
