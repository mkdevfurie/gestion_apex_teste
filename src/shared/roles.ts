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
} as const satisfies Record<string, readonly Role[]>

export type Permission = keyof typeof permissions

export function can(role: Role | undefined, permission: Permission): boolean {
  return role !== undefined && (permissions[permission] as readonly Role[]).includes(role)
}

export type AuthUser = { id: string; email: string; name: string; role: Role }

/** Vérification légère d'un utilisateur relu depuis le stockage local. */
export function isAuthUser(v: unknown): v is AuthUser {
  const u = v as Partial<AuthUser> | null
  return (
    typeof u === 'object' &&
    u !== null &&
    typeof u.id === 'string' &&
    typeof u.email === 'string' &&
    typeof u.name === 'string' &&
    isRole(u.role)
  )
}

export type LoginResponse = {
  token: string
  expiresAt: string
  user: AuthUser
}
