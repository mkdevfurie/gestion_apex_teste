import { describe, expect, it } from 'vitest'
import { quickCashAmounts, saleInputSchema, settlePayments } from './sales.js'

describe('settlePayments', () => {
  it('espèces seules : rend la monnaie', () => {
    const r = settlePayments(77_408, [{ method: 'CASH', amount: 80_000 }])
    expect(r).toEqual({ ok: true, applied: [{ method: 'CASH', amount: 77_408 }], cashTendered: 80_000, change: 2_592, credit: 0 })
  })

  it('paiement mixte : Wave exact, espèces pour le reste', () => {
    const r = settlePayments(77_408, [
      { method: 'WAVE', amount: 20_000, reference: 'WV-123' },
      { method: 'CASH', amount: 60_000 },
    ])
    expect(r.ok && r.applied).toEqual([
      { method: 'WAVE', amount: 20_000, reference: 'WV-123' },
      { method: 'CASH', amount: 57_408 },
    ])
    expect(r.ok && r.change).toBe(2_592)
  })

  it('mobile money seul, montant exact : pas de ligne espèces', () => {
    const r = settlePayments(5_192, [{ method: 'ORANGE_MONEY', amount: 5_192 }])
    expect(r).toEqual({ ok: true, applied: [{ method: 'ORANGE_MONEY', amount: 5_192 }], cashTendered: 0, change: 0, credit: 0 })
  })

  it('refuse un montant insuffisant et indique ce qui manque', () => {
    expect(settlePayments(5_192, [{ method: 'CASH', amount: 5_000 }])).toEqual({
      ok: false,
      error: 'Montant insuffisant',
      remaining: 192,
    })
  })

  it('à crédit : l’argent remis est imputé, le reste devient une créance', () => {
    expect(settlePayments(50_000, [{ method: 'CASH', amount: 20_000 }], true)).toEqual({
      ok: true,
      applied: [{ method: 'CASH', amount: 20_000 }],
      cashTendered: 20_000,
      change: 0,
      credit: 30_000,
    })
    expect(settlePayments(50_000, [], true)).toMatchObject({ ok: true, applied: [], credit: 50_000 })
  })

  it('refuse un trop-perçu hors espèces (on ne rend pas la monnaie sur Wave)', () => {
    const r = settlePayments(5_192, [{ method: 'WAVE', amount: 6_000 }])
    expect(r.ok).toBe(false)
  })

  it('espèces remises alors que le mobile money couvre déjà tout : tout est rendu', () => {
    const r = settlePayments(5_000, [
      { method: 'WAVE', amount: 5_000 },
      { method: 'CASH', amount: 1_000 },
    ])
    expect(r).toEqual({ ok: true, applied: [{ method: 'WAVE', amount: 5_000 }], cashTendered: 1_000, change: 1_000, credit: 0 })
  })
})

describe('quickCashAmounts', () => {
  it('propose le montant exact puis des coupures arrondies', () => {
    expect(quickCashAmounts(77_408)).toEqual([77_408, 78_000, 80_000])
    expect(quickCashAmounts(5_000)).toEqual([5_000, 6_000, 10_000])
  })
})

describe('saleInputSchema', () => {
  const base = {
    clientRequestId: '01a1d9f6-1e4b-7c4e-9a3b-2f1c8d7e6b5a',
    lines: [{ productId: '01a1d9f6-1e4b-7c4e-9a3b-2f1c8d7e6b5b', quantity: 2 }],
    payments: [{ method: 'CASH', amount: 1_000 }],
  }
  it("n'accepte ni prix ni TVA venant de la caisse", () => {
    const parsed = saleInputSchema.parse({
      ...base,
      lines: [{ ...base.lines[0], unitPrice: 1, vatRate: 0 }],
    })
    expect(parsed.lines[0]).toEqual({ productId: base.lines[0].productId, quantity: 2, discountRate: 0 })
  })
  it('refuse un panier vide ou un montant nul', () => {
    expect(saleInputSchema.safeParse({ ...base, lines: [] }).success).toBe(false)
    expect(saleInputSchema.safeParse({ ...base, payments: [{ method: 'CASH', amount: 0 }] }).success).toBe(false)
    expect(saleInputSchema.safeParse({ ...base, payments: [{ method: 'CREDIT_NOTE', amount: 10 }] }).success).toBe(false)
  })
})
