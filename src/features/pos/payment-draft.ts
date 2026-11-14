import type { PaymentMethod } from '@/shared'

/** Paiement en cours de saisie (montant tel que tapé). */
export type PaymentDraft = { key: string; method: PaymentMethod; amount: string; reference: string }

export const newPayment = (method: PaymentMethod = 'CASH', amount = ''): PaymentDraft => ({
  key: crypto.randomUUID(),
  method,
  amount,
  reference: '',
})
