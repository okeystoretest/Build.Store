"use client";

import { useState } from "react";
import type { PaymentMethod } from "@/types/domain";
import { useCart } from "@/features/pos/hooks/use-cart";
import { useProducts } from "@/features/pos/hooks/use-products";
import { useTender } from "@/features/pos/hooks/use-tender";
import { useLiveProducts } from "@/features/inventory/hooks/use-live-products";
import { useSync } from "@/hooks/use-sync";
import { useSaleMeta } from "@/features/pos/hooks/use-sale-meta";
import { recordSale } from "@/lib/db/order-repository";
import { TopBar } from "./top-bar";
import { CartPanel } from "./cart-panel";
import { CheckoutPanel } from "./checkout-panel";
import { SaleMeta } from "./sale-meta";
import { ProductResults } from "./product-results";

/**
 * PDV screen container. Composes cart + checkout + live product search and owns
 * the finalize flow. Finalizing persists the sale to Dexie (order + stock
 * decrement + movements, atomically) and queues it for sync.
 */
export function POSScreen() {
  const cart = useCart();
  const liveProducts = useLiveProducts() ?? [];
  const { products, query, setQuery, findByCode } = useProducts(liveProducts);
  const tender = useTender();
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [saving, setSaving] = useState(false);
  const sync = useSync();
  const { sellers, campaigns } = useSaleMeta();

  // Sale attribution (seller responsible + optional campaign).
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [isCampaign, setIsCampaign] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  const { totalCents } = cart.totals;
  const isCash = method === "cash";
  // Campaign attribution, when flagged, requires a chosen campaign to finalize.
  const campaignOk = !isCampaign || campaignId !== null;
  const canFinalize =
    cart.items.length > 0 &&
    (!isCash || tender.cents >= totalCents) &&
    campaignOk;

  // Enter on the search field with an exact code match adds that product.
  const handleQueryChange = (value: string) => {
    setQuery(value);
    const match = findByCode(value);
    if (match) {
      cart.add(match);
      setQuery("");
    }
  };

  const finalize = async () => {
    if (!canFinalize || saving) return;
    setSaving(true);
    try {
      const seller = sellers.find((s) => s.id === sellerId) ?? null;
      // Persist to Dexie: writes the order, decrements stock and logs stock
      // movements atomically, then queues the order for sync.
      await recordSale({
        items: cart.items,
        globalDiscountCents: cart.globalDiscountCents,
        paymentMethod: method,
        tenderedCents: method === "cash" ? tender.cents : null,
        sellerId,
        sellerName: seller?.fullName ?? null,
        campaignId: isCampaign ? campaignId : null,
      });
      cart.clear();
      tender.clear();
      setMethod("cash");
      setIsCampaign(false);
      setCampaignId(null);
      // Keep the selected seller for the next sale (same operator, common case).
      await sync.refreshPending();
      void sync.flush();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar
        query={query}
        onQueryChange={handleQueryChange}
        online={sync.online}
        pending={sync.pending}
        onCheckout={finalize}
        checkoutDisabled={!canFinalize || saving}
      />

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_minmax(360px,420px)]">
        <div className="grid grid-rows-[auto_1fr] overflow-hidden">
          <ProductResults
            products={products}
            query={query}
            onSelect={cart.add}
          />
          <CartPanel cart={cart} />
        </div>

        <CheckoutPanel
          totalCents={totalCents}
          method={method}
          onMethodChange={setMethod}
          tenderedCents={tender.cents}
          onTenderDigit={tender.pushDigit}
          onTenderClear={tender.clear}
          onTenderBackspace={tender.backspace}
          onFinalize={finalize}
          canFinalize={canFinalize}
          meta={
            <SaleMeta
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
    </div>
  );
}
