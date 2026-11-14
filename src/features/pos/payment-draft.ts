import type { PaymentMethod } from '@/shared'

/** Moyens de paiement réels (l'avoir imputé est réservé au serveur). */
export type MoneyMethod = Exclude<PaymentMethod, 'CREDIT_NOTE'>

/** Paiement en cours de saisie (montant tel que tapé). */
export type PaymentDraft = { key: string; method: MoneyMethod; amount: string; reference: string }

export const newPayment = (method: MoneyMethod = 'CASH', amount = ''): PaymentDraft => ({
  key: crypto.randomUUID(),
  method,
  amount,
  reference: '',
})
