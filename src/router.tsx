import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { AppShell } from '@/components/layout/app-shell'
import { DashboardPage } from '@/routes/dashboard'
import { PlaceholderPage } from '@/routes/placeholder'

const rootRoute = createRootRoute({ component: AppShell })

const page = (path: string, title: string, description: string) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => (
      <PlaceholderPage title={title} description={description} />
    ),
  })

const routeTree = rootRoute.addChildren([
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: DashboardPage,
  }),
  page('/caisse', 'Point de vente & caisse', 'Scan, panier, encaissement multi-moyens et ticket 80 mm.'),
  page('/catalogue', 'Catalogue & stock', 'Articles, niveaux de stock par dépôt et journal des mouvements.'),
  page('/factures', 'Factures & créances', 'Factures, avoirs, règlements partiels et balance âgée.'),
  page('/tiers', 'Clients & tiers', 'Fiches clients et fournisseurs, encours et plafonds de crédit.'),
  page('/parametres', 'Paramètres', 'Entreprise, dépôts, utilisateurs et rôles.'),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
