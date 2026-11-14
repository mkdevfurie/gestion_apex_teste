import { useDeferredValue, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Lock, Minus, Plus, Printer, ScanBarcode, ShoppingCart, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { parseNumber } from '@/features/catalog/form-utils'
import { useCategories, useProducts } from '@/features/catalog/queries'
import { Caps } from '@/features/catalog/ui'
import { useCart, type CartProduct } from '@/features/pos/cart'
import { newPayment, type PaymentDraft } from '@/features/pos/payment-draft'
import { PaymentPanel } from '@/features/pos/payment-panel'
import { useCreateSale, useCurrentSession, useReceipt } from '@/features/pos/queries'
import { Ticket80 } from '@/features/pos/receipt'
import { CloseSessionDialog, OpenSessionCard, ZReportDialog } from '@/features/pos/session-dialogs'
import { api, qs } from '@/lib/api'
import { formatQty } from '@/lib/format'
import { useUser } from '@/lib/session'
import {
  can,
  formatXof,
  priceWithVat,
  settlePayments,
  type CashSessionSummary,
  type ProductPage,
} from '@/shared'

export function CaissePage() {
  const user = useUser()
  const session = useCurrentSession()
  const [lastZ, setLastZ] = useState<CashSessionSummary | null>(null)

  if (!can(user.role, 'sell')) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
          <Lock className="size-5" /> Votre rôle ne permet pas d’encaisser.
        </CardContent>
      </Card>
    )
  }
  if (session.isPending) return <Skeleton className="h-96 w-full" />
  if (session.isError) return <p role="alert" className="text-sm text-destructive">{session.error.message}</p>
  return (
    <>
      {session.data ? <Register session={session.data} onClosed={setLastZ} /> : <OpenSessionCard userName={user.name} />}
      <ZReportDialog z={lastZ} onClose={() => setLastZ(null)} />
    </>
  )
}

function Register({ session, onClosed }: { session: CashSessionSummary; onClosed: (z: CashSessionSummary) => void }) {
  const user = useUser()
  const canDiscount = can(user.role, 'grantDiscount')
  const cart = useCart(user.id)
  const createSale = useCreateSale()

  const [payments, setPayments] = useState<PaymentDraft[]>([newPayment()])
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const total = cart.totals.total
  const settlement = useMemo(() => {
    if (cart.lines.length === 0) return null
    const parsed = payments
      .map((p) => ({ method: p.method, amount: parseNumber(p.amount) ?? 0, reference: p.reference.trim() || undefined }))
      .filter((p) => p.amount > 0)
    return settlePayments(total, parsed)
  }, [payments, total, cart.lines.length])

  const canCheckout = cart.lines.length > 0 && settlement?.ok === true && !createSale.isPending

  async function checkout() {
    if (!canCheckout) return
    try {
      const receipt = await createSale.mutateAsync({
        clientRequestId: cart.requestId,
        lines: cart.lines.map((l) => ({ productId: l.product.id, quantity: l.quantity, discountRate: l.discountRate })),
        payments: payments
          .map((p) => ({ method: p.method, amount: parseNumber(p.amount) ?? 0, reference: p.reference.trim() || undefined }))
          .filter((p) => p.amount > 0),
      })
      setReceiptId(receipt.id)
      cart.dispatch({ type: 'clear' })
      setPayments([newPayment()])
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  // Raccourcis : F1 = recherche / scan, F10 = encaisser.
  const checkoutRef = useRef(checkout)
  useEffect(() => {
    checkoutRef.current = checkout
  })
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F1') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'F10') {
        e.preventDefault()
        void checkoutRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const add = (p: CartProduct) => {
    cart.dispatch({ type: 'add', product: p })
    // En paiement simple hors espèces, le montant suit le nouveau total.
    setPayments((ps) => (ps.length === 1 && ps[0].method !== 'CASH' ? [{ ...ps[0], amount: '' }] : ps))
  }

  return (
    <div className="space-y-4">
      <SessionBar session={session} onClose={() => setClosing(true)} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <ProductPicker warehouseId={session.warehouse.id} searchRef={searchRef} onAdd={add} />

        <Card className="gap-0 py-0 lg:sticky lg:top-4">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <ShoppingCart className="size-4" /> Ticket en cours
            </h2>
            {cart.lines.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm('Vider le ticket en cours ?')) {
                    cart.dispatch({ type: 'clear' })
                    setPayments([newPayment()])
                  }
                }}
              >
                <Trash2 /> Vider
              </Button>
            )}
          </div>

          <CartLines cart={cart} canDiscount={canDiscount} />

          {cart.lines.length > 0 && (
            <div className="space-y-1 border-t bg-background px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total HT · {formatQty(cart.itemCount)} article(s)</span>
                <span className="font-mono">{formatXof(cart.totals.subtotal)}</span>
              </div>
              {cart.totals.vat.map((v) => (
                <div key={v.rate} className="flex justify-between">
                  <span className="text-muted-foreground">TVA {formatQty(v.rate)} %</span>
                  <span className="font-mono">{formatXof(v.vat)}</span>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between rounded-md bg-primary px-3 py-2 text-primary-foreground">
                <span className="text-sm font-semibold">NET À PAYER</span>
                <span className="font-mono text-2xl font-semibold" aria-live="polite">
                  {formatXof(total)}
                </span>
              </div>
            </div>
          )}

          <div className="border-t px-4 py-3">
            <PaymentPanel
              total={total}
              payments={payments}
              onChange={setPayments}
              settlement={settlement}
              disabled={cart.lines.length === 0}
            />
          </div>

          <div className="border-t p-4">
            <Button variant="success" className="h-12 w-full text-base" disabled={!canCheckout} onClick={checkout}>
              <Printer />
              {createSale.isPending ? 'Encaissement…' : 'Encaisser'}
              <kbd className="ml-1 rounded bg-white/20 px-1.5 font-mono text-xs">F10</kbd>
            </Button>
          </div>
        </Card>
      </div>

      <ReceiptDialog
        id={receiptId}
        onClose={() => {
          setReceiptId(null)
          setTimeout(() => searchRef.current?.focus(), 0)
        }}
      />
      <CloseSessionDialog
        session={session}
        open={closing}
        onOpenChange={setClosing}
        onClosed={(z) => {
          setClosing(false)
          onClosed(z)
        }}
      />
    </div>
  )
}

function SessionBar({ session, onClose }: { session: CashSessionSummary; onClose: () => void }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <Caps>
          Caisse ouverte · {session.warehouse.name} · depuis {new Date(session.openedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </Caps>
        <h1 className="text-2xl font-semibold tracking-tight">Point de vente</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="Tickets" value={formatQty(session.ticketCount)} />
        <Stat label="CA de la session" value={formatXof(session.salesTotal)} />
        <Button variant="outline" onClick={onClose}>
          <Lock /> Clôturer la caisse
        </Button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-1.5">
      <Caps>{label}</Caps>
      <div className="font-mono text-sm font-semibold">{value}</div>
    </div>
  )
}

function ProductPicker({
  warehouseId,
  searchRef,
  onAdd,
}: {
  warehouseId: string
  searchRef: React.RefObject<HTMLInputElement | null>
  onAdd: (p: CartProduct) => void
}) {
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search.trim())
  const [categoryId, setCategoryId] = useState('')
  const categories = useCategories()
  const products = useProducts({ q: q || undefined, categoryId: categoryId || undefined, warehouseId, page: 1, pageSize: 48 })

  /** Douchette : code-barres ou SKU exact + Entrée → ajouté directement. */
  async function onScan(e: FormEvent) {
    e.preventDefault()
    const code = search.trim()
    if (!code) return
    try {
      const res = await api<ProductPage>(`/products${qs({ q: code, warehouseId, pageSize: 5 })}`)
      const exact = res.items.find((p) => p.barcode === code || p.sku === code.toUpperCase())
      const pick = exact ?? (res.items.length === 1 ? res.items[0] : undefined)
      if (pick) {
        onAdd(pick)
        setSearch('')
      } else if (res.items.length === 0) {
        toast.error(`Aucun article pour « ${code} »`)
      }
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onScan} className="relative">
        <label htmlFor="pos-search" className="sr-only">
          Scanner un code-barres ou rechercher un article
        </label>
        <ScanBarcode className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="pos-search"
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Scanner un code-barres ou taper SKU / désignation…"
          className="h-12 pr-12 pl-11 font-mono text-base"
          autoFocus
          autoComplete="off"
        />
        <kbd className="absolute top-1/2 right-3 -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-xs text-muted-foreground">F1</kbd>
      </form>

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Catégories">
        {[{ id: '', name: 'Tout' }, ...(categories.data ?? [])].map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={categoryId === c.id}
            onClick={() => setCategoryId(c.id)}
            className={cn(
              'h-9 shrink-0 rounded-md border px-3 text-sm whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
              categoryId === c.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      {products.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : products.data?.items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Aucun article.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {products.data?.items.map((p) => {
            const out = p.stock <= 0
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={out}
                  onClick={() => onAdd(p)}
                  className="flex h-full w-full flex-col justify-between gap-2 rounded-lg border bg-card p-3 text-left shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-colors hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{p.sku}</span>
                    <Badge variant={out ? 'danger' : p.status === 'LOW' ? 'warning' : 'success'} className="font-mono">
                      {out ? 'Rupture' : `${formatQty(p.stock)}`}
                    </Badge>
                  </div>
                  <div className="line-clamp-2 text-sm leading-snug font-medium">{p.name}</div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{p.unit}</span>
                    <span className="font-mono text-sm font-semibold">{formatXof(priceWithVat(p.salePrice, p.vatRate))}</span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function CartLines({ cart, canDiscount }: { cart: ReturnType<typeof useCart>; canDiscount: boolean }) {
  if (cart.lines.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        Scannez ou touchez un article pour l’ajouter au ticket.
      </div>
    )
  }
  return (
    <ul className="max-h-[38vh] divide-y overflow-y-auto">
      {cart.lines.map((l, i) => {
        const lineTotal = cart.totals.lineTotals[i]
        const over = l.quantity > l.product.stock
        return (
          <li key={l.product.id} className="space-y-1.5 px-4 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{l.product.name}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {l.product.sku} · {formatXof(l.product.salePrice)} HT / {l.product.unit}
                </div>
              </div>
              <button
                type="button"
                onClick={() => cart.dispatch({ type: 'remove', productId: l.product.id })}
                aria-label={`Retirer ${l.product.name}`}
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Diminuer la quantité"
                  onClick={() => cart.dispatch({ type: 'setQty', productId: l.product.id, quantity: l.quantity - 1 })}
                >
                  <Minus />
                </Button>
                <label htmlFor={`qty-${l.product.id}`} className="sr-only">
                  Quantité de {l.product.name}
                </label>
                <Input
                  id={`qty-${l.product.id}`}
                  value={formatQty(l.quantity)}
                  onChange={(e) => {
                    const n = parseNumber(e.target.value)
                    if (n !== undefined && Number.isFinite(n) && n >= 0) {
                      cart.dispatch({ type: 'setQty', productId: l.product.id, quantity: n })
                    }
                  }}
                  inputMode="decimal"
                  className="h-8 w-16 text-center font-mono"
                />
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Augmenter la quantité"
                  onClick={() => cart.dispatch({ type: 'setQty', productId: l.product.id, quantity: l.quantity + 1 })}
                >
                  <Plus />
                </Button>
                {canDiscount && (
                  <>
                    <label htmlFor={`disc-${l.product.id}`} className="sr-only">
                      Remise sur {l.product.name}
                    </label>
                    <select
                      id={`disc-${l.product.id}`}
                      value={l.discountRate}
                      onChange={(e) => cart.dispatch({ type: 'setDiscount', productId: l.product.id, discountRate: Number(e.target.value) })}
                      className="ml-1 h-8 rounded-md border border-input bg-background px-1 text-xs"
                    >
                      {[0, 2, 5, 10, 15, 20].map((r) => (
                        <option key={r} value={r}>
                          {r === 0 ? 'Remise' : `−${r} %`}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
              <span className="font-mono text-sm font-semibold">{formatXof(lineTotal)}</span>
            </div>
            {over && (
              <p className="text-xs text-warning-soft-foreground">
                Stock disponible : {formatQty(l.product.stock)} {l.product.unit}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ReceiptDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const receipt = useReceipt(id)
  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vente enregistrée</DialogTitle>
          <DialogDescription>
            {receipt.data
              ? `${receipt.data.number} · ${formatXof(receipt.data.total)}${receipt.data.change ? ` · monnaie rendue ${formatXof(receipt.data.change)}` : ''}`
              : 'Chargement du ticket…'}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-y-auto rounded-md border bg-muted/40 py-2">
          {receipt.data ? <Ticket80 receipt={receipt.data} /> : <Skeleton className="mx-auto h-80 w-[72mm]" />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => window.print()} disabled={!receipt.data}>
            <Printer /> Imprimer
          </Button>
          <Button onClick={onClose} autoFocus>
            Nouvelle vente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
