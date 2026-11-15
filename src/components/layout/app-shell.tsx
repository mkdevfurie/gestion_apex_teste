import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, Outlet, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import {
  Boxes,
  ClipboardCheck,
  FileText,
  PackagePlus,
  Users,
  ExternalLink,
  Landmark,
  LayoutDashboard,
  LogOut,
  Receipt,
  ShoppingCart,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useLogout } from '@/features/auth/auth-actions'
import { api } from '@/lib/api'
import { session, useSession } from '@/lib/session'
import { ADMIN_URL } from '@/features/reports/admin-url'
import { can, roleLabels, type AuthUser, type Role } from '@/shared'
import { ApiStatus } from './api-status'

type NavItem = { to: '/' | '/caisse' | '/mes-ventes' | '/catalogue' | '/clients' | '/documents' | '/achats' | '/inventaire'; label: string; icon: LucideIcon }

/** Chaque rôle ne voit que ses outils. */
function navFor(role: Role): NavItem[] {
  switch (role) {
    case 'CASHIER':
      return [
        { to: '/caisse', label: 'Caisse', icon: ShoppingCart },
        { to: '/mes-ventes', label: 'Mes ventes', icon: Receipt },
        { to: '/clients', label: 'Clients', icon: Users },
        { to: '/catalogue', label: 'Prix & stock', icon: Boxes },
      ]
    case 'STOCK_KEEPER':
      return [
        { to: '/', label: 'Tableau du magasin', icon: Warehouse },
        { to: '/catalogue', label: 'Catalogue & mouvements', icon: Boxes },
        { to: '/achats', label: 'Réceptions fournisseurs', icon: PackagePlus },
        { to: '/inventaire', label: 'Inventaire', icon: ClipboardCheck },
      ]
    default:
      return [
        { to: '/', label: 'Tableau de bord', icon: LayoutDashboard },
        { to: '/caisse', label: 'Caisse', icon: ShoppingCart },
        { to: '/mes-ventes', label: 'Mes ventes', icon: Receipt },
        { to: '/clients', label: 'Clients & créances', icon: Users },
        { to: '/documents', label: 'Factures & devis', icon: FileText },
        { to: '/achats', label: 'Achats & fournisseurs', icon: PackagePlus },
        { to: '/catalogue', label: 'Catalogue & stock', icon: Boxes },
        { to: '/inventaire', label: 'Inventaire', icon: ClipboardCheck },
      ]
  }
}

/** Repère visuel de l'espace : couleur et intitulé par rôle. */
type Space = { id: 'caisse' | 'magasin' | 'gerant'; label: string; icon: LucideIcon; color: string }
const spaces: Record<Role, Space> = {
  CASHIER: { id: 'caisse', label: 'Espace caisse', icon: ShoppingCart, color: '#053b36' },
  STOCK_KEEPER: { id: 'magasin', label: 'Espace magasin', icon: Warehouse, color: '#3b1a0b' },
  MANAGER: { id: 'gerant', label: 'Espace gérant', icon: Landmark, color: '#0c1f4d' },
  ADMIN: { id: 'gerant', label: 'Espace gérant', icon: Landmark, color: '#0c1f4d' },
}

/** Pose le thème de l'espace sur <html> (couleurs, barre du navigateur mobile). */
function useSpaceTheme(space: Space | undefined) {
  useEffect(() => {
    if (!space) return
    const root = document.documentElement
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const previous = meta?.content
    root.dataset.space = space.id
    if (meta) meta.content = space.color
    return () => {
      delete root.dataset.space
      if (meta && previous) meta.content = previous
    }
  }, [space])
}

export function AppShell() {
  const current = useSession()
  const location = useLocation()
  const logout = useLogout()

  // Le serveur fait foi : rôle modifié ou compte désactivé depuis la connexion.
  // (Un 401 ferme la session via le client API.)
  const me = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api<AuthUser>('/auth/me'),
    enabled: Boolean(current),
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  })
  useEffect(() => {
    if (me.data) session.updateUser(me.data)
  }, [me.data])
  useSpaceTheme(current ? spaces[current.user.role] : undefined)

  // Session expirée ou révoquée pendant l'utilisation (réponse 401).
  if (!current) {
    return <Navigate to="/connexion" search={{ redirect: location.href, expired: true }} replace />
  }
  // Mot de passe réinitialisé par un administrateur pendant la session.
  if (current.user.mustChangePassword) return <Navigate to="/mot-de-passe" replace />
  const { user } = current
  const nav = navFor(user.role)
  const space = spaces[user.role]
  const SpaceIcon = space.icon
  const touch = space.id === 'caisse'
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-svh md:w-64">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="grid size-10 place-items-center rounded-lg bg-sidebar-brand text-sidebar-brand-foreground shadow-sm">
            <SpaceIcon className="size-5" />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="font-semibold">Apex Ledger</div>
            <div className="text-[11px] font-semibold tracking-wider text-sidebar-muted uppercase">{space.label}</div>
          </div>
          {/* Mobile : déconnexion accessible sans la barre latérale */}
          <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden" onClick={logout} aria-label="Se déconnecter">
            <LogOut />
          </Button>
        </div>

        <nav aria-label="Navigation principale" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === '/' }}
              className={cn(
                'flex shrink-0 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-[3px] focus-visible:ring-white/40 focus-visible:outline-none data-[status=active]:bg-sidebar-primary data-[status=active]:text-sidebar-primary-foreground',
                touch ? 'py-3 text-base' : 'py-2',
              )}
            >
              <Icon className={touch ? 'size-5' : 'size-4'} />
              {label}
            </Link>
          ))}
          {can(user.role, 'accessAdmin') && (
            <a
              href={ADMIN_URL}
              target="_blank"
              rel="noreferrer"
              className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground md:mt-2 md:border-t md:border-sidebar-border md:pt-3"
            >
              <ExternalLink className="size-4" />
              Console d’administration
            </a>
          )}
        </nav>

        <div className="mt-auto hidden space-y-2 p-3 md:block">
          <ApiStatus />
          <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent px-3 py-2">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground" aria-hidden>
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <Link to="/mot-de-passe" className="truncate text-xs text-sidebar-muted underline-offset-2 hover:underline">
                {roleLabels[user.role]} · mot de passe
              </Link>
            </div>
            <Button variant="ghost" size="icon-sm" className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={logout} aria-label="Se déconnecter" title="Se déconnecter">
              <LogOut />
            </Button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-6">
        <Outlet />
      </main>
    </div>
  )
}
