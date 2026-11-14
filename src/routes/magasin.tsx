import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeftRight, ClipboardCheck, PackagePlus, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMovements, useProducts } from '@/features/catalog/queries'
import { StockActionDialog, type StockAction } from '@/features/catalog/stock-action-dialog'
import { Caps, MovementTypeBadge, SignedQty, StockBadge, StockQty } from '@/features/catalog/ui'
import { formatDateTime, formatQty } from '@/lib/format'
import { useUser } from '@/lib/session'
import { formatXof, type ProductRow } from '@/shared'

/** Écran d'accueil du magasinier : ce qui manque, ce qui a bougé, les actions du jour. */
export function MagasinPage() {
  const user = useUser()
  const low = useProducts({ status: 'LOW', page: 1, pageSize: 50 })
  const out = useProducts({ status: 'OUT', page: 1, pageSize: 50 })
  const movements = useMovements({ page: 1, pageSize: 12 })
  const [action, setAction] = useState<StockAction | null>(null)
  const [product, setProduct] = useState<ProductRow>()
  const summary = low.data?.summary

  const open = (a: StockAction, p?: ProductRow) => {
    setProduct(p)
    setAction(a)
  }
  const alerts = [...(out.data?.items ?? []), ...(low.data?.items ?? [])]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Caps>Magasin · {user.name}</Caps>
          <h1 className="text-2xl font-semibold tracking-tight">Tableau du magasin</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="success" onClick={() => open({ mode: 'movement', type: 'PURCHASE_RECEIPT' })}>
            <PackagePlus /> Réception fournisseur
          </Button>
          <Button variant="outline" onClick={() => open({ mode: 'inventory' })}>
            <ClipboardCheck /> Inventaire
          </Button>
          <Button variant="outline" onClick={() => open({ mode: 'transfer' })}>
            <ArrowLeftRight /> Transfert
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Ruptures" value={out.data?.total} tone="danger" />
        <Stat label="Stock bas" value={low.data?.total} tone="warning" />
        <Card className="gap-0 py-4">
          <CardContent className="px-4">
            <div className="mb-2 flex items-center justify-between">
              <Caps>Valeur du stock</Caps>
              <Wallet className="size-4 text-muted-foreground" />
            </div>
            {summary ? <div className="font-mono text-2xl font-semibold">{formatXof(summary.valuation)}</div> : <Skeleton className="h-8" />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="flex flex-row items-center justify-between border-b py-3">
            <CardTitle className="text-base">À réapprovisionner</CardTitle>
            <Link to="/catalogue" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              Tout le catalogue
            </Link>
          </CardHeader>
          {low.isPending || out.isPending ? (
            <Skeleton className="m-4 h-40" />
          ) : alerts.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun article sous le seuil d’alerte.</p>
          ) : (
            <ul className="max-h-[28rem] divide-y overflow-y-auto">
              {alerts.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{p.name}</span>
                      <StockBadge status={p.status} />
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {p.sku} · seuil {formatQty(p.alertThreshold)} · {p.location ?? 'sans emplacement'}
                    </div>
                  </div>
                  <StockQty value={p.stock} status={p.status} />
                  <Button size="sm" variant="outline" onClick={() => open({ mode: 'movement', type: 'PURCHASE_RECEIPT' }, p)}>
                    Recevoir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Derniers mouvements</CardTitle>
          </CardHeader>
          {movements.isPending ? (
            <Skeleton className="m-4 h-40" />
          ) : (
            <ol className="divide-y">
              {movements.data?.items.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 px-4 py-2 text-sm">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <MovementTypeBadge type={m.type} />
                      <span className="truncate">{m.product.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(m.createdAt)} · {m.warehouse.code} · {m.user.name}
                    </div>
                  </div>
                  <SignedQty value={m.quantity} />
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <StockActionDialog action={action} onClose={() => setAction(null)} product={product} />
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value?: number; tone: 'danger' | 'warning' }) {
  return (
    <Card className={tone === 'danger' && value ? 'gap-0 border-[#FECACA] py-4' : 'gap-0 py-4'}>
      <CardContent className="px-4">
        <Caps className="mb-2">{label}</Caps>
        {value === undefined ? (
          <Skeleton className="h-8" />
        ) : (
          <div className={`font-mono text-2xl font-semibold ${tone === 'danger' ? 'text-danger-soft-foreground' : 'text-warning-soft-foreground'}`}>
            {value} <span className="font-sans text-sm font-normal text-muted-foreground">article(s)</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
