import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { z } from 'zod'
import { AppShell } from '@/components/layout/app-shell'
import { session } from '@/lib/session'
import { CaissePage } from '@/routes/caisse'
import { CataloguePage } from '@/routes/catalogue'
import { ChangePasswordPage } from '@/routes/change-password'
import { DashboardPage } from '@/routes/dashboard'
import { LoginPage } from '@/routes/login'
import { PlaceholderPage } from '@/routes/placeholder'

const rootRoute = createRootRoute({ component: Outlet })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/connexion',
  validateSearch: z.object({
    redirect: z.string().optional(),
    expired: z.boolean().optional(),
  }),
  beforeLoad: () => {
    if (session.get()) throw redirect({ to: '/' })
  },
  component: LoginPage,
})

const passwordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mot-de-passe',
  beforeLoad: ({ location }) => {
    if (!session.get()) throw redirect({ to: '/connexion', search: { redirect: location.href } })
  },
  component: ChangePasswordPage,
})

/** Tout ce qui est sous cette route exige une session (et un mot de passe définitif). */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: ({ location }) => {
    if (!session.get()) {
      throw redirect({ to: '/connexion', search: { redirect: location.href } })
    }
    if (session.get()?.user.mustChangePassword) throw redirect({ to: '/mot-de-passe' })
  },
  component: AppShell,
})

const page = (path: string, title: string, description: string) =>
  createRoute({
    getParentRoute: () => appRoute,
    path,
    component: () => <PlaceholderPage title={title} description={description} />,
  })

const routeTree = rootRoute.addChildren([
  loginRoute,
  passwordRoute,
  appRoute.addChildren([
    createRoute({ getParentRoute: () => appRoute, path: '/', component: DashboardPage }),
    createRoute({ getParentRoute: () => appRoute, path: '/caisse', component: CaissePage }),
    createRoute({ getParentRoute: () => appRoute, path: '/catalogue', component: CataloguePage }),
    page('/factures', 'Factures & créances', 'Factures, avoirs, règlements partiels et balance âgée.'),
    page('/tiers', 'Clients & tiers', 'Fiches clients et fournisseurs, encours et plafonds de crédit.'),
    page('/parametres', 'Paramètres', 'Entreprise, dépôts, utilisateurs et rôles.'),
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
