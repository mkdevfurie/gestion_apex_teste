import { z } from 'zod'

// Doit rester aligné sur les enums de apps/api/prisma/schema.prisma.
export const roleSchema = z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'STOCK_KEEPER'])
export type Role = z.infer<typeof roleSchema>

export const paymentMethodSchema = z.enum([
  'CASH',
  'WAVE',
  'ORANGE_MONEY',
  'FREE_MONEY',
  'BANK_TRANSFER',
  'CHEQUE',
  'CARD',
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
}

export const moneySchema = z.number().int().nonnegative()
export const quantitySchema = z.number().positive().multipleOf(0.001)
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
