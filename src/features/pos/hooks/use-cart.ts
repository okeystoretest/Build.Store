"use client";

import { useReducer, useCallback, useMemo } from "react";
import type { CartItem, Product } from "@/types/domain";
import { computeTotals, itemCount } from "@/lib/utils/cart";

/**
 * Máquina de estado do carrinho. Cada item é uma VARIAÇÃO (produto + cor +
 * tamanho), então a mesma peça em tamanhos diferentes ocupa linhas diferentes.
 * A chave de linha é `${productId}|${color}|${size}`. Totais são derivados,
 * nunca guardados, para não divergirem das linhas.
 */
interface CartState {
  items: CartItem[];
  globalDiscountCents: number;
}

/** Uma variação escolhida no seletor do PDV. */
export interface Variation {
  color: string | null;
  size: string | null;
  /** Estoque disponível daquela variação (limita a quantidade no carrinho). */
  available: number;
}

type CartAction =
  | { type: "ADD"; product: Product; variation: Variation }
  | { type: "SET_QTY"; key: string; quantity: number }
  | { type: "INCREMENT"; key: string }
  | { type: "DECREMENT"; key: string }
  | { type: "REMOVE"; key: string }
  | { type: "SET_DISCOUNT"; cents: number }
  | { type: "CLEAR" };

/** Chave única de uma linha (produto + variação). */
export function lineKey(
  productId: string,
  color: string | null,
  size: string | null,
): string {
  return `${productId}|${color ?? ""}|${size ?? ""}`;
}

function keyOf(item: CartItem): string {
  return lineKey(item.productId, item.color, item.size);
}

function toCartItem(product: Product, variation: Variation): CartItem {
  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    imageUrl: product.imageUrl,
    unitPriceCents: product.priceCents,
    quantity: 1,
    lineDiscountCents: 0,
    color: variation.color,
    size: variation.size,
    // Cap transitório: estoque disponível daquela variação. Não é persistido no
    // pedido — serve só para impedir vender mais do que há em estoque.
    maxQuantity: variation.available,
  };
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const key = lineKey(
        action.product.id,
        action.variation.color,
        action.variation.size,
      );
      const existing = state.items.find((i) => keyOf(i) === key);
      const available = action.variation.available;
      if (existing) {
        // Não ultrapassa o estoque disponível da variação.
        const quantity = Math.min(existing.quantity + 1, available);
        return {
          ...state,
          items: state.items.map((i) =>
            keyOf(i) === key ? { ...i, quantity } : i,
          ),
        };
      }
      return {
        ...state,
        items: [...state.items, toCartItem(action.product, action.variation)],
      };
    }
    case "SET_QTY": {
      const desired = Math.max(0, action.quantity);
      if (desired === 0) {
        return {
          ...state,
          items: state.items.filter((i) => keyOf(i) !== action.key),
        };
      }
      return {
        ...state,
        items: state.items.map((i) => {
          if (keyOf(i) !== action.key) return i;
          // Nunca ultrapassa o estoque disponível da variação.
          const cap = i.maxQuantity ?? desired;
          return { ...i, quantity: Math.min(desired, cap) };
        }),
      };
    }
    case "INCREMENT":
      return cartReducer(state, {
        type: "SET_QTY",
        key: action.key,
        quantity:
          (state.items.find((i) => keyOf(i) === action.key)?.quantity ?? 0) + 1,
      });
    case "DECREMENT":
      return cartReducer(state, {
        type: "SET_QTY",
        key: action.key,
        quantity:
          (state.items.find((i) => keyOf(i) === action.key)?.quantity ?? 0) - 1,
      });
    case "REMOVE":
      return {
        ...state,
        items: state.items.filter((i) => keyOf(i) !== action.key),
      };
    case "SET_DISCOUNT":
      return { ...state, globalDiscountCents: Math.max(0, action.cents) };
    case "CLEAR":
      return { items: [], globalDiscountCents: 0 };
    default:
      return state;
  }
}

const INITIAL: CartState = { items: [], globalDiscountCents: 0 };

export function useCart() {
  const [state, dispatch] = useReducer(cartReducer, INITIAL);

  const totals = useMemo(
    () => computeTotals(state.items, state.globalDiscountCents),
    [state.items, state.globalDiscountCents],
  );

  const count = useMemo(() => itemCount(state.items), [state.items]);

  return {
    items: state.items,
    globalDiscountCents: state.globalDiscountCents,
    totals,
    count,
    lineKey,
    add: useCallback((product: Product, variation: Variation) => {
      if (variation.available <= 0) return; // esgotada
      dispatch({ type: "ADD", product, variation });
    }, []),
    increment: useCallback(
      (key: string) => dispatch({ type: "INCREMENT", key }),
      [],
    ),
    decrement: useCallback(
      (key: string) => dispatch({ type: "DECREMENT", key }),
      [],
    ),
    setQuantity: useCallback(
      (key: string, quantity: number) =>
        dispatch({ type: "SET_QTY", key, quantity }),
      [],
    ),
    remove: useCallback((key: string) => dispatch({ type: "REMOVE", key }), []),
    setDiscount: useCallback(
      (cents: number) => dispatch({ type: "SET_DISCOUNT", cents }),
      [],
    ),
    clear: useCallback(() => dispatch({ type: "CLEAR" }), []),
  };
}

export type UseCart = ReturnType<typeof useCart>;
