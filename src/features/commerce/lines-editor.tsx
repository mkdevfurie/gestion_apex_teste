import { useDeferredValue, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseNumber } from '@/features/catalog/form-utils'
import { useProducts } from '@/features/catalog/queries'
import { formatQty } from '@/lib/format'
import { formatXof, priceWithVat, type ProductRow } from '@/shared'

export type DraftLine = {
  product: Pick<ProductRow, 'id' | 'sku' | 'name' | 'unit' | 'salePrice' | 'vatRate' | 'averageCost' | 'stock'>
  quantity: string
  /** Prix unitaire : coût d'achat (réception) ; non saisi pour un devis (prix de la base). */
  price: string
  discountRate: string
}

/**
 * Lignes d'un devis ou d'une réception : recherche d'article, quantité,
 * remise (devis) ou coût unitaire (réception).
 */
export function LinesEditor({
  lines,
  onChange,
  mode,
  maxDiscount = 0,
}: {
  lines: DraftLine[]
  onChange: (l: DraftLine[]) => void
  mode: 'quote' | 'purchase'
  maxDiscount?: number
}) {
  const [q, setQ] = useState('')
  const search = useDeferredValue(q.trim())
  const results = useProducts({ q: search || undefined, page: 1, pageSize: 8 })

  const add = (p: ProductRow) => {
    if (lines.some((l) => l.product.id === p.id)) return
    onChange([...lines, { product: p, quantity: '1', price: mode === 'purchase' ? String(p.averageCost || '') : '', discountRate: '0' }])
    setQ('')
  }
  const set = (i: number, patch: Partial<DraftLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  return (
    <div className="space-y-3">
      <div className="relative">
        <label htmlFor={`lines-${mode}`} className="sr-only">
          Ajouter un article
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input id={`lines-${mode}`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ajouter un article (SKU, désignation, code-barres)" className="pl-9" autoComplete="off" />
        {q && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 divide-y overflow-y-auto rounded-md border bg-popover shadow-lg">
            {results.data?.items.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => add(p)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
                  <span className="min-w-0">
                    <span className="block truncate">{p.name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {p.sku} · stock {formatQty(p.stock)} {p.unit}
                    </span>
                  </span>
                  <Plus className="size-4 shrink-0" />
                </button>
              </li>
            ))}
            {results.data?.items.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Aucun article</li>}
          </ul>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Aucune ligne. Recherchez un article ci-dessus.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="h-8 px-3">Article</th>
                <th scope="col" className="h-8 px-3 text-right">Quantité</th>
                <th scope="col" className="h-8 px-3 text-right">{mode === 'purchase' ? 'Coût unit. HT' : 'Prix TTC'}</th>
                {mode === 'quote' && <th scope="col" className="h-8 px-3 text-right">Remise %</th>}
                <th scope="col" className="h-8 px-3 text-right">Total</th>
                <th scope="col" className="h-8 w-8"><span className="sr-only">Retirer</span></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const qty = parseNumber(l.quantity) ?? 0
                const unit = mode === 'purchase' ? (parseNumber(l.price) ?? 0) : priceWithVat(l.product.salePrice, l.product.vatRate)
                const disc = mode === 'quote' ? (parseNumber(l.discountRate) ?? 0) : 0
                return (
                  <tr key={l.product.id} className="border-t">
                    <td className="px-3 py-1.5">
                      <div className="font-medium">{l.product.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{l.product.sku} · {l.product.unit}</div>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <Input aria-label={`Quantité ${l.product.name}`} value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} inputMode="decimal" className="ml-auto h-8 w-20 text-right font-mono" />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {mode === 'purchase' ? (
                        <Input aria-label={`Coût unitaire ${l.product.name}`} value={l.price} onChange={(e) => set(i, { price: e.target.value.replace(/[^\d]/g, '') })} inputMode="numeric" className="ml-auto h-8 w-28 text-right font-mono" />
                      ) : (
                        <span className="font-mono">{formatXof(unit)}</span>
                      )}
                    </td>
                    {mode === 'quote' && (
                      <td className="px-3 py-1.5 text-right">
                        <Input aria-label={`Remise ${l.product.name}`} value={l.discountRate} onChange={(e) => set(i, { discountRate: e.target.value })} inputMode="decimal" disabled={maxDiscount === 0} className="ml-auto h-8 w-16 text-right font-mono" />
                      </td>
                    )}
                    <td className="px-3 py-1.5 text-right font-mono">{formatXof(Math.round(qty * unit * (1 - disc / 100)))}</td>
                    <td className="px-1">
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Retirer ${l.product.name}`} onClick={() => onChange(lines.filter((_, j) => j !== i))}>
                        <X />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
