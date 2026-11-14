import { describe, expect, it } from 'vitest'
import {
  inventoryCountSchema,
  isInbound,
  movementInputSchema,
  priceWithVat,
  productInputSchema,
  stockStatus,
  transferInputSchema,
  weightedAverageCost,
} from './catalog.js'

const P = '01a1d9f6-1e4b-7c4e-9a3b-2f1c8d7e6b5a'
const W1 = '01a1d9f6-1e4b-7c4e-9a3b-2f1c8d7e6b5b'
const W2 = '01a1d9f6-1e4b-7c4e-9a3b-2f1c8d7e6b5c'

describe('weightedAverageCost (PMP)', () => {
  it('pondère le stock existant et la réception', () => {
    // 500 sacs à 4 250 + 200 sacs à 4 400 → 3 005 000 / 700 = 4 292,86
    expect(weightedAverageCost(500, 4250, 200, 4400)).toBe(4293)
  })

  it("repart du coût d'achat si le stock est nul ou négatif", () => {
    expect(weightedAverageCost(0, 4250, 10, 5000)).toBe(5000)
    expect(weightedAverageCost(-3, 4250, 10, 5000)).toBe(5000)
  })

  it('gère les quantités décimales', () => {
    expect(weightedAverageCost(2.5, 9000, 2.5, 10000)).toBe(9500)
  })
})

describe('stockStatus', () => {
  it('rupture à zéro ou en dessous', () => {
    expect(stockStatus(0, 10)).toBe('OUT')
    expect(stockStatus(-1, 0)).toBe('OUT')
  })
  it('stock bas au seuil inclus', () => {
    expect(stockStatus(10, 10)).toBe('LOW')
    expect(stockStatus(11, 10)).toBe('OK')
  })
  it('sans seuil, tout stock positif est OK', () => {
    expect(stockStatus(1, 0)).toBe('OK')
  })
})

describe('priceWithVat', () => {
  it('arrondit au franc', () => {
    expect(priceWithVat(4400, 18)).toBe(5192)
    expect(priceWithVat(1000, 0)).toBe(1000)
  })
})

describe('isInbound', () => {
  it('distingue entrées et sorties', () => {
    expect(isInbound('PURCHASE_RECEIPT')).toBe(true)
    expect(isInbound('TRANSFER_IN')).toBe(true)
    expect(isInbound('SALE')).toBe(false)
    expect(isInbound('ADJUSTMENT_OUT')).toBe(false)
  })
})

describe('schémas de saisie', () => {
  it('exige un coût pour une réception, pas pour une perte', () => {
    const base = { productId: P, warehouseId: W1, quantity: 5 }
    expect(movementInputSchema.safeParse({ ...base, type: 'PURCHASE_RECEIPT' }).success).toBe(false)
    expect(movementInputSchema.safeParse({ ...base, type: 'PURCHASE_RECEIPT', unitCost: 100 }).success).toBe(true)
    expect(movementInputSchema.safeParse({ ...base, type: 'LOSS' }).success).toBe(true)
  })

  it('refuse les ventes saisies à la main et les quantités nulles', () => {
    const base = { productId: P, warehouseId: W1 }
    expect(movementInputSchema.safeParse({ ...base, type: 'SALE', quantity: 1 }).success).toBe(false)
    expect(movementInputSchema.safeParse({ ...base, type: 'LOSS', quantity: 0 }).success).toBe(false)
    expect(movementInputSchema.safeParse({ ...base, type: 'LOSS', quantity: 1.0005 }).success).toBe(false)
  })

  it('accepte un inventaire à zéro', () => {
    expect(inventoryCountSchema.safeParse({ productId: P, warehouseId: W1, countedQuantity: 0 }).success).toBe(true)
  })

  it('refuse un transfert vers le même dépôt', () => {
    const t = { productId: P, quantity: 1 }
    expect(transferInputSchema.safeParse({ ...t, fromWarehouseId: W1, toWarehouseId: W1 }).success).toBe(false)
    expect(transferInputSchema.safeParse({ ...t, fromWarehouseId: W1, toWarehouseId: W2 }).success).toBe(true)
  })

  it('normalise le SKU et applique la TVA par défaut', () => {
    const r = productInputSchema.parse({ sku: ' mat-cim-425 ', name: 'Ciment', unit: 'sac', salePrice: 4400 })
    expect(r.sku).toBe('MAT-CIM-425')
    expect(r.vatRate).toBe(18)
  })

  it('valide le code-barres', () => {
    const base = { sku: 'X1', name: 'Article', unit: 'pièce', salePrice: 1 }
    expect(productInputSchema.safeParse({ ...base, barcode: '7891234567890' }).success).toBe(true)
    expect(productInputSchema.safeParse({ ...base, barcode: 'ABC' }).success).toBe(false)
  })
})
