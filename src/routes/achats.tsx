import { useDeferredValue, useState, type FormEvent } from 'react'
import { PackagePlus, Plus, Search, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { fieldErrors, parseNumber, selectClass } from '@/features/catalog/form-utils'
import { useWarehouses } from '@/features/catalog/queries'
import { Caps, Field } from '@/features/catalog/ui'
import { LinesEditor, type DraftLine } from '@/features/commerce/lines-editor'
import { usePurchase, usePurchases, useReceivePurchase, useSaveSupplier, useSupplierPayment, useSuppliers } from '@/features/commerce/queries'
import { formatDateTime, formatQty } from '@/lib/format'
import { useUser } from '@/lib/session'
import {
  accountPaymentSchema,
  can,
  documentStatusLabels,
  formatXof,
  paymentMethodLabels,
  purchaseInputSchema,
  supplierInputSchema,
  type SupplierRow,
} from '@/shared'
import { statusVariant } from '@/features/commerce/status'

const moneyMethods = ['CASH', 'WAVE', 'ORANGE_MONEY', 'FREE_MONEY', 'BANK_TRANSFER', 'CHEQUE'] as const

/** Réceptions fournisseurs (magasinier, gérant) et dettes fournisseurs (gérant). */
export function AchatsPage() {
  const { role } = useUser()
  const canPay = can(role, 'paySuppliers')
  const [tab, setTab] = useState<'receptions' | 'suppliers'>('receptions')
  const [receiving, setReceiving] = useState(false)
  const [newSupplier, setNewSupplier] = useState(false)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Caps>Achats</Caps>
          <h1 className="text-2xl font-semibold tracking-tight">{canPay ? 'Achats & fournisseurs' : 'Réceptions fournisseurs'}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setNewSupplier(true)}><Plus /> Fournisseur</Button>
          <Button onClick={() => setReceiving(true)}><PackagePlus /> Nouvelle réception</Button>
        </div>
      </div>

      <div role="tablist" aria-label="Vue" className="inline-flex rounded-md border bg-background p-0.5">
        {([['receptions', 'Réceptions'], ['suppliers', canPay ? 'Fournisseurs & dettes' : 'Fournisseurs']] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`h-8 rounded px-3 text-sm ${tab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'receptions' ? <Receptions canPay={canPay} /> : <Suppliers canPay={canPay} />}

      <ReceiveDialog open={receiving} onClose={() => setReceiving(false)} canPay={canPay} />
      <SupplierDialog open={newSupplier} onClose={() => setNewSupplier(false)} />
    </div>
  )
}

function Receptions({ canPay }: { canPay: boolean }) {
  const [page, setPage] = useState(1)
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const list = usePurchases({ page, pageSize: 25, unpaidOnly: unpaidOnly || undefined })
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 25))
  return (
    <Card className="gap-0 overflow-hidden py-0">
      {canPay && (
        <label className="flex items-center gap-2 border-b px-4 py-3 text-sm">
          <input type="checkbox" checked={unpaidOnly} onChange={(e) => { setUnpaidOnly(e.target.checked); setPage(1) }} className="size-4 accent-primary" />
          Non soldées uniquement
        </label>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Réceptions</caption>
          <thead className="bg-background text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="h-8 px-4">Bon</th>
              <th scope="col" className="h-8 px-4">Date</th>
              <th scope="col" className="h-8 px-4">Fournisseur</th>
              <th scope="col" className="h-8 px-4">Dépôt</th>
              {canPay && <th scope="col" className="h-8 px-4 text-right">Total</th>}
              {canPay && <th scope="col" className="h-8 px-4 text-right">Reste dû</th>}
              {canPay && <th scope="col" className="h-8 px-4">État</th>}
            </tr>
          </thead>
          <tbody>
            {list.isPending && <tr><td colSpan={7} className="p-4"><Skeleton className="h-24" /></td></tr>}
            {list.data?.items.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Aucune réception.</td></tr>}
            {list.data?.items.map((p) => (
              <tr key={p.id} className="border-t border-[#F1F5F9] hover:bg-background">
                <td className="px-4 py-2.5">
                  <button type="button" onClick={() => setOpen(p.id)} className="font-mono font-medium hover:underline">{p.number}</button>
                  {p.supplierRef && <div className="text-xs text-muted-foreground">BL {p.supplierRef}</div>}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{formatDateTime(p.receivedAt)}</td>
                <td className="px-4 py-2.5">{p.supplier.name}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{p.warehouse}</td>
                {canPay && <td className="px-4 py-2.5 text-right font-mono">{formatXof(p.total)}</td>}
                {canPay && <td className="px-4 py-2.5 text-right font-mono font-semibold">{p.balance ? formatXof(p.balance) : ''}</td>}
                {canPay && <td className="px-4 py-2.5"><Badge variant={statusVariant[p.status]}>{documentStatusLabels[p.status]}</Badge></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
          <span className="self-center font-mono text-xs">{page} / {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Suivant</Button>
        </div>
      )}
      <PurchaseDialog id={open} onClose={() => setOpen(null)} />
    </Card>
  )
}

function PurchaseDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const p = usePurchase(id).data
  return (
    <Dialog open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono">{p?.number ?? 'Réception'}</DialogTitle>
          <DialogDescription>{p ? `${p.supplier.name} · ${formatDateTime(p.receivedAt)} · ${p.warehouse} · par ${p.user}` : 'Chargement…'}</DialogDescription>
        </DialogHeader>
        {p && (
          <div className="space-y-3 text-sm">
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <table className="w-full">
                <thead className="bg-background text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  <tr><th className="h-8 px-3">Article</th><th className="h-8 px-3 text-right">Qté</th><th className="h-8 px-3 text-right">Coût</th><th className="h-8 px-3 text-right">Total</th></tr>
                </thead>
                <tbody>
                  {p.lines.map((l) => (
                    <tr key={l.productId} className="border-t">
                      <td className="px-3 py-1.5">{l.name}<div className="font-mono text-xs text-muted-foreground">{l.sku}</div></td>
                      <td className="px-3 py-1.5 text-right font-mono">{formatQty(l.quantity)} {l.unit}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{l.unitCost ? formatXof(l.unitCost) : '—'}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{l.lineTotal ? formatXof(l.lineTotal) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {p.total > 0 && (
              <div className="flex justify-end gap-6 font-mono">
                <span>Total {formatXof(p.total)}</span>
                <span>Payé {formatXof(p.amountPaid)}</span>
                <span className="font-semibold">Reste {formatXof(p.balance)}</span>
              </div>
            )}
            {p.payments.length > 0 && (
              <ul className="text-xs text-muted-foreground">
                {p.payments.map((x, i) => <li key={i}>{new Date(x.at).toLocaleDateString('fr-FR')} · {paymentMethodLabels[x.method]} · {formatXof(x.amount)}{x.reference && ` · ${x.reference}`}</li>)}
              </ul>
            )}
            {p.notes && <p className="text-muted-foreground">{p.notes}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Suppliers({ canPay }: { canPay: boolean }) {
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search.trim())
  const [page, setPage] = useState(1)
  const [paying, setPaying] = useState<SupplierRow | null>(null)
  const list = useSuppliers({ q: q || undefined, page, pageSize: 25 })
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 25))
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="relative border-b px-4 py-3">
        <label htmlFor="sup-search" className="sr-only">Rechercher un fournisseur</label>
        <Search className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input id="sup-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Nom, code, téléphone" className="max-w-sm pl-9" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Fournisseurs</caption>
          <thead className="bg-background text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="h-8 px-4">Fournisseur</th>
              <th scope="col" className="h-8 px-4">Contact</th>
              {canPay && <th scope="col" className="h-8 px-4 text-right">Dette</th>}
              {canPay && <th scope="col" className="h-8 px-4"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {list.isPending && <tr><td colSpan={4} className="p-4"><Skeleton className="h-24" /></td></tr>}
            {list.data?.items.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">Aucun fournisseur.</td></tr>}
            {list.data?.items.map((s) => (
              <tr key={s.id} className="border-t border-[#F1F5F9]">
                <td className="px-4 py-2.5"><div className="font-medium">{s.name}</div><div className="font-mono text-xs text-muted-foreground">{s.code}{s.ninea && ` · NINEA ${s.ninea}`}</div></td>
                <td className="px-4 py-2.5 text-xs">{[s.phone, s.email].filter(Boolean).join(' · ') || '—'}</td>
                {canPay && <td className="px-4 py-2.5 text-right font-mono font-semibold">{s.balance ? formatXof(s.balance) : <span className="font-normal text-muted-foreground">0</span>}</td>}
                {canPay && (
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="outline" disabled={s.balance <= 0} onClick={() => setPaying(s)}><Wallet /> Payer</Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
          <span className="self-center font-mono text-xs">{page} / {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Suivant</Button>
        </div>
      )}
      {paying && <SupplierPaymentDialog supplier={paying} onClose={() => setPaying(null)} />}
    </Card>
  )
}

function SupplierPaymentDialog({ supplier, onClose }: { supplier: SupplierRow; onClose: () => void }) {
  const pay = useSupplierPayment(supplier.id)
  const [method, setMethod] = useState('CASH')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [requestId] = useState(() => crypto.randomUUID())
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function submit(e: FormEvent) {
    e.preventDefault()
    const raw = { clientRequestId: requestId, method, amount: parseNumber(amount), reference: reference.trim() || undefined }
    const parsed = accountPaymentSchema.safeParse(raw)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues, raw))
    setErrors({})
    try {
      await pay.mutateAsync(parsed.data)
      toast.success(`Paiement de ${formatXof(parsed.data.amount)} à ${supplier.name} enregistré`)
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Payer {supplier.name}</DialogTitle>
            <DialogDescription>Dette : {formatXof(supplier.balance)}. Imputé aux réceptions les plus anciennes.</DialogDescription>
          </DialogHeader>
          <Field id="sp-method" label="Moyen de paiement">
            <select id="sp-method" value={method} onChange={(e) => setMethod(e.target.value)} className={selectClass}>
              {moneyMethods.map((m) => <option key={m} value={m}>{paymentMethodLabels[m]}</option>)}
            </select>
          </Field>
          <Field id="sp-amount" label="Montant (FCFA)" error={errors.amount}>
            <div className="flex gap-2">
              <Input id="sp-amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" className="text-right font-mono" autoFocus />
              <Button type="button" variant="outline" onClick={() => setAmount(String(supplier.balance))}>Tout</Button>
            </div>
          </Field>
          {method !== 'CASH' && (
            <Field id="sp-ref" label="Référence (optionnel)">
              <Input id="sp-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={pay.isPending}>{pay.isPending ? 'Enregistrement…' : 'Enregistrer le paiement'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SupplierDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const save = useSaveSupplier()
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', ninea: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const raw = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || undefined]))
    const parsed = supplierInputSchema.safeParse(raw)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues, raw))
    setErrors({})
    try {
      const s = await save.mutateAsync(parsed.data)
      toast.success(`Fournisseur ${s.name} créé (${s.code})`)
      setForm({ name: '', phone: '', email: '', address: '', ninea: '' })
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Nouveau fournisseur</DialogTitle>
            <DialogDescription>Le code fournisseur est attribué automatiquement.</DialogDescription>
          </DialogHeader>
          <Field id="s-name" label="Raison sociale" error={errors.name}><Input id="s-name" value={form.name} onChange={set('name')} autoFocus /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="s-phone" label="Téléphone" error={errors.phone}><Input id="s-phone" value={form.phone} onChange={set('phone')} inputMode="tel" /></Field>
            <Field id="s-ninea" label="NINEA" error={errors.ninea}><Input id="s-ninea" value={form.ninea} onChange={set('ninea')} /></Field>
          </div>
          <Field id="s-email" label="E-mail" error={errors.email}><Input id="s-email" value={form.email} onChange={set('email')} type="email" /></Field>
          <Field id="s-address" label="Adresse" error={errors.address}><Input id="s-address" value={form.address} onChange={set('address')} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Création…' : 'Créer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ReceiveDialog({ open, onClose, canPay }: { open: boolean; onClose: () => void; canPay: boolean }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">{open && <ReceiveForm onDone={onClose} canPay={canPay} />}</DialogContent>
    </Dialog>
  )
}

function ReceiveForm({ onDone, canPay }: { onDone: () => void; canPay: boolean }) {
  const receive = useReceivePurchase()
  const warehouses = useWarehouses().data ?? []
  const suppliers = useSuppliers({ page: 1, pageSize: 100 }).data?.items ?? []
  const [supplierId, setSupplierId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [supplierRef, setSupplierRef] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [paid, setPaid] = useState('')
  const [method, setMethod] = useState('CASH')
  const [requestId] = useState(() => crypto.randomUUID())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const wh = warehouseId || warehouses.find((w) => w.active)?.id || ''
  const total = lines.reduce((a, l) => a + Math.round((parseNumber(l.quantity) ?? 0) * (parseNumber(l.price) ?? 0)), 0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amount = parseNumber(paid) ?? 0
    const raw = {
      clientRequestId: requestId,
      supplierId,
      warehouseId: wh,
      supplierRef: supplierRef.trim() || undefined,
      dueDate: dueDate || undefined,
      lines: lines.map((l) => ({ productId: l.product.id, quantity: parseNumber(l.quantity), unitCost: parseNumber(l.price) ?? 0 })),
      payments: canPay && amount > 0 ? [{ method, amount }] : [],
    }
    const parsed = purchaseInputSchema.safeParse(raw)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues, raw))
    setErrors({})
    try {
      const p = await receive.mutateAsync(parsed.data)
      toast.success(`Réception ${p.number} enregistrée`, { description: `${p.lines.length} article(s) entrés en stock` })
      onDone()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Nouvelle réception fournisseur</DialogTitle>
        <DialogDescription>Les quantités entrent en stock et le coût moyen pondéré (PMP) est recalculé.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="r-supplier" label="Fournisseur" error={errors.supplierId}>
          <select id="r-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={selectClass}>
            <option value="">Choisir…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </select>
        </Field>
        <Field id="r-wh" label="Dépôt de réception" error={errors.warehouseId}>
          <select id="r-wh" value={wh} onChange={(e) => setWarehouseId(e.target.value)} className={selectClass}>
            {warehouses.filter((w) => w.active).map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
          </select>
        </Field>
        <Field id="r-ref" label="N° BL / facture fournisseur" error={errors.supplierRef}>
          <Input id="r-ref" value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} />
        </Field>
        {canPay && (
          <Field id="r-due" label="Échéance de paiement (optionnel)" error={errors.dueDate}>
            <Input id="r-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        )}
      </div>
      <LinesEditor lines={lines} onChange={setLines} mode="purchase" />
      {errors.lines && <p role="alert" className="text-sm text-destructive">{errors.lines}</p>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        {canPay ? (
          <div className="flex flex-wrap gap-3">
            <Field id="r-method" label="Payé maintenant">
              <select id="r-method" value={method} onChange={(e) => setMethod(e.target.value)} className={selectClass}>
                {moneyMethods.map((m) => <option key={m} value={m}>{paymentMethodLabels[m]}</option>)}
              </select>
            </Field>
            <Field id="r-paid" label="Montant (FCFA)">
              <div className="flex gap-2">
                <Input id="r-paid" value={paid} onChange={(e) => setPaid(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" className="w-36 text-right font-mono" placeholder="0" />
                <Button type="button" variant="outline" onClick={() => setPaid(String(total))}>Tout</Button>
              </div>
            </Field>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Le règlement du fournisseur est fait par le gérant.</p>
        )}
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total HT</div>
          <div className="font-mono text-lg font-semibold">{formatXof(total)}</div>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>Annuler</Button>
        <Button type="submit" disabled={receive.isPending || lines.length === 0}>{receive.isPending ? 'Enregistrement…' : 'Valider la réception'}</Button>
      </DialogFooter>
    </form>
  )
}
