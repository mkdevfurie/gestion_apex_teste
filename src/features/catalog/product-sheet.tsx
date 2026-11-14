import type { ReactNode } from 'react'
import { ArrowLeftRight, ClipboardCheck, PackagePlus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatQty } from '@/lib/format'
import { formatXof, priceWithVat, type ProductDetail } from '@/shared'
import { useProduct } from './queries'
import type { StockAction } from './stock-action-dialog'
import { Caps, MovementTypeBadge, SignedQty, StockBadge, StockQty } from './ui'

type Props = {
  productId: string | null
  warehouseId?: string
  onClose: () => void
  /** Absent : rôle sans droit de mouvement (les boutons sont masqués). */
  onAction?: (action: StockAction, product: ProductDetail) => void
  onEdit?: (product: ProductDetail) => void
}

/** Fiche article : valorisation, stock par dépôt et journal récent. */
export function ProductSheet({ productId, warehouseId, onClose, onAction, onEdit }: Props) {
  const { data: p, isPending, isError, error } = useProduct(productId ?? undefined, warehouseId)

  return (
    <Sheet open={productId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {isError ? (
          <SheetHeader>
            <SheetTitle>Article indisponible</SheetTitle>
            <SheetDescription>{error.message}</SheetDescription>
          </SheetHeader>
        ) : isPending || !p ? (
          <div className="space-y-3 p-4">
            <SheetTitle className="sr-only">Chargement de l’article</SheetTitle>
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <SheetHeader className="border-b">
              <div className="flex items-center justify-between gap-2 pr-8">
                <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                <StockBadge status={p.status} />
              </div>
              <SheetTitle className="text-lg leading-snug">{p.name}</SheetTitle>
              <SheetDescription>
                {p.unit} · {p.category?.name ?? 'Sans catégorie'}
                {p.location && ` · ${p.location}`}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 p-4">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="PMP actuel" value={formatXof(p.averageCost)} />
                <Stat label="Valeur du stock" value={formatXof(Math.max(p.stock, 0) * p.averageCost)} />
                <Stat label="Prix de vente TTC" value={formatXof(priceWithVat(p.salePrice, p.vatRate))} sub={`${formatXof(p.salePrice)} HT · TVA ${p.vatRate} %`} />
                <Stat
                  label={warehouseId ? 'Stock (dépôt)' : 'Stock total'}
                  value={<StockQty value={p.stock} status={p.status} />}
                  sub={`Seuil d’alerte : ${formatQty(p.alertThreshold)}`}
                />
              </div>

              <section aria-labelledby="by-warehouse">
                <Caps className="mb-2">
                  <span id="by-warehouse">Stock par dépôt</span>
                </Caps>
                {p.stockByWarehouse.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Jamais stocké.</p>
                ) : (
                  <ul className="divide-y rounded-md border text-sm">
                    {p.stockByWarehouse.map((s) => (
                      <li key={s.warehouseId} className="flex items-center justify-between px-3 py-2">
                        <span>
                          <span className="font-mono text-xs text-muted-foreground">{s.code}</span> {s.name}
                        </span>
                        <span className="font-mono font-medium">{formatQty(s.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="journal">
                <div className="mb-2 flex items-baseline justify-between">
                  <Caps>
                    <span id="journal">Journal des mouvements</span>
                  </Caps>
                  <span className="text-xs text-muted-foreground">20 derniers</span>
                </div>
                {p.movements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucun mouvement.</p>
                ) : (
                  <ol className="divide-y rounded-md border">
                    {p.movements.map((m) => (
                      <li key={m.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                        <div className="min-w-0 space-y-1">
                          <MovementTypeBadge type={m.type} />
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(m.createdAt)} · {m.warehouse.code}
                            {m.reason && ` · ${m.reason}`}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <SignedQty value={m.quantity} />
                          <div className="font-mono text-xs text-muted-foreground">Solde : {formatQty(m.balanceAfter)}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <div className="grid grid-cols-2 gap-2">
                {onAction && (
                  <>
                    <Button variant="success" className="col-span-2" onClick={() => onAction({ mode: 'movement' }, p)}>
                      <PackagePlus /> Saisir un mouvement
                    </Button>
                    <Button variant="outline" onClick={() => onAction({ mode: 'inventory' }, p)}>
                      <ClipboardCheck /> Inventaire
                    </Button>
                    <Button variant="outline" onClick={() => onAction({ mode: 'transfer' }, p)}>
                      <ArrowLeftRight /> Transfert
                    </Button>
                  </>
                )}
                {onEdit && (
                  <Button variant="ghost" className="col-span-2" onClick={() => onEdit(p)}>
                    <Pencil /> Modifier la fiche
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <Caps>{label}</Caps>
      <div className="mt-1 font-mono text-[15px] font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}
