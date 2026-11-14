import { useDeferredValue, useState } from 'react'
import { Printer, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Caps } from '@/features/catalog/ui'
import { useReceipt } from '@/features/pos/queries'
import { Ticket80 } from '@/features/pos/receipt'
import { useMyDay, useMySales } from '@/features/reports/queries'
import { formatDateTime, formatQty } from '@/lib/format'
import { formatXof, paymentMethodLabels } from '@/shared'

const today = () => new Date().toISOString().slice(0, 10)

/** Le caissier retrouve ses tickets et réimprime un duplicata. */
export function MesVentesPage() {
  const [day, setDay] = useState(today())
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search.trim())
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const my = useMyDay()
  const sales = useMySales({ from: day || undefined, to: day || undefined, q: q || undefined, page, pageSize: 20 })
  const pages = Math.max(1, Math.ceil((sales.data?.total ?? 0) / 20))

  return (
    <div className="space-y-5">
      <div>
        <Caps>Mon activité</Caps>
        <h1 className="text-2xl font-semibold tracking-tight">Mes ventes</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Tickets aujourd’hui" value={my.data ? formatQty(my.data.ticketCount) : undefined} />
        <Stat label="Encaissé aujourd’hui" value={my.data ? formatXof(my.data.salesTotal) : undefined} />
        <Stat label="Panier moyen" value={my.data ? formatXof(my.data.averageBasket) : undefined} />
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-end gap-3 border-b px-4 py-3">
          <div className="grid gap-1">
            <label htmlFor="my-day" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Jour
            </label>
            <Input
              id="my-day"
              type="date"
              value={day}
              max={today()}
              onChange={(e) => {
                setDay(e.target.value)
                setPage(1)
              }}
              className="w-44"
            />
          </div>
          <div className="relative min-w-56 flex-1">
            <label htmlFor="my-search" className="sr-only">
              Rechercher un numéro de ticket
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="my-search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="N° de ticket (ex. 000123)"
              className="pl-9 font-mono"
            />
          </div>
        </div>

        <table className="w-full text-sm">
          <caption className="sr-only">Mes tickets</caption>
          <thead className="bg-background text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="h-8 px-4">Ticket</th>
              <th scope="col" className="h-8 px-4">Heure</th>
              <th scope="col" className="h-8 px-4">Règlement</th>
              <th scope="col" className="h-8 px-4 text-right">Total</th>
              <th scope="col" className="h-8 px-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sales.isPending && (
              <tr>
                <td colSpan={5} className="p-4">
                  <Skeleton className="h-24" />
                </td>
              </tr>
            )}
            {sales.data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Aucun ticket pour ce jour.
                </td>
              </tr>
            )}
            {sales.data?.items.map((s) => (
              <tr key={s.id} className="border-t border-[#F1F5F9]">
                <td className="px-4 py-2 font-mono">{s.number}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{formatDateTime(s.issuedAt)}</td>
                <td className="px-4 py-2">{s.methods.map((m) => paymentMethodLabels[m]).join(' + ')}</td>
                <td className="px-4 py-2 text-right font-mono font-semibold">{formatXof(s.total)}</td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => setOpenId(s.id)}>
                    <Printer /> Duplicata
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t px-4 py-3 text-sm">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Précédent
            </Button>
            <span className="font-mono text-xs">
              {page} / {pages}
            </span>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Suivant
            </Button>
          </div>
        )}
      </Card>

      <DuplicateDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value?: string }) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <Caps className="mb-2">{label}</Caps>
        {value === undefined ? <Skeleton className="h-8" /> : <div className="font-mono text-2xl font-semibold">{value}</div>}
      </CardContent>
    </Card>
  )
}

function DuplicateDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const receipt = useReceipt(id)
  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicata</DialogTitle>
          <DialogDescription>{receipt.data?.number ?? 'Chargement…'}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded-md border bg-muted/40 py-2">
          {receipt.data ? <Ticket80 receipt={receipt.data} duplicate /> : <Skeleton className="mx-auto h-80 w-[72mm]" />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button onClick={() => window.print()} disabled={!receipt.data}>
            <Printer /> Imprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
