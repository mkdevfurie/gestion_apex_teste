import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, Outlet, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import {
  Boxes,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  Settings,
  ShoppingCart,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLogout } from '@/features/auth/auth-actions'
import { api } from '@/lib/api'
import { session, useSession } from '@/lib/session'
import { roleLabels, type AuthUser } from '@/shared'
import { ApiStatus } from './api-status'

const nav = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/caisse', label: 'Point de vente & caisse', icon: ShoppingCart },
  { to: '/catalogue', label: 'Catalogue & stock', icon: Boxes },
  { to: '/factures', label: 'Factures & créances', icon: FileText },
  { to: '/tiers', label: 'Clients & tiers', icon: Users },
  { to: '/parametres', label: 'Paramètres', icon: Settings },
] as const

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

  // Session expirée ou révoquée pendant l'utilisation (réponse 401).
  if (!current) {
    return <Navigate to="/connexion" search={{ redirect: location.href, expired: true }} replace />
  }
  const { user } = current
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-sidebar-border bg-sidebar md:sticky md:top-0 md:h-svh md:w-64 md:border-r md:border-b-0">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <Landmark className="size-5" />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="font-semibold">Apex Ledger</div>
            <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              ERP Commerce
            </div>
          </div>
          {/* Mobile : déconnexion accessible sans la barre latérale */}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={logout} aria-label="Se déconnecter">
            <LogOut />
          </Button>
        </div>

        <nav aria-label="Navigation principale" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === '/' }}
              className="flex shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto hidden space-y-2 p-3 md:block">
          <ApiStatus />
          <div className="flex items-center gap-3 rounded-md border bg-background px-3 py-2">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" aria-hidden>
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-xs text-muted-foreground">{roleLabels[user.role]}</div>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={logout} aria-label="Se déconnecter" title="Se déconnecter">
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
