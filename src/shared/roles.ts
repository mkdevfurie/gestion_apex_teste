// Rôles et permissions — sans dépendance (pas de Zod) : importable partout,
// y compris dans le code chargé au démarrage des interfaces.
// Doit rester aligné sur l'enum Role du schéma Prisma (dépôt backend).

export const roles = ['ADMIN', 'MANAGER', 'CASHIER', 'STOCK_KEEPER'] as const
export type Role = (typeof roles)[number]

export const isRole = (v: unknown): v is Role => (roles as readonly unknown[]).includes(v)

export const roleLabels: Record<Role, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Gérant',
  CASHIER: 'Caissier',
  STOCK_KEEPER: 'Magasinier',
}

/** Qui peut faire quoi. Source unique pour l'API (garde) et les interfaces (menus). */
export const permissions = {
  /** Créer / modifier des articles et catégories. */
  manageCatalog: ['ADMIN', 'MANAGER'],
  /** Réceptions, pertes, retours, inventaires, transferts. */
  moveStock: ['ADMIN', 'MANAGER', 'STOCK_KEEPER'],
  /** Accès au dashboard d'administration. */
  accessAdmin: ['ADMIN', 'MANAGER'],
  /** Voir la liste des comptes. */
  viewUsers: ['ADMIN', 'MANAGER'],
  /** Créer des comptes, changer les rôles, désactiver, réinitialiser. */
  manageUsers: ['ADMIN'],
  /** Encaisser à la caisse (ouvrir / clôturer sa session). */
  sell: ['ADMIN', 'MANAGER', 'CASHIER'],
  /** Accorder une remise sur une ligne de vente. */
  grantDiscount: ['ADMIN', 'MANAGER'],
  /** Tableaux de bord, ventes de tous, caisses, journal d'activité. */
  viewReports: ['ADMIN', 'MANAGER'],
  /** Clients : fiches, comptes, encaissements de créances. */
  manageCustomers: ['ADMIN', 'MANAGER', 'CASHIER'],
  /** Devis, factures A4, avoirs (retours clients). */
  issueInvoices: ['ADMIN', 'MANAGER'],
  /** Fournisseurs, réceptions d'achats. */
  managePurchases: ['ADMIN', 'MANAGER', 'STOCK_KEEPER'],
  /** Régler les fournisseurs (sortie d'argent). */
  paySuppliers: ['ADMIN', 'MANAGER'],
  /** Voir les coûts d'achat (PMP), la valorisation et les marges. */
  viewCosts: ['ADMIN', 'MANAGER', 'STOCK_KEEPER'],
  /** Paramètres, société, dépôts. */
  manageSettings: ['ADMIN'],
} as const satisfies Record<string, readonly Role[]>

export type Permission = keyof typeof permissions

export function can(role: Role | undefined, permission: Permission): boolean {
  return role !== undefined && (permissions[permission] as readonly Role[]).includes(role)
}

export type AuthUser = {
  id: string
  email: string
  name: string
  role: Role
  /** Mot de passe provisoire : à changer avant toute autre action. */
  mustChangePassword: boolean
}

/** Vérification légère d'un utilisateur relu depuis le stockage local. */
export function isAuthUser(v: unknown): v is AuthUser {
  const u = v as Partial<AuthUser> | null
  return (
    typeof u === 'object' &&
    u !== null &&
    typeof u.id === 'string' &&
    typeof u.email === 'string' &&
    typeof u.name === 'string' &&
    typeof u.mustChangePassword === 'boolean' &&
    isRole(u.role)
  )
}

/** Compte vu depuis l'écran « Utilisateurs & rôles ». */
export type UserRow = {
  id: string
  email: string
  name: string
  role: Role
  active: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdAt: string
}

/** Réponse à une création / réinitialisation : le mot de passe n'est montré qu'une fois. */
export type TemporaryPasswordResponse = { user: UserRow; temporaryPassword: string }

export type LoginResponse = {
  token: string
  expiresAt: string
  user: AuthUser
}
