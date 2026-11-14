import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowRight, Banknote, Boxes, ExternalLink, Receipt, ShoppingCart, TrendingUp, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BarChart } from '@/components/bar-chart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Caps } from '@/features/catalog/ui'
import { ADMIN_URL } from '@/features/reports/admin-url'
import { useDaily, useEmployees, useOverview, useTopProducts } from '@/features/reports/queries'
import { formatQty } from '@/lib/format'
import { useUser } from '@/lib/session'
import { formatXof, paymentMethodLabels, roleLabels } from '@/shared'

/** Tableau de bord du gérant : la journée en cours, en données réelles. */
export function DashboardPage() {
  const user = useUser()
  const overview = useOverview()
  const daily = useDaily(14)
  const employees = useEmployees()
  const top = useTopProducts()
  const o = overview.data
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const activeToday = employees.data?.filter((e) => e.active && (e.ticketCount || e.stockMovements || e.sessions)) ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Caps>Aujourd’hui · {today}</Caps>
          <h1 className="text-2xl font-semibold tracking-tight">Bonjour {user.name.split(' ')[0]}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="success">
            <Link to="/caisse">
              <ShoppingCart /> Caisse
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a href={ADMIN_URL} target="_blank" rel="noreferrer">
              Console d’administration <ExternalLink />
            </a>
          </Button>
        </div>
      </div>

      {overview.isError && (
        <p role="alert" className="text-sm text-destructive">
          {overview.error.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Chiffre d’affaires TTC" icon={<Banknote />} value={o && formatXof(o.salesTotal)} sub={o && `${formatQty(o.ticketCount)} ticket(s)`} />
        <Kpi label="Panier moyen" icon={<Receipt />} value={o && formatXof(o.averageBasket)} sub={o && `Ventes HT : ${formatXof(o.salesHt)}`} />
        <Kpi
          label="Marge brute"
          icon={<TrendingUp />}
          value={o && formatXof(o.grossMargin)}
          sub={o && `${formatQty(o.marginRate)} % des ventes HT (au PMP)`}
          danger={Boolean(o && o.grossMargin < 0)}
        />
        <Kpi label="Valeur du stock (PMP)" icon={<Wallet />} value={o && formatXof(o.stockValuation)} sub={o && `${o.openSessions} caisse(s) ouverte(s)`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventes des 14 derniers jours</CardTitle>
          </CardHeader>
          <CardContent>
            {daily.data ? (
              <BarChart
                title="Chiffre d’affaires par jour"
                data={daily.data.map((d) => ({
                  label: new Date(`${d.day}T00:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
                  value: d.total,
                  sub: `${d.tickets} ticket(s)`,
                }))}
              />
            ) : (
              <Skeleton className="h-40" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">À surveiller</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!o ? (
              <Skeleton className="h-32" />
            ) : (
              <>
                <AlertLink to="/catalogue" tone={o.outOfStockCount ? 'danger' : 'ok'} text={`${o.outOfStockCount} article(s) en rupture`} />
                <AlertLink to="/catalogue" tone={o.lowStockCount ? 'warning' : 'ok'} text={`${o.lowStockCount} article(s) en stock bas`} />
                <AlertLink
                  href={ADMIN_URL}
                  tone={o.cashAlerts ? 'danger' : 'ok'}
                  text={o.cashAlerts ? `${o.cashAlerts} écart(s) de caisse hors tolérance` : 'Aucun écart de caisse hors tolérance'}
                />
                <div className="pt-2">
                  <Caps className="mb-1.5">Encaissements du jour</Caps>
                  {o.byMethod.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun encaissement.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {o.byMethod.map((m) => (
                        <li key={m.method} className="flex justify-between">
                          <span>{paymentMethodLabels[m.method]}</span>
                          <span className="font-mono">{formatXof(m.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Équipe aujourd’hui</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Activité de l’équipe aujourd’hui</caption>
              <thead className="bg-background text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="h-8 px-4">Employé</th>
                  <th scope="col" className="h-8 px-4 text-right">Tickets</th>
                  <th scope="col" className="h-8 px-4 text-right">CA</th>
                  <th scope="col" className="h-8 px-4 text-right">Mvts stock</th>
                </tr>
              </thead>
              <tbody>
                {activeToday.map((e) => (
                  <tr key={e.userId} className="border-t border-[#F1F5F9]">
                    <td className="px-4 py-2">
                      <div className="font-medium">{e.name}</div>
                      <div className="text-xs text-muted-foreground">{roleLabels[e.role]}</div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{e.ticketCount}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatXof(e.salesTotal)}</td>
                    <td className="px-4 py-2 text-right font-mono">{e.stockMovements}</td>
                  </tr>
                ))}
                {employees.data && activeToday.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      Aucune activité aujourd’hui.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Meilleures ventes du jour</CardTitle>
          </CardHeader>
          <ol className="divide-y">
            {top.data?.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Aucune vente aujourd’hui.</li>}
            {top.data?.map((t, i) => (
              <li key={t.productId} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-5 font-mono text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {t.sku} · {formatQty(t.quantity)} {t.unit}
                  </div>
                </div>
                <span className="font-mono">{formatXof(t.revenue)}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, icon, danger }: { label: string; value?: string; sub?: string; icon: ReactNode; danger?: boolean }) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <div className="mb-3 flex items-center justify-between">
          <Caps>{label}</Caps>
          <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
        </div>
        {value === undefined ? (
          <Skeleton className="h-12 w-3/4" />
        ) : (
          <>
            <div className={cn('font-mono text-2xl font-semibold', danger && 'text-danger-soft-foreground')}>{value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{sub}</div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

const toneClass = {
  ok: 'border-[#A7F3D0] bg-success-soft text-success-soft-foreground',
  warning: 'border-[#FDE68A] bg-warning-soft text-warning-soft-foreground',
  danger: 'border-[#FECACA] bg-danger-soft text-danger-soft-foreground',
}

function AlertLink({ text, tone, to, href }: { text: string; tone: keyof typeof toneClass; to?: '/catalogue'; href?: string }) {
  const inner = (
    <>
      <span className="flex items-center gap-2">
        {tone !== 'ok' ? <AlertTriangle className="size-4" /> : <Boxes className="size-4" />}
        {text}
      </span>
      <ArrowRight className="size-4 opacity-60" />
    </>
  )
  const cls = cn('flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-opacity hover:opacity-80', toneClass[tone])
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {inner}
    </a>
  )
}
