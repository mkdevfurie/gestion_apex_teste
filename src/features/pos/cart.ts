import { useEffect, useMemo, useReducer } from 'react'
import { computeInvoiceTotals, type ProductRow } from '@/shared'

export type CartProduct = Pick<ProductRow, 'id' | 'sku' | 'name' | 'unit' | 'salePrice' | 'vatRate' | 'stock'>

export type CartLine = { product: CartProduct; quantity: number; discountRate: number }

type State = {
  lines: CartLine[]
  /** Identifiant de la vente en cours : rejouer l'encaissement ne crée pas 2 tickets. */
  requestId: string
}

type Action =
  | { type: 'add'; product: CartProduct; quantity?: number }
  | { type: 'setQty'; productId: string; quantity: number }
  | { type: 'setDiscount'; productId: string; discountRate: number }
  | { type: 'remove'; productId: string }
  | { type: 'clear' }

const round3 = (n: number) => Math.round(n * 1000) / 1000

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add': {
      const q = action.quantity ?? 1
      const existing = state.lines.find((l) => l.product.id === action.product.id)
      const lines = existing
        ? state.lines.map((l) => (l === existing ? { ...l, product: action.product, quantity: round3(l.quantity + q) } : l))
        : [...state.lines, { product: action.product, quantity: q, discountRate: 0 }]
      return { ...state, lines }
    }
    case 'setQty':
      return {
        ...state,
        lines: state.lines
          .map((l) => (l.product.id === action.productId ? { ...l, quantity: round3(action.quantity) } : l))
          .filter((l) => l.quantity > 0),
      }
    case 'setDiscount':
      return {
        ...state,
        lines: state.lines.map((l) => (l.product.id === action.productId ? { ...l, discountRate: action.discountRate } : l)),
      }
    case 'remove':
      return { ...state, lines: state.lines.filter((l) => l.product.id !== action.productId) }
    case 'clear':
      return { lines: [], requestId: crypto.randomUUID() }
  }
}

const storageKey = (userId: string) => `apex.cart.${userId}`

function load(userId: string): State {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (raw) {
      const s = JSON.parse(raw) as State
      if (Array.isArray(s.lines) && typeof s.requestId === 'string') return s
    }
  } catch {
    /* panier illisible : on repart à vide */
  }
  return { lines: [], requestId: crypto.randomUUID() }
}

/** Panier de la caisse, conservé dans le navigateur (rechargement, coupure). */
export function useCart(userId: string) {
  const [state, dispatch] = useReducer(reducer, userId, load)

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(state))
    } catch {
      /* stockage indisponible : le panier reste en mémoire */
    }
  }, [state, userId])

  // Aperçu des totaux : même calcul que l'API (qui reste seule juge).
  const totals = useMemo(
    () =>
      computeInvoiceTotals(
        state.lines.map((l) => ({
          quantity: l.quantity,
          unitPrice: l.product.salePrice,
          discountRate: l.discountRate,
          vatRate: l.product.vatRate,
        })),
      ),
    [state.lines],
  )
  const itemCount = round3(state.lines.reduce((a, l) => a + l.quantity, 0))

  return { ...state, totals, itemCount, dispatch }
}
