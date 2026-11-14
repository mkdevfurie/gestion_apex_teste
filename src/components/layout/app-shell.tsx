import { Link, Outlet } from '@tanstack/react-router'
import {
  Boxes,
  FileText,
  Landmark,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  Users,
} from 'lucide-react'
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
  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-sidebar-border bg-sidebar md:sticky md:top-0 md:h-svh md:w-64 md:border-r md:border-b-0">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <Landmark className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold">Apex Ledger</div>
            <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              ERP Commerce
            </div>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
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

        <div className="mt-auto hidden p-3 md:block">
          <ApiStatus />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-6">
        <Outlet />
      </main>
    </div>
  )
}
