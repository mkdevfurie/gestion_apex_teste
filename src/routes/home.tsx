import { Navigate } from '@tanstack/react-router'
import { useUser } from '@/lib/session'
import { can } from '@/shared'
import { DashboardPage } from './dashboard'
import { MagasinPage } from './magasin'

/** Chaque rôle arrive sur SON écran. */
export function HomePage() {
  const { role } = useUser()
  if (can(role, 'viewReports')) return <DashboardPage />
  if (role === 'STOCK_KEEPER') return <MagasinPage />
  return <Navigate to="/caisse" replace />
}
