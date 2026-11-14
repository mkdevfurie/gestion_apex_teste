import { z } from 'zod'
import { roles } from './roles.js'

// Doit rester aligné sur les enums du schéma Prisma (dépôt backend).
export const roleSchema = z.enum(roles)

export const paymentMethodSchema = z.enum([
  'CASH',
  'WAVE',
  'ORANGE_MONEY',
  'FREE_MONEY',
  'BANK_TRANSFER',
  'CHEQUE',
  'CARD',
  'CREDIT_NOTE',
])
export type PaymentMethod = z.infer<typeof paymentMethodSchema>

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  FREE_MONEY: 'Free Money',
  BANK_TRANSFER: 'Virement',
  CHEQUE: 'Chèque',
  CARD: 'Carte',
  CREDIT_NOTE: 'Avoir imputé',
}

/** Montants FCFA : entiers, plafonnés (colonnes entières 32 bits en base). */
export const MAX_AMOUNT = 2_000_000_000
export const moneySchema = z.number().int().nonnegative().max(MAX_AMOUNT, 'Montant trop élevé')
export const quantitySchema = z.number().positive().max(1_000_000, 'Quantité trop élevée').multipleOf(0.001)
export const percentSchema = z.number().min(0).max(100)

export const saleLineInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: quantitySchema,
  unitPrice: moneySchema,
  discountRate: percentSchema.default(0),
  vatRate: percentSchema,
})
export type SaleLineInput = z.infer<typeof saleLineInputSchema>

export const paymentInputSchema = z.object({
  method: paymentMethodSchema,
  amount: moneySchema.positive(),
  reference: z.string().trim().max(100).optional(),
})
export type PaymentInput = z.infer<typeof paymentInputSchema>
