import { z } from 'zod'
import { moneySchema, percentSchema, type PaymentMethod } from './schemas.js'
import type { Role } from './roles.js'

// ───────────────────────────── Paramètres ─────────────────────────────

export type AppSettings = {
  defaultVatRate: number
  defaultAlertThreshold: number
  maxDiscountRate: number
  cashDifferenceTolerance: number
  minOpeningFloat: number
  receiptFooter: string
  paymentTermDays: number
  quoteValidityDays: number
  cashierCanSellOnCredit: boolean
}

export const defaultSettings: AppSettings = {
  defaultVatRate: 18,
  defaultAlertThreshold: 5,
  maxDiscountRate: 10,
  cashDifferenceTolerance: 500,
  minOpeningFloat: 0,
  receiptFooter: 'Merci de votre visite !',
  paymentTermDays: 30,
  quoteValidityDays: 15,
  cashierCanSellOnCredit: false,
}

export const settingsUpdateSchema = z
  .object({
    defaultVatRate: z.union([z.literal(0), z.literal(10), z.literal(18)], { error: 'TVA : 0, 10 ou 18 %' }),
    defaultAlertThreshold: z.number().min(0).max(1_000_000).multipleOf(0.001),
    maxDiscountRate: percentSchema.max(50, 'Remise maximale : 50 %'),
    cashDifferenceTolerance: moneySchema.max(1_000_000),
    minOpeningFloat: moneySchema.max(10_000_000),
    receiptFooter: z.string().trim().max(160),
    paymentTermDays: z.number().int().min(0).max(365),
    quoteValidityDays: z.number().int().min(1).max(365),
    cashierCanSellOnCredit: z.boolean(),
  })
  .partial()
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()

export type CompanyInfo = {
  name: string
  legalForm: string | null
  ninea: string | null
  rccm: string | null
  address: string | null
  phone: string | null
  email: string | null
}

export const companyUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court').max(120),
  legalForm: optionalText(30),
  ninea: optionalText(30),
  rccm: optionalText(40),
  address: optionalText(160),
  phone: optionalText(40),
  email: z
    .string()
    .trim()
    .max(120)
    .transform((v) => (v === '' ? null : v))
    .pipe(z.string().email('Adresse e-mail invalide').nullable())
    .nullable()
    .optional(),
})
export type CompanyUpdate = z.infer<typeof companyUpdateSchema>

export const warehouseCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{2,12}$/, 'Code : 2 à 12 lettres, chiffres ou tirets')
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2).max(80),
  address: optionalText(160),
})
export type WarehouseCreate = z.infer<typeof warehouseCreateSchema>

export const warehouseUpdateSchema = z
  .object({ name: z.string().trim().min(2).max(80), address: optionalText(160), active: z.boolean() })
  .partial()
export type WarehouseUpdate = z.infer<typeof warehouseUpdateSchema>

// ───────────────────────────── Rapports ─────────────────────────────

/** Période d'analyse : dates ISO (jour inclus). */
export const periodSchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
})
export type Period = z.infer<typeof periodSchema>

export type Overview = {
  period: { from: string; to: string }
  salesTotal: number
  salesHt: number
  ticketCount: number
  averageBasket: number
  /** Ventes HT − coût (PMP au moment de la vente). */
  grossMargin: number
  marginRate: number
  stockValuation: number
  lowStockCount: number
  outOfStockCount: number
  openSessions: number
  /** Sessions clôturées dont l'écart dépasse la tolérance. */
  cashAlerts: number
  cashDifferenceTotal: number
  activeUsers: number
  byMethod: { method: PaymentMethod; amount: number }[]
}

export type DailySales = { day: string; total: number; tickets: number }[]

export type EmployeeStats = {
  userId: string
  name: string
  role: Role
  active: boolean
  ticketCount: number
  salesTotal: number
  averageBasket: number
  discountGiven: number
  sessions: number
  cashDifference: number
  stockMovements: number
  lastActivityAt: string | null
}

export type TopProduct = { productId: string; sku: string; name: string; unit: string; quantity: number; revenue: number }

export type AuditEntry = {
  id: string
  at: string
  action: string
  entity: string
  entityId: string | null
  user: { id: string; name: string; role: Role } | null
  data: unknown
}

export type CashSessionRow = {
  id: string
  warehouse: string
  openedBy: { id: string; name: string }
  openedAt: string
  closedAt: string | null
  openingFloat: number
  ticketCount: number
  salesTotal: number
  expectedCash: number | null
  countedCash: number | null
  difference: number | null
  /** Écart supérieur à la tolérance réglée dans les paramètres. */
  alert: boolean
}

export type SaleRow = {
  id: string
  number: string
  issuedAt: string
  total: number
  itemCount: number
  discount: number
  cashier: { id: string; name: string }
  warehouse: string
  methods: PaymentMethod[]
}

export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number }

/** Libellés lisibles du journal d'activité. */
export const auditActionLabels: Record<string, string> = {
  'auth.login': 'Connexion',
  'auth.login_failed': 'Échec de connexion',
  'auth.password_change': 'Mot de passe changé',
  'user.create': 'Compte créé',
  'user.update': 'Compte modifié',
  'user.password_reset': 'Mot de passe réinitialisé',
  'stock.movement': 'Mouvement de stock',
  'stock.inventory': 'Inventaire',
  'stock.transfer': 'Transfert',
  'sale.issue': 'Vente',
  'cash.open': 'Ouverture de caisse',
  'cash.close': 'Clôture de caisse',
  'settings.update': 'Paramètres modifiés',
  'company.update': 'Société modifiée',
  'warehouse.create': 'Dépôt créé',
  'warehouse.update': 'Dépôt modifié',
  'sale.credit': 'Vente à crédit',
  'invoice.issue': 'Facture émise',
  'quote.create': 'Devis créé',
  'quote.convert': 'Devis converti',
  'credit_note.issue': 'Avoir (retour client)',
  'customer.create': 'Client créé',
  'customer.update': 'Client modifié',
  'customer.payment': 'Règlement client',
  'supplier.create': 'Fournisseur créé',
  'supplier.update': 'Fournisseur modifié',
  'purchase.receive': 'Réception fournisseur',
  'supplier.payment': 'Règlement fournisseur',
  'stock.inventory_batch': 'Inventaire complet',
  'auth.locked': 'Compte verrouillé',
  'auth.session_revoke': 'Session révoquée',
}

/** Groupes de filtres du journal. */
export const auditCategories = {
  auth: 'Connexions',
  sale: 'Ventes',
  invoice: 'Factures',
  credit_note: 'Avoirs',
  customer: 'Clients',
  supplier: 'Fournisseurs',
  purchase: 'Achats',
  cash: 'Caisse',
  stock: 'Stock',
  user: 'Comptes',
  settings: 'Paramètres',
} as const
export type AuditCategory = keyof typeof auditCategories
