import { useDeferredValue, useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { FilePlus2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { fieldErrors, parseNumber } from '@/features/catalog/form-utils'
import { Caps, Field } from '@/features/catalog/ui'
import { CustomerPicker } from '@/features/commerce/customer-picker'
import { LinesEditor, type DraftLine } from '@/features/commerce/lines-editor'
import { useCreateQuote, useDocuments } from '@/features/commerce/queries'
import { statusVariant } from '@/features/commerce/status'
import { useSettings } from '@/features/reports/queries'
import { formatDateTime } from '@/lib/format'
import { documentKindLabels, documentStatusLabels, formatXof, quoteInputSchema, type CustomerRow, type DocumentKind } from '@/shared'

const tabs: { kind: DocumentKind | 'UNPAID'; label: string }[] = [
  { kind: 'INVOICE', label: 'Factures' },
  { kind: 'QUOTE', label: 'Devis' },
  { kind: 'CREDIT_NOTE', label: 'Avoirs' },
  { kind: 'TICKET', label: 'Tickets' },
  { kind: 'UNPAID', label: 'Impayés' },
]

export function DocumentsPage() {
  const [tab, setTab] = useState<DocumentKind | 'UNPAID'>('INVOICE')
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search.trim())
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const docs = useDocuments({
    kind: tab === 'UNPAID' ? undefined : tab,
    unpaidOnly: tab === 'UNPAID' || undefined,
    q: q || undefined,
    page,
    pageSize: 25,
  })
  const pages = Math.max(1, Math.ceil((docs.data?.total ?? 0) / 25))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Caps>Facturation</Caps>
          <h1 className="text-2xl font-semibold tracking-tight">Factures, devis & avoirs</h1>
        </div>
        <Button onClick={() => setCreating(true)}>
          <FilePlus2 /> Nouveau devis
        </Button>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div role="tablist" aria-label="Type de document" className="inline-flex flex-wrap rounded-md border bg-background p-0.5">
            {tabs.map((t) => (
              <button
                key={t.kind}
                type="button"
                role="tab"
                aria-selected={tab === t.kind}
                onClick={() => { setTab(t.kind); setPage(1) }}
                className={`h-8 rounded px-3 text-sm ${tab === t.kind ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative min-w-48">
            <label htmlFor="doc-search" className="sr-only">Numéro de document</label>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="doc-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="N° (ex. FAC-2026-000012)" className="pl-9 font-mono" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Documents</caption>
            <thead className="bg-background text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="h-8 px-4">Numéro</th>
                <th scope="col" className="h-8 px-4">Date</th>
                <th scope="col" className="h-8 px-4">Client</th>
                <th scope="col" className="h-8 px-4 text-right">Total</th>
                <th scope="col" className="h-8 px-4 text-right">Reste dû</th>
                <th scope="col" className="h-8 px-4">État</th>
              </tr>
            </thead>
            <tbody>
              {docs.isPending && <tr><td colSpan={6} className="p-4"><Skeleton className="h-24" /></td></tr>}
              {docs.data?.items.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Aucun document.</td></tr>}
              {docs.data?.items.map((d) => (
                <tr key={d.id} className="border-t border-[#F1F5F9] hover:bg-background">
                  <td className="px-4 py-2.5">
                    <Link to="/documents/$id" params={{ id: d.id }} className="font-mono font-medium hover:underline">{d.number}</Link>
                    <div className="text-xs text-muted-foreground">{documentKindLabels[d.kind]}{d.sourceNumber && ` · ${d.sourceNumber}`}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{formatDateTime(d.issuedAt)}</td>
                  <td className="px-4 py-2.5">{d.customer?.name ?? <span className="text-muted-foreground">Comptant</span>}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatXof(d.total)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold">{d.balance ? formatXof(d.balance) : ''}</td>
                  <td className="px-4 py-2.5"><Badge variant={statusVariant[d.status]}>{documentStatusLabels[d.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex justify-end gap-2 border-t px-4 py-3 text-sm">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
            <span className="self-center font-mono text-xs">{page} / {pages}</span>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Suivant</Button>
          </div>
        )}
      </Card>

      <QuoteDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

function QuoteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">{open && <QuoteForm onDone={onClose} />}</DialogContent>
    </Dialog>
  )
}

function QuoteForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const create = useCreateQuote()
  const maxDiscount = useSettings().data?.maxDiscountRate ?? 0
  const [customer, setCustomer] = useState<CustomerRow | null>(null)
  const [lines, setLines] = useState<DraftLine[]>([])
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function submit(e: FormEvent) {
    e.preventDefault()
    const raw = {
      customerId: customer?.id,
      lines: lines.map((l) => ({ productId: l.product.id, quantity: parseNumber(l.quantity), discountRate: parseNumber(l.discountRate) ?? 0 })),
      notes: notes.trim(),
    }
    const parsed = quoteInputSchema.safeParse(raw)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues, raw))
    setErrors({})
    try {
      const d = await create.mutateAsync(parsed.data)
      toast.success(`Devis ${d.number} créé`)
      onDone()
      await navigate({ to: '/documents/$id', params: { id: d.id } })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Nouveau devis</DialogTitle>
        <DialogDescription>Le devis ne touche pas au stock. Il sera converti en facture si le client accepte.</DialogDescription>
      </DialogHeader>
      <Field id="q-customer" label="Client">
        <CustomerPicker id="q-customer" value={customer} onChange={setCustomer} />
      </Field>
      <LinesEditor lines={lines} onChange={setLines} mode="quote" maxDiscount={maxDiscount} />
      {errors.lines && <p role="alert" className="text-sm text-destructive">{errors.lines}</p>}
      <Field id="q-notes" label="Remarques (optionnel)">
        <Input id="q-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Chantier, conditions de livraison…" />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>Annuler</Button>
        <Button type="submit" disabled={create.isPending || lines.length === 0}>{create.isPending ? 'Création…' : 'Créer le devis'}</Button>
      </DialogFooter>
    </form>
  )
}
