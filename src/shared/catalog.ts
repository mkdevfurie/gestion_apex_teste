import { z } from 'zod'
import { moneySchema, percentSchema, quantitySchema } from './schemas.js'

// ───────────────────────────── Mouvements de stock ─────────────────────────────
// Doit rester aligné sur l'enum MovementType du schéma Prisma (dépôt backend).

export const inboundTypes = ['PURCHASE_RECEIPT', 'CUSTOMER_RETURN', 'ADJUSTMENT_IN', 'TRANSFER_IN'] as const
export const outboundTypes = ['SALE', 'LOSS', 'SUPPLIER_RETURN', 'ADJUSTMENT_OUT', 'TRANSFER_OUT'] as const

export const movementTypeSchema = z.enum([...inboundTypes, ...outboundTypes])
export type MovementType = z.infer<typeof movementTypeSchema>

export const movementTypeLabels: Record<MovementType, string> = {
  PURCHASE_RECEIPT: 'Réception fournisseur',
  CUSTOMER_RETURN: 'Retour client',
  ADJUSTMENT_IN: 'Ajustement +',
  TRANSFER_IN: 'Transfert entrant',
  SALE: 'Vente',
  LOSS: 'Perte / casse',
  SUPPLIER_RETURN: 'Retour fournisseur',
  ADJUSTMENT_OUT: 'Ajustement −',
  TRANSFER_OUT: 'Transfert sortant',
}

export function isInbound(type: MovementType): boolean {
  return (inboundTypes as readonly string[]).includes(type)
}

/**
 * Mouvements saisissables à la main depuis le catalogue.
 * Les ventes passent par la caisse, les transferts et ajustements par leurs
 * propres écrans (ils créent des mouvements liés).
 */
export const manualMovementTypes = ['PURCHASE_RECEIPT', 'CUSTOMER_RETURN', 'LOSS', 'SUPPLIER_RETURN'] as const
export const manualMovementTypeSchema = z.enum(manualMovementTypes)

const uuid = z.string().uuid()
const reasonSchema = z.string().trim().max(200).optional()

/** Saisie d'un mouvement : la quantité est toujours positive, le sens vient du type. */
export const movementInputSchema = z
  .object({
    type: manualMovementTypeSchema,
    productId: uuid,
    warehouseId: uuid,
    quantity: quantitySchema,
    /** Coût unitaire d'achat HT, obligatoire pour une réception (recalcul du PMP). */
    unitCost: moneySchema.optional(),
    reason: reasonSchema,
  })
  .refine((m) => m.type !== 'PURCHASE_RECEIPT' || m.unitCost !== undefined, {
    message: "Le coût d'achat est obligatoire pour une réception",
    path: ['unitCost'],
  })
export type MovementInput = z.infer<typeof movementInputSchema>

/** Inventaire : on saisit la quantité comptée, l'API calcule l'écart. */
export const inventoryCountSchema = z.object({
  productId: uuid,
  warehouseId: uuid,
  countedQuantity: z.number().min(0).multipleOf(0.001),
  reason: reasonSchema,
})
export type InventoryCount = z.infer<typeof inventoryCountSchema>

export const transferInputSchema = z
  .object({
    productId: uuid,
    fromWarehouseId: uuid,
    toWarehouseId: uuid,
    quantity: quantitySchema,
    reason: reasonSchema,
  })
  .refine((t) => t.fromWarehouseId !== t.toWarehouseId, {
    message: 'Les dépôts de départ et d’arrivée doivent être différents',
    path: ['toWarehouseId'],
  })
export type TransferInput = z.infer<typeof transferInputSchema>

// ───────────────────────────── Articles ─────────────────────────────

export const productInputSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .transform((s) => s.toUpperCase()),
  barcode: z
    .string()
    .trim()
    .regex(/^\d{8,14}$/, 'Code-barres : 8 à 14 chiffres (EAN-8, EAN-13…)')
    .optional(),
  name: z.string().trim().min(2).max(160),
  categoryId: uuid.optional(),
  unit: z.string().trim().min(1).max(30),
  salePrice: moneySchema,
  vatRate: percentSchema.default(18),
  alertThreshold: z.number().min(0).multipleOf(0.001).default(0),
  location: z.string().trim().max(60).optional(),
})
export type ProductInput = z.infer<typeof productInputSchema>

export const productUpdateSchema = productInputSchema.partial().extend({
  active: z.boolean().optional(),
})
export type ProductUpdate = z.infer<typeof productUpdateSchema>

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
})

// ───────────────────────────── État du stock ─────────────────────────────

export const stockStatusSchema = z.enum(['OK', 'LOW', 'OUT'])
export type StockStatus = z.infer<typeof stockStatusSchema>

export const stockStatusLabels: Record<StockStatus, string> = {
  OK: 'En stock',
  LOW: 'Stock bas',
  OUT: 'Rupture',
}

/** Rupture si ≤ 0, stock bas si ≤ seuil d'alerte (seuil > 0), sinon OK. */
export function stockStatus(quantity: number, alertThreshold: number): StockStatus {
  if (quantity <= 0) return 'OUT'
  if (alertThreshold > 0 && quantity <= alertThreshold) return 'LOW'
  return 'OK'
}

/** Prix TTC arrondi au franc. */
export function priceWithVat(priceHt: number, vatRate: number): number {
  return Math.round(priceHt * (1 + vatRate / 100))
}

/**
 * Prix moyen pondéré (PMP) après une réception.
 * Un stock négatif ou nul ne doit pas « diluer » le coût : on repart du coût d'achat.
 */
export function weightedAverageCost(
  currentQty: number,
  currentCost: number,
  receivedQty: number,
  receivedCost: number,
): number {
  if (currentQty <= 0) return receivedCost
  return Math.round((currentQty * currentCost + receivedQty * receivedCost) / (currentQty + receivedQty))
}

// ───────────────────────────── Réponses API ─────────────────────────────

export type ProductRow = {
  id: string
  sku: string
  barcode: string | null
  name: string
  category: { id: string; name: string } | null
  unit: string
  salePrice: number
  vatRate: number
  averageCost: number
  alertThreshold: number
  location: string | null
  active: boolean
  /** Stock du dépôt filtré (ou tous dépôts). */
  stock: number
  status: StockStatus
}

export type CatalogSummary = {
  valuation: number
  activeCount: number
  lowCount: number
  outCount: number
  movementCount: number
}

export type ProductPage = {
  items: ProductRow[]
  total: number
  page: number
  pageSize: number
  summary: CatalogSummary
}

export type MovementRow = {
  id: string
  type: MovementType
  quantity: number
  unitCost: number
  balanceAfter: number
  reason: string | null
  createdAt: string
  product: { id: string; sku: string; name: string; unit: string }
  warehouse: { id: string; code: string; name: string }
  user: { id: string; name: string }
}

export type ProductDetail = ProductRow & {
  stockByWarehouse: { warehouseId: string; code: string; name: string; quantity: number }[]
  movements: MovementRow[]
}

export type Warehouse = { id: string; code: string; name: string; address: string | null; active: boolean }
export type Category = { id: string; name: string; productCount: number }
