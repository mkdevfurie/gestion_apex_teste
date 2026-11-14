import { describe, expect, it } from 'vitest'
import { balanceDue, computeInvoiceTotals } from './totals.js'
import { formatXof } from './money.js'

describe('computeInvoiceTotals', () => {
  // Cas de la maquette « Facture FAC-2025-0182 »
  const lines = [
    { quantity: 150, unitPrice: 4_000, vatRate: 18 },
    { quantity: 50, unitPrice: 5_000, vatRate: 18 },
    { quantity: 6, unitPrice: 20_000, vatRate: 18 },
    { quantity: 2, unitPrice: 15_000, vatRate: 0 },
  ]

  it('calcule HT, TVA par taux et TTC', () => {
    const t = computeInvoiceTotals(lines)
    expect(t.subtotal).toBe(1_000_000)
    expect(t.vat).toEqual([
      { rate: 18, base: 970_000, vat: 174_600 },
      { rate: 0, base: 30_000, vat: 0 },
    ])
    expect(t.total).toBe(1_174_600) // la maquette affiche 1 204 600 : erreur (exonéré compté deux fois)
  })

  it("déduit l'escompte de la base HT avant la TVA", () => {
    const t = computeInvoiceTotals(lines, 10_000)
    expect(t.vat.reduce((a, v) => a + v.base, 0)).toBe(990_000)
    expect(t.vat[0]).toEqual({ rate: 18, base: 960_300, vat: 172_854 })
    expect(t.total).toBe(990_000 + 172_854)
  })

  it('applique la remise de ligne (panier de caisse)', () => {
    const t = computeInvoiceTotals([
      { quantity: 25, unitPrice: 4_800, vatRate: 0 },
      { quantity: 10, unitPrice: 6_200, discountRate: 5, vatRate: 0 },
      { quantity: 3, unitPrice: 3_500, vatRate: 0 },
    ])
    expect(t.lineTotals).toEqual([120_000, 58_900, 10_500])
    expect(t.total).toBe(189_400)
  })

  it('accepte des quantités décimales (vente au mètre)', () => {
    const t = computeInvoiceTotals([{ quantity: 2.5, unitPrice: 1_250, vatRate: 18 }])
    expect(t.subtotal).toBe(3_125)
    expect(t.vatTotal).toBe(563)
  })
})

describe('balanceDue', () => {
  it('soustrait les règlements partiels', () => {
    expect(balanceDue(1_200_000, [{ amount: 400_000 }])).toBe(800_000)
    expect(balanceDue(100, [{ amount: 150 }])).toBe(0)
  })
})

describe('formatXof', () => {
  it('formate en FCFA', () => {
    expect(formatXof(1_420_500).replace(/\s/g, ' ')).toBe('1 420 500 FCFA')
  })
})
