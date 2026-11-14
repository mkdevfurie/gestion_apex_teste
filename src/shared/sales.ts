import { z } from 'zod'
import { moneySchema, paymentMethodSchema, percentSchema, quantitySchema, type PaymentMethod } from './schemas.js'

// ───────────────────────────── Saisie ─────────────────────────────

/** Ligne de vente : le PRIX et la TVA viennent de la base, jamais du client. */
export const saleLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: quantitySchema,
  discountRate: percentSchema.default(0),
})
export type SaleLine = z.infer<typeof saleLineSchema>

export const salePaymentSchema = z.object({
  method: paymentMethodSchema.exclude(['CREDIT_NOTE']),
  /** Pour les espèces : montant REMIS par le client (la monnaie est calculée). */
  amount: moneySchema.positive('Montant obligatoire'),
  reference: z.string().trim().max(100).optional(),
})
export type SalePayment = z.infer<typeof salePaymentSchema>

export const saleInputSchema = z.object({
  /** Généré par la caisse : rejouer la même requête ne crée pas un 2e ticket. */
  clientRequestId: z.string().uuid(),
  lines: z.array(saleLineSchema).min(1, 'Panier vide').max(200),
  /** Vide autorisé uniquement pour une vente à crédit (client obligatoire). */
  payments: z.array(salePaymentSchema).max(6),
  /** Client : obligatoire pour une facture ou une vente à crédit. */
  customerId: z.string().uuid().optional(),
  /** TICKET (caisse) ou INVOICE (facture A4). */
  kind: z.enum(['TICKET', 'INVOICE']).default('TICKET'),
  /** Le reste non payé passe en créance sur le compte du client. */
  credit: z.boolean().default(false),
  /** Facture hors caisse : dépôt de sortie (sinon celui de la caisse ouverte). */
  warehouseId: z.string().uuid().optional(),
})
export type SaleInput = z.infer<typeof saleInputSchema>

export const cashSessionOpenSchema = z.object({
  warehouseId: z.string().uuid(),
  openingFloat: moneySchema,
})
export type CashSessionOpen = z.infer<typeof cashSessionOpenSchema>

export const cashSessionCloseSchema = z.object({
  countedCash: moneySchema,
  notes: z.string().trim().max(300).optional(),
})
export type CashSessionClose = z.infer<typeof cashSessionCloseSchema>

// ───────────────────────────── Règlement ─────────────────────────────

export type Settlement =
  | {
      ok: true
      /** Montants imputés au ticket (Σ = total). */
      applied: { method: PaymentMethod; amount: number; reference?: string }[]
      cashTendered: number
      change: number
      /** Reste dû passé en créance (vente à crédit). */
      credit: number
    }
  | { ok: false; error: string; remaining: number }

/**
 * Répartit les règlements sur un ticket.
 * - Mobile money, carte, virement, chèque : montant exact, jamais de trop-perçu.
 * - Espèces : couvrent le reste ; l'excédent est rendu (monnaie).
 * - Le ticket doit être soldé (la vente à crédit passe par une facture).
 */
export function settlePayments(total: number, payments: SalePayment[], allowCredit = false): Settlement {
  const cash = payments.filter((p) => p.method === 'CASH')
  const other = payments.filter((p) => p.method !== 'CASH')
  const otherSum = other.reduce((a, p) => a + p.amount, 0)
  const cashTendered = cash.reduce((a, p) => a + p.amount, 0)

  if (otherSum > total) {
    return { ok: false, error: 'Les paiements hors espèces dépassent le total', remaining: total - otherSum }
  }
  const dueInCash = total - otherSum
  if (cashTendered < dueInCash) {
    if (allowCredit) {
      // À crédit : tout l'argent remis est imputé, le reste devient une créance.
      const applied: { method: PaymentMethod; amount: number; reference?: string }[] = other.map((p) => ({ ...p }))
      if (cashTendered > 0) applied.push({ method: 'CASH', amount: cashTendered })
      return { ok: true, applied, cashTendered, change: 0, credit: dueInCash - cashTendered }
    }
    return { ok: false, error: 'Montant insuffisant', remaining: dueInCash - cashTendered }
  }

  const applied: { method: PaymentMethod; amount: number; reference?: string }[] = other.map((p) => ({ ...p }))
  if (dueInCash > 0) applied.push({ method: 'CASH', amount: dueInCash })
  return { ok: true, applied, cashTendered, change: cashTendered - dueInCash, credit: 0 }
}

/** Montants « billets » proposés pour un encaissement rapide en espèces. */
export function quickCashAmounts(total: number): number[] {
  const steps = [1_000, 2_000, 5_000, 10_000]
  const set = new Set<number>([total])
  for (const s of steps) set.add(Math.ceil(total / s) * s)
  return [...set].filter((v) => v >= total).sort((a, b) => a - b).slice(0, 4)
}

// ───────────────────────────── Réponses API ─────────────────────────────

export type ReceiptLine = {
  sku: string | null
  description: string
  unit: string | null
  quantity: number
  unitPrice: number
  discountRate: number
  vatRate: number
  lineTotal: number
}

export type SaleReceipt = {
  id: string
  kind: 'TICKET' | 'INVOICE'
  number: string
  issuedAt: string
  cashier: string
  warehouse: { code: string; name: string }
  company: { name: string; legalForm: string | null; address: string | null; phone: string | null; ninea: string | null; rccm: string | null }
  lines: ReceiptLine[]
  itemCount: number
  subtotal: number
  discount: number
  vat: { rate: number; base: number; vat: number }[]
  vatTotal: number
  total: number
  payments: { method: PaymentMethod; amount: number; reference: string | null }[]
  cashTendered: number | null
  change: number | null
  hash: string
  /** Pied de ticket (paramètres). */
  footer: string
  customer: { id: string; code: string; name: string } | null
  /** Reste dû sur ce document (vente à crédit). */
  balanceDue: number
  dueDate: string | null
}

export type CashSessionSummary = {
  id: string
  warehouse: { id: string; code: string; name: string }
  openedBy: string
  openedAt: string
  openingFloat: number
  ticketCount: number
  salesTotal: number
  byMethod: { method: PaymentMethod; amount: number }[]
  /** Fond de caisse + espèces encaissées (monnaie déjà déduite). */
  expectedCash: number
  closedAt: string | null
  closedBy: string | null
  countedCash: number | null
  /** Compté − attendu (négatif = manquant). */
  difference: number | null
}
