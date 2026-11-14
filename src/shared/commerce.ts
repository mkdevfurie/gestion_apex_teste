import { z } from 'zod'
import { moneySchema, paymentMethodSchema, percentSchema, quantitySchema, type PaymentMethod } from './schemas.js'

const uuid = z.string().uuid()
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
const phone = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+\d][\d\s.-]{5,}$/, 'Numéro de téléphone invalide')
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()
const email = z
  .string()
  .trim()
  .max(120)
  .transform((v) => (v === '' ? null : v))
  .pipe(z.string().email('Adresse e-mail invalide').nullable())
  .nullable()
  .optional()

/** Règlement réel (argent) : l'avoir imputé est réservé au serveur. */
export const moneyMethodSchema = paymentMethodSchema.exclude(['CREDIT_NOTE'])

// ───────────────────────────── Tiers ─────────────────────────────

export const customerInputSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court').max(120),
  phone,
  email,
  address: text(160),
  ninea: text(30),
  creditLimit: moneySchema.max(1_000_000_000).default(0),
  notes: text(300),
})
export type CustomerInput = z.infer<typeof customerInputSchema>
export const customerUpdateSchema = customerInputSchema.partial().extend({ active: z.boolean().optional() })
export type CustomerUpdate = z.infer<typeof customerUpdateSchema>

export const supplierInputSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court').max(120),
  phone,
  email,
  address: text(160),
  ninea: text(30),
})
export type SupplierInput = z.infer<typeof supplierInputSchema>
export const supplierUpdateSchema = supplierInputSchema.partial().extend({ active: z.boolean().optional() })
export type SupplierUpdate = z.infer<typeof supplierUpdateSchema>

// ───────────────────────────── Documents ─────────────────────────────

const lineSchema = z.object({
  productId: uuid,
  quantity: quantitySchema,
  discountRate: percentSchema.default(0),
})

export const quoteInputSchema = z.object({
  customerId: uuid.optional(),
  lines: z.array(lineSchema).min(1, 'Aucune ligne').max(200),
  notes: text(500),
})
export type QuoteInput = z.infer<typeof quoteInputSchema>

/** Règlement d'un document : argent réel uniquement. */
export const documentPaymentSchema = z.object({
  method: moneyMethodSchema,
  amount: moneySchema.positive('Montant obligatoire'),
  reference: z.string().trim().max(100).optional(),
})
export type DocumentPayment = z.infer<typeof documentPaymentSchema>

export const quoteConvertSchema = z.object({
  clientRequestId: uuid,
  payments: z.array(documentPaymentSchema).max(6).default([]),
})
export type QuoteConvert = z.infer<typeof quoteConvertSchema>

/** Retour client / avoir : quantités rendues par ligne du document d'origine. */
export const refundInputSchema = z.object({
  clientRequestId: uuid,
  lines: z
    .array(z.object({ lineId: uuid, quantity: quantitySchema }))
    .min(1, 'Aucun article rendu')
    .max(200),
  /** Comment l'argent est rendu (après imputation sur le reste dû éventuel). */
  refundMethod: moneyMethodSchema,
  reason: z.string().trim().min(3, 'Motif obligatoire').max(200),
})
export type RefundInput = z.infer<typeof refundInputSchema>

/** Encaissement sur le compte d'un client (réparti sur les factures les plus anciennes). */
export const accountPaymentSchema = z.object({
  clientRequestId: uuid,
  method: moneyMethodSchema,
  amount: moneySchema.positive('Montant obligatoire'),
  reference: z.string().trim().max(100).optional(),
})
export type AccountPayment = z.infer<typeof accountPaymentSchema>

// ───────────────────────────── Achats ─────────────────────────────

export const purchaseInputSchema = z.object({
  clientRequestId: uuid,
  supplierId: uuid,
  warehouseId: uuid,
  supplierRef: z.string().trim().max(60).optional(),
  dueDate: z.iso.date().optional(),
  notes: text(300),
  lines: z
    .array(z.object({ productId: uuid, quantity: quantitySchema, unitCost: moneySchema }))
    .min(1, 'Aucune ligne')
    .max(300),
  payments: z.array(documentPaymentSchema).max(6).default([]),
})
export type PurchaseInput = z.infer<typeof purchaseInputSchema>

export const supplierPaymentSchema = accountPaymentSchema
export type SupplierPayment = AccountPayment

// ───────────────────────────── Inventaire ─────────────────────────────

export const inventoryBatchSchema = z.object({
  warehouseId: uuid,
  counts: z
    .array(z.object({ productId: uuid, countedQuantity: z.number().min(0).multipleOf(0.001) }))
    .min(1, 'Aucun article compté')
    .max(2000),
  reason: z.string().trim().max(200).optional(),
})
export type InventoryBatch = z.infer<typeof inventoryBatchSchema>

// ───────────────────────────── Réponses ─────────────────────────────

export type CustomerRow = {
  id: string
  code: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  ninea: string | null
  creditLimit: number
  notes: string | null
  active: boolean
  /** Reste dû total. */
  balance: number
  /** Dont échu (échéance dépassée). */
  overdue: number
}

export type SupplierRow = {
  id: string
  code: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  ninea: string | null
  active: boolean
  /** Ce que la boutique doit encore à ce fournisseur. */
  balance: number
}

export type DocumentKind = 'QUOTE' | 'TICKET' | 'INVOICE' | 'CREDIT_NOTE'

export const documentKindLabels: Record<DocumentKind, string> = {
  QUOTE: 'Devis',
  TICKET: 'Ticket',
  INVOICE: 'Facture',
  CREDIT_NOTE: 'Avoir',
}

export type DocumentRow = {
  id: string
  kind: DocumentKind
  number: string
  issuedAt: string
  dueDate: string | null
  validUntil: string | null
  customer: { id: string; name: string } | null
  total: number
  amountPaid: number
  /** Reste dû (factures / tickets à crédit). */
  balance: number
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | 'OPEN' | 'CONVERTED' | 'EXPIRED' | 'SETTLED'
  sourceNumber: string | null
  user: string
}

export const documentStatusLabels: Record<DocumentRow['status'], string> = {
  PAID: 'Payée',
  PARTIAL: 'Partielle',
  UNPAID: 'Impayée',
  OVERDUE: 'En retard',
  OPEN: 'En cours',
  CONVERTED: 'Convertie',
  EXPIRED: 'Expirée',
  SETTLED: 'Remboursé',
}

export type DocumentLine = {
  id: string
  productId: string | null
  sku: string | null
  description: string
  unit: string | null
  quantity: number
  unitPrice: number
  discountRate: number
  vatRate: number
  lineTotal: number
  /** Quantité déjà rendue (avoirs), pour un ticket ou une facture. */
  returnedQuantity: number
}

export type DocumentDetail = DocumentRow & {
  warehouse: { code: string; name: string }
  customerDetail: Pick<CustomerRow, 'id' | 'code' | 'name' | 'phone' | 'address' | 'ninea'> | null
  company: {
    name: string
    legalForm: string | null
    address: string | null
    phone: string | null
    email: string | null
    ninea: string | null
    rccm: string | null
  }
  lines: DocumentLine[]
  subtotal: number
  discount: number
  vat: { rate: number; base: number; vat: number }[]
  vatTotal: number
  payments: { method: PaymentMethod; direction: 'IN' | 'OUT'; amount: number; reference: string | null; at: string }[]
  notes: string | null
  hash: string | null
  /** Avoirs émis sur ce document. */
  creditNotes: { id: string; number: string; total: number }[]
}

export type AgingBucket = { label: string; amount: number }

export type ReceivablesReport = {
  total: number
  overdue: number
  buckets: AgingBucket[]
  customers: (CustomerRow & { oldestDueDate: string | null })[]
}

export type PurchaseRow = {
  id: string
  number: string
  receivedAt: string
  supplier: { id: string; name: string }
  supplierRef: string | null
  warehouse: string
  total: number
  amountPaid: number
  balance: number
  dueDate: string | null
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE'
  user: string
}

export type PurchaseDetail = PurchaseRow & {
  lines: { productId: string; sku: string; name: string; unit: string; quantity: number; unitCost: number; lineTotal: number }[]
  payments: { method: PaymentMethod; amount: number; reference: string | null; at: string }[]
  notes: string | null
}

export type InventoryReport = {
  adjusted: number
  unchanged: number
  /** Valeur des écarts au PMP (négatif = perte). */
  valueDifference: number
  lines: { productId: string; sku: string; name: string; before: number; counted: number; difference: number }[]
}

/** Répartit un montant sur des dettes, de la plus ancienne à la plus récente. */
export function allocateOldestFirst<T extends { id: string; balance: number }>(
  debts: T[],
  amount: number,
): { allocations: { id: string; amount: number }[]; unallocated: number } {
  let left = amount
  const allocations: { id: string; amount: number }[] = []
  for (const d of debts) {
    if (left <= 0) break
    const a = Math.min(left, d.balance)
    if (a > 0) {
      allocations.push({ id: d.id, amount: a })
      left -= a
    }
  }
  return { allocations, unallocated: left }
}

/** Statut de règlement d'une dette. */
export function debtStatus(total: number, paid: number, dueDate: Date | string | null, now = new Date()) {
  const balance = Math.max(0, total - paid)
  if (balance === 0) return 'PAID' as const
  if (dueDate && new Date(dueDate) < now) return 'OVERDUE' as const
  return paid > 0 ? ('PARTIAL' as const) : ('UNPAID' as const)
}

/** Échéances : 0-30, 31-60, 61-90, plus de 90 jours de retard. */
export function agingBucketIndex(dueDate: Date | string | null, now = new Date()): number {
  if (!dueDate) return 0
  const days = Math.floor((now.getTime() - new Date(dueDate).getTime()) / 86_400_000)
  if (days <= 0) return -1 // pas encore échu
  if (days <= 30) return 0
  if (days <= 60) return 1
  if (days <= 90) return 2
  return 3
}
export const agingLabels = ['1 à 30 jours', '31 à 60 jours', '61 à 90 jours', 'Plus de 90 jours']
