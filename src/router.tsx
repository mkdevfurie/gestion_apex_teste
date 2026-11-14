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
import { LoginPage } from '@/routes/login'
import { HomePage } from '@/routes/home'
import { MesVentesPage } from '@/routes/mes-ventes'
import { ClientsPage } from '@/routes/clients'
import { DocumentsPage } from '@/routes/documents'
import { DocumentPage } from '@/routes/document'
import { AchatsPage } from '@/routes/achats'
import { InventairePage } from '@/routes/inventaire'

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

const routeTree = rootRoute.addChildren([
  loginRoute,
  passwordRoute,
  appRoute.addChildren([
    createRoute({ getParentRoute: () => appRoute, path: '/', component: HomePage }),
    createRoute({ getParentRoute: () => appRoute, path: '/caisse', component: CaissePage }),
    createRoute({ getParentRoute: () => appRoute, path: '/mes-ventes', component: MesVentesPage }),
    createRoute({ getParentRoute: () => appRoute, path: '/catalogue', component: CataloguePage }),
    createRoute({ getParentRoute: () => appRoute, path: '/clients', component: ClientsPage }),
    createRoute({ getParentRoute: () => appRoute, path: '/documents', component: DocumentsPage }),
    createRoute({ getParentRoute: () => appRoute, path: '/documents/$id', component: DocumentPage }),
    createRoute({ getParentRoute: () => appRoute, path: '/achats', component: AchatsPage }),
    createRoute({ getParentRoute: () => appRoute, path: '/inventaire', component: InventairePage }),
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
