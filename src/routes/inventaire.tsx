import { useDeferredValue, useState } from 'react'
import { ClipboardCheck, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { parseNumber, selectClass } from '@/features/catalog/form-utils'
import { useProducts, useWarehouses } from '@/features/catalog/queries'
import { Caps, Field } from '@/features/catalog/ui'
import { useInventoryBatch } from '@/features/commerce/queries'
import { formatQty, formatSignedQty } from '@/lib/format'
import { formatXof, type InventoryReport } from '@/shared'

/**
 * Inventaire complet d'un dépôt : on saisit la quantité comptée article par
 * article (sur plusieurs pages), puis on valide tout d'un coup. Seuls les
 * articles saisis sont ajustés.
 */
export function InventairePage() {
  const warehouses = useWarehouses().data ?? []
  const [warehouseId, setWarehouseId] = useState('')
  const wh = warehouseId || warehouses.find((w) => w.active)?.id || ''
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search.trim())
  const [page, setPage] = useState(1)
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [report, setReport] = useState<InventoryReport | null>(null)
  const batch = useInventoryBatch()
  const products = useProducts({ q: q || undefined, warehouseId: wh || undefined, page, pageSize: 100 })
  const pages = Math.max(1, Math.ceil((products.data?.total ?? 0) / 100))

  const entered = Object.entries(counts)
    .map(([productId, v]) => ({ productId, countedQuantity: parseNumber(v) }))
    .filter((c): c is { productId: string; countedQuantity: number } => c.countedQuantity !== undefined && c.countedQuantity >= 0)

  function changeWarehouse(id: string) {
    if (entered.length && !window.confirm('Changer de dépôt efface les quantités saisies. Continuer ?')) return
    setCounts({})
    setWarehouseId(id)
  }

  async function submit() {
    try {
      const r = await batch.mutateAsync({ warehouseId: wh, counts: entered, reason: reason.trim() || undefined })
      setReport(r)
      setCounts({})
      setConfirming(false)
      toast.success(`Inventaire validé : ${r.adjusted} article(s) ajusté(s)`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Caps>Stock</Caps>
          <h1 className="text-2xl font-semibold tracking-tight">Inventaire</h1>
        </div>
        <Button disabled={!entered.length || !wh} onClick={() => setConfirming(true)}>
          <ClipboardCheck /> Valider ({entered.length})
        </Button>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-end gap-3 border-b px-4 py-3">
          <Field id="inv-wh" label="Dépôt">
            <select id="inv-wh" value={wh} onChange={(e) => changeWarehouse(e.target.value)} className={selectClass}>
              {warehouses.filter((w) => w.active).map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
            </select>
          </Field>
          <div className="relative min-w-56 flex-1">
            <label htmlFor="inv-search" className="sr-only">Filtrer les articles</label>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="inv-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Filtrer (SKU, désignation, code-barres)" className="pl-9" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Articles à compter</caption>
            <thead className="bg-background text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="h-8 px-4">Article</th>
                <th scope="col" className="h-8 px-4 text-right">Théorique</th>
                <th scope="col" className="h-8 px-4 text-right">Compté</th>
                <th scope="col" className="h-8 px-4 text-right">Écart</th>
              </tr>
            </thead>
            <tbody>
              {products.isPending && <tr><td colSpan={4} className="p-4"><Skeleton className="h-40" /></td></tr>}
              {products.data?.items.map((p) => {
                const counted = parseNumber(counts[p.id] ?? '')
                const diff = counted === undefined ? null : counted - p.stock
                return (
                  <tr key={p.id} className="border-t border-[#F1F5F9]">
                    <td className="px-4 py-2"><div>{p.name}</div><div className="font-mono text-xs text-muted-foreground">{p.sku} · {p.unit}</div></td>
                    <td className="px-4 py-2 text-right font-mono">{formatQty(p.stock)}</td>
                    <td className="px-4 py-2 text-right">
                      <Input aria-label={`Quantité comptée ${p.name}`} value={counts[p.id] ?? ''} onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value }))} inputMode="decimal" className="ml-auto h-8 w-24 text-right font-mono" />
                    </td>
                    <td className={`px-4 py-2 text-right font-mono ${diff ? (diff < 0 ? 'text-destructive' : 'text-success') : 'text-muted-foreground'}`}>
                      {diff === null ? '' : diff === 0 ? '=' : formatSignedQty(diff)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">Les saisies sont conservées d’une page à l’autre.</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
              <span className="self-center font-mono text-xs">{page} / {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Suivant</Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Valider l’inventaire</DialogTitle>
            <DialogDescription>{entered.length} article(s) compté(s). Le stock de ces articles sera remplacé par la quantité comptée ; chaque écart est tracé dans le journal.</DialogDescription>
          </DialogHeader>
          <Field id="inv-reason" label="Motif (optionnel)">
            <Input id="inv-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Inventaire annuel, contrôle mensuel…" />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>Annuler</Button>
            <Button onClick={submit} disabled={batch.isPending}>{batch.isPending ? 'Validation…' : 'Valider'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(report)} onOpenChange={(o) => !o && setReport(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Rapport d’inventaire</DialogTitle>
            <DialogDescription>
              {report?.adjusted} ajusté(s), {report?.unchanged} sans écart. Valeur des écarts au PMP : <span className="font-mono font-semibold">{formatXof(report?.valueDifference ?? 0)}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto rounded-md border text-sm">
            <table className="w-full">
              <thead className="bg-background text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                <tr><th className="h-8 px-3">Article</th><th className="h-8 px-3 text-right">Avant</th><th className="h-8 px-3 text-right">Compté</th><th className="h-8 px-3 text-right">Écart</th></tr>
              </thead>
              <tbody>
                {report?.lines.filter((l) => l.difference !== 0).map((l) => (
                  <tr key={l.productId} className="border-t">
                    <td className="px-3 py-1.5">{l.name}<div className="font-mono text-xs text-muted-foreground">{l.sku}</div></td>
                    <td className="px-3 py-1.5 text-right font-mono">{formatQty(l.before)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{formatQty(l.counted)}</td>
                    <td className={`px-3 py-1.5 text-right font-mono ${l.difference < 0 ? 'text-destructive' : 'text-success'}`}>{formatSignedQty(l.difference)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter><Button onClick={() => setReport(null)}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
