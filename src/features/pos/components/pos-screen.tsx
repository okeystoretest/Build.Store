"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, CreditCard } from "lucide-react";
import type { PaymentMethod } from "@/types/domain";
import { useCart } from "@/features/pos/hooks/use-cart";
import { useProducts } from "@/features/pos/hooks/use-products";
import { useTender } from "@/features/pos/hooks/use-tender";
import { useLiveProductsQuery } from "@/features/inventory/hooks/use-live-products";
import { useSaleMeta } from "@/features/pos/hooks/use-sale-meta";
import { recordSale } from "@/lib/db/order-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { cn } from "@/lib/utils/cn";
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
 * Container da tela de PDV. No desktop, duas colunas (produtos+carrinho |
 * checkout). No mobile, alterna entre duas abas: "Produtos" (busca + resultados
 * + carrinho) e "Pagamento" (checkout). Um resumo fixo no rodapé mostra o total
 * e leva ao pagamento.
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

  const [sellerId, setSellerId] = useState<string | null>(null);
  const [isCampaign, setIsCampaign] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);

  // Aba ativa no mobile.
  const [mobileTab, setMobileTab] = useState<"products" | "payment">("products");

  const { totalCents } = cart.totals;
  const isCash = method === "cash";
  const campaignOk = !isCampaign || campaignId !== null;
  const customerOk = customerName.trim().length > 0;
  const canFinalize =
    cart.items.length > 0 &&
    (!isCash || tender.cents >= totalCents) &&
    campaignOk &&
    customerOk;

  const handleQueryChange = (value: string) => {
    setQuery(value);
    const match = findByCode(value);
    if (match) {
      setPendingProduct(match);
      setQuery("");
    }
  };

  // Código lido pela câmera: procura pelo código de barras/SKU. Se achar, abre o
  // seletor de variação; se não, deixa o código na busca para a operadora ver
  // que não houve correspondência.
  const handleScan = (code: string) => {
    const match = findByCode(code);
    if (match) {
      setPendingProduct(match);
      setQuery("");
    } else {
      setQuery(code);
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
      setMobileTab("products");
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

  const checkout = (
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
          onCustomerNameChange={setCustomerName}
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
  );

  const productsAndCart = (
    <div className="grid h-full min-w-0 grid-rows-[auto_1fr] overflow-hidden">
      <ProductResults
        products={products}
        query={query}
        onSelect={setPendingProduct}
      />
      <div className="min-h-0 overflow-hidden">
        <CartPanel cart={cart} />
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-w-0 flex-col">
      <TopBar
        query={query}
        onQueryChange={handleQueryChange}
        onCheckout={finalize}
        checkoutDisabled={!canFinalize || saving}
        onScan={handleScan}
      />

      {/* Abas (só mobile) */}
      <div className="flex gap-1 border-b border-outline-variant/50 px-3 py-2 lg:hidden">
        <TabButton
          active={mobileTab === "products"}
          onClick={() => setMobileTab("products")}
          icon={<ShoppingBag className="h-4 w-4" strokeWidth={1.75} />}
          label="Produtos"
          badge={cart.items.length > 0 ? cart.items.length : undefined}
        />
        <TabButton
          active={mobileTab === "payment"}
          onClick={() => setMobileTab("payment")}
          icon={<CreditCard className="h-4 w-4" strokeWidth={1.75} />}
          label="Pagamento"
        />
      </div>

      {/* Desktop: duas colunas */}
      <div className="hidden flex-1 grid-cols-[1fr_minmax(360px,420px)] overflow-hidden lg:grid">
        {productsAndCart}
        {checkout}
      </div>

      {/* Mobile: uma aba por vez */}
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden lg:hidden">
        <div className={cn("h-full min-w-0", mobileTab === "products" ? "block" : "hidden")}>
          {productsAndCart}
        </div>
        <div
          className={cn(
            "h-full min-w-0 overflow-y-auto",
            mobileTab === "payment" ? "block" : "hidden",
          )}
        >
          {checkout}
        </div>
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

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-label-md font-medium transition-colors",
        active
          ? "bg-primary-fixed/60 text-primary"
          : "text-on-surface-variant hover:bg-surface-container",
      )}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-label-sm text-on-primary">
          {badge}
        </span>
      )}
    </button>
  );
}
