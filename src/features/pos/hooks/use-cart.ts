"use client";

import { useReducer, useCallback, useMemo } from "react";
import type { CartItem, Product } from "@/types/domain";
import { computeTotals, itemCount } from "@/lib/utils/cart";

/**
 * Cart state machine. Kept as a reducer so every mutation is explicit,
 * serializable and easy to persist offline later (Fase 3). Totals are derived,
 * never stored, so they can't drift from the line items.
 */
interface CartState {
  items: CartItem[];
  globalDiscountCents: number;
}

type CartAction =
  | { type: "ADD"; product: Product }
  | { type: "SET_QTY"; productId: string; quantity: number }
  | { type: "INCREMENT"; productId: string }
  | { type: "DECREMENT"; productId: string }
  | { type: "REMOVE"; productId: string }
  | { type: "SET_DISCOUNT"; cents: number }
  | { type: "CLEAR" };

function toCartItem(product: Product): CartItem {
  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    imageUrl: product.imageUrl,
    unitPriceCents: product.priceCents,
    quantity: 1,
    lineDiscountCents: 0,
  };
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD": {
      const existing = state.items.find(
        (i) => i.productId === action.product.id,
      );
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.productId === action.product.id
              ? { ...i, quantity: i.quantity + 1 }
              : i,
          ),
        };
      }
      return { ...state, items: [...state.items, toCartItem(action.product)] };
    }
    case "SET_QTY": {
      const quantity = Math.max(0, action.quantity);
      if (quantity === 0) {
        return {
          ...state,
          items: state.items.filter((i) => i.productId !== action.productId),
        };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.productId === action.productId ? { ...i, quantity } : i,
        ),
      };
    }
    case "INCREMENT":
      return cartReducer(state, {
        type: "SET_QTY",
        productId: action.productId,
        quantity:
          (state.items.find((i) => i.productId === action.productId)
            ?.quantity ?? 0) + 1,
      });
    case "DECREMENT":
      return cartReducer(state, {
        type: "SET_QTY",
        productId: action.productId,
        quantity:
          (state.items.find((i) => i.productId === action.productId)
            ?.quantity ?? 0) - 1,
      });
    case "REMOVE":
      return {
        ...state,
        items: state.items.filter((i) => i.productId !== action.productId),
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
    add: useCallback((product: Product) => {
      // Produto sem estoque não pode ser vendido.
      if (product.stock <= 0) return;
      dispatch({ type: "ADD", product });
    }, []),
    increment: useCallback(
      (productId: string) => dispatch({ type: "INCREMENT", productId }),
      [],
    ),
    decrement: useCallback(
      (productId: string) => dispatch({ type: "DECREMENT", productId }),
      [],
    ),
    setQuantity: useCallback(
      (productId: string, quantity: number) =>
        dispatch({ type: "SET_QTY", productId, quantity }),
      [],
    ),
    remove: useCallback(
      (productId: string) => dispatch({ type: "REMOVE", productId }),
      [],
    ),
    setDiscount: useCallback(
      (cents: number) => dispatch({ type: "SET_DISCOUNT", cents }),
      [],
    ),
    clear: useCallback(() => dispatch({ type: "CLEAR" }), []),
  };
}

export type UseCart = ReturnType<typeof useCart>;
