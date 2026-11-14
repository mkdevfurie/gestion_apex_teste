import { roundXof } from './money.js'

export interface LineForTotals {
  quantity: number
  unitPrice: number // HT
  discountRate?: number // %
  vatRate: number // %
}

export interface VatBreakdown {
  rate: number
  base: number // HT après remise globale
  vat: number
}

export interface InvoiceTotals {
  lineTotals: number[] // HT après remise de ligne
  subtotal: number // Σ lignes HT
  discount: number // remise globale / escompte, déduite du HT
  vat: VatBreakdown[]
  vatTotal: number
  total: number // TTC net à payer
}

/**
 * Calcul unique des totaux, utilisé par la caisse (affichage) ET par l'API
 * (calcul qui fait foi). L'escompte est déduit de la base HT AVANT la TVA,
 * réparti au prorata de chaque taux.
 */
export function computeInvoiceTotals(
  lines: LineForTotals[],
  globalDiscount = 0,
): InvoiceTotals {
  const lineTotals = lines.map((l) =>
    roundXof(l.quantity * l.unitPrice * (1 - (l.discountRate ?? 0) / 100)),
  )
  const subtotal = lineTotals.reduce((a, b) => a + b, 0)
  const discount = Math.min(Math.max(0, roundXof(globalDiscount)), subtotal)

  const baseByRate = new Map<number, number>()
  lines.forEach((l, i) => {
    baseByRate.set(l.vatRate, (baseByRate.get(l.vatRate) ?? 0) + lineTotals[i]!)
  })

  const rates = [...baseByRate.keys()].sort((a, b) => b - a)
  let discountLeft = discount
  const vat: VatBreakdown[] = rates.map((rate, idx) => {
    const gross = baseByRate.get(rate)!
    const share =
      idx === rates.length - 1
        ? discountLeft
        : subtotal === 0
          ? 0
          : roundXof((discount * gross) / subtotal)
    discountLeft -= share
    const base = gross - share
    return { rate, base, vat: roundXof((base * rate) / 100) }
  })

  const vatTotal = vat.reduce((a, v) => a + v.vat, 0)
  return {
    lineTotals,
    subtotal,
    discount,
    vat,
    vatTotal,
    total: subtotal - discount + vatTotal,
  }
}

/** Créance = total facture − Σ règlements (jamais négative). */
export function balanceDue(total: number, payments: { amount: number }[]): number {
  const paid = payments.reduce((a, p) => a + p.amount, 0)
  return Math.max(0, total - paid)
}
