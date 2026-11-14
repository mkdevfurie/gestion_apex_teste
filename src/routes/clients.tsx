import { useDeferredValue, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { HandCoins, Pencil, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { fieldErrors, parseNumber, selectClass } from '@/features/catalog/form-utils'
import { Caps, Field } from '@/features/catalog/ui'
import { useCustomer, useCustomerPayment, useCustomers, useDocuments, useSaveCustomer } from '@/features/commerce/queries'
import { formatDateTime } from '@/lib/format'
import { useUser } from '@/lib/session'
import {
  accountPaymentSchema,
  can,
  customerInputSchema,
  documentKindLabels,
  documentStatusLabels,
  formatXof,
  paymentMethodLabels,
  type CustomerRow,
} from '@/shared'

const statusVariant = { PAID: 'success', PARTIAL: 'warning', UNPAID: 'warning', OVERDUE: 'danger' } as const

export function ClientsPage() {
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search.trim())
  const [withBalance, setWithBalance] = useState(false)
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const [form, setForm] = useState<{ open: boolean; customer?: CustomerRow }>({ open: false })
  const customers = useCustomers({ q: q || undefined, withBalance: withBalance || undefined, page, pageSize: 25 })
  const pages = Math.max(1, Math.ceil((customers.data?.total ?? 0) / 25))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Caps>Comptes clients</Caps>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        </div>
        <Button onClick={() => setForm({ open: true })}>
          <Plus /> Nouveau client
        </Button>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="relative min-w-56 flex-1">
            <label htmlFor="cl-search" className="sr-only">Rechercher un client</label>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="cl-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Nom, code ou téléphone" className="pl-9" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={withBalance} onChange={(e) => { setWithBalance(e.target.checked); setPage(1) }} className="size-4" />
            Avec un reste dû
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Clients</caption>
            <thead className="bg-background text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="h-8 px-4">Client</th>
                <th scope="col" className="h-8 px-4">Téléphone</th>
                <th scope="col" className="h-8 px-4 text-right">Reste dû</th>
                <th scope="col" className="h-8 px-4 text-right">Dont échu</th>
                <th scope="col" className="h-8 px-4 text-right">Plafond</th>
              </tr>
            </thead>
            <tbody>
              {customers.isPending && (
                <tr><td colSpan={5} className="p-4"><Skeleton className="h-24" /></td></tr>
              )}
              {customers.data?.items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Aucun client.</td></tr>
              )}
              {customers.data?.items.map((c) => (
                <tr key={c.id} className="cursor-pointer border-t border-[#F1F5F9] hover:bg-background" onClick={() => setOpenId(c.id)}>
                  <td className="px-4 py-2.5">
                    <button type="button" className="text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none" onClick={() => setOpenId(c.id)}>{c.name}</button>
                    <div className="font-mono text-xs text-muted-foreground">{c.code}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{c.phone ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold">{c.balance ? formatXof(c.balance) : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-danger-soft-foreground">{c.overdue ? formatXof(c.overdue) : ''}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{c.creditLimit ? formatXof(c.creditLimit) : 'Comptant'}</td>
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

      <CustomerSheet id={openId} onClose={() => setOpenId(null)} onEdit={(c) => setForm({ open: true, customer: c })} />
      <CustomerFormDialog open={form.open} customer={form.customer} onClose={() => setForm({ open: false })} />
    </div>
  )
}

function CustomerSheet({ id, onClose, onEdit }: { id: string | null; onClose: () => void; onEdit: (c: CustomerRow) => void }) {
  const customer = useCustomer(id)
  const docs = useDocuments({ customerId: id ?? undefined, page: 1, pageSize: 30 })
  const [paying, setPaying] = useState(false)
  const user = useUser()
  const c = customer.data

  return (
    <Sheet open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {!c ? (
          <div className="space-y-3 p-4">
            <SheetTitle className="sr-only">Chargement du client</SheetTitle>
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-40" />
          </div>
        ) : (
          <>
            <SheetHeader className="border-b">
              <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
              <SheetTitle className="text-lg">{c.name}</SheetTitle>
              <SheetDescription>
                {[c.phone, c.email, c.address, c.ninea && `NINEA ${c.ninea}`].filter(Boolean).join(' · ') || 'Aucune coordonnée'}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 p-4">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Reste dû" value={formatXof(c.balance)} />
                <Stat label="Dont échu" value={formatXof(c.overdue)} danger={c.overdue > 0} />
                <Stat label="Plafond" value={c.creditLimit ? formatXof(c.creditLimit) : 'Comptant'} />
              </div>
              {c.notes && <p className="rounded-md border bg-background p-3 text-sm">{c.notes}</p>}
              <div className="flex flex-wrap gap-2">
                <Button variant="success" disabled={c.balance === 0} onClick={() => setPaying(true)}>
                  <HandCoins /> Encaisser un règlement
                </Button>
                <Button variant="outline" onClick={() => onEdit(c)}>
                  <Pencil /> Modifier
                </Button>
              </div>

              <section>
                <Caps className="mb-2">Historique</Caps>
                <ul className="divide-y rounded-md border">
                  {docs.data?.items.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted-foreground">Aucun document.</li>}
                  {docs.data?.items.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {can(user.role, 'issueInvoices') ? (
                            <Link to="/documents/$id" params={{ id: d.id }} className="font-mono hover:underline">{d.number}</Link>
                          ) : (
                            <span className="font-mono">{d.number}</span>
                          )}
                          <span className="text-xs text-muted-foreground">{documentKindLabels[d.kind]}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(d.issuedAt)}
                          {d.dueDate && d.balance > 0 && ` · échéance ${new Date(d.dueDate).toLocaleDateString('fr-FR')}`}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono">{formatXof(d.total)}</div>
                        {d.kind !== 'QUOTE' && d.kind !== 'CREDIT_NOTE' && (
                          <Badge variant={statusVariant[d.status as keyof typeof statusVariant] ?? 'outline'}>
                            {d.balance > 0 ? `${documentStatusLabels[d.status]} · ${formatXof(d.balance)}` : documentStatusLabels[d.status]}
                          </Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
            <PaymentDialog customer={c} open={paying} onClose={() => setPaying(false)} />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-md border bg-background p-2.5">
      <Caps>{label}</Caps>
      <div className={`mt-1 font-mono text-sm font-semibold ${danger ? 'text-danger-soft-foreground' : ''}`}>{value}</div>
    </div>
  )
}

function PaymentDialog({ customer, open, onClose }: { customer: CustomerRow; open: boolean; onClose: () => void }) {
  const pay = useCustomerPayment(customer.id)
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
      const r = await pay.mutateAsync(parsed.data)
      toast.success(`Règlement de ${formatXof(parsed.data.amount)} enregistré`, { description: r.allocated.map((a) => `${a.number} : ${formatXof(a.amount)}`).join(' · ') })
      setAmount('')
      setReference('')
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
            <DialogTitle>Règlement de {customer.name}</DialogTitle>
            <DialogDescription>Reste dû : {formatXof(customer.balance)}. Le montant est imputé aux factures les plus anciennes.</DialogDescription>
          </DialogHeader>
          <Field id="cp-method" label="Moyen de paiement">
            <select id="cp-method" value={method} onChange={(e) => setMethod(e.target.value)} className={selectClass}>
              {(['CASH', 'WAVE', 'ORANGE_MONEY', 'FREE_MONEY', 'CARD', 'BANK_TRANSFER', 'CHEQUE'] as const).map((m) => (
                <option key={m} value={m}>{paymentMethodLabels[m]}</option>
              ))}
            </select>
          </Field>
          <Field id="cp-amount" label="Montant (FCFA)" error={errors.amount}>
            <div className="flex gap-2">
              <Input id="cp-amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" className="text-right font-mono" autoFocus />
              <Button type="button" variant="outline" onClick={() => setAmount(String(customer.balance))}>Tout</Button>
            </div>
          </Field>
          {method !== 'CASH' && (
            <Field id="cp-ref" label="Référence (optionnel)">
              <Input id="cp-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° de transaction, de chèque…" />
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" variant="success" disabled={pay.isPending}>{pay.isPending ? 'Enregistrement…' : 'Encaisser'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CustomerFormDialog({ open, customer, onClose }: { open: boolean; customer?: CustomerRow; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">{open && <CustomerForm customer={customer} onDone={onClose} />}</DialogContent>
    </Dialog>
  )
}

function CustomerForm({ customer, onDone }: { customer?: CustomerRow; onDone: () => void }) {
  const user = useUser()
  const canLimit = can(user.role, 'issueInvoices')
  const save = useSaveCustomer(customer?.id)
  const [v, setV] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    ninea: customer?.ninea ?? '',
    creditLimit: String(customer?.creditLimit ?? 0),
    notes: customer?.notes ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const raw = { ...v, creditLimit: parseNumber(v.creditLimit) ?? 0 }
    const parsed = customerInputSchema.safeParse(raw)
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues, raw))
    setErrors({})
    const body = canLimit ? parsed.data : { ...parsed.data, creditLimit: undefined }
    try {
      await save.mutateAsync(customer ? body : { ...parsed.data, creditLimit: canLimit ? parsed.data.creditLimit : 0 })
      toast.success(customer ? 'Client mis à jour' : 'Client créé')
      onDone()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{customer ? `Modifier ${customer.code}` : 'Nouveau client'}</DialogTitle>
        <DialogDescription>Le plafond de crédit autorise les ventes à crédit (0 = paiement comptant uniquement).</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="cf-name" label="Nom ou raison sociale" error={errors.name} className="sm:col-span-2">
          <Input id="cf-name" value={v.name} onChange={set('name')} autoFocus />
        </Field>
        <Field id="cf-phone" label="Téléphone" error={errors.phone}>
          <Input id="cf-phone" value={v.phone} onChange={set('phone')} inputMode="tel" placeholder="+221 77 …" />
        </Field>
        <Field id="cf-email" label="E-mail" error={errors.email}>
          <Input id="cf-email" value={v.email} onChange={set('email')} type="email" />
        </Field>
        <Field id="cf-address" label="Adresse" className="sm:col-span-2">
          <Input id="cf-address" value={v.address} onChange={set('address')} />
        </Field>
        <Field id="cf-ninea" label="NINEA (entreprise)">
          <Input id="cf-ninea" value={v.ninea} onChange={set('ninea')} />
        </Field>
        <Field id="cf-limit" label="Plafond de crédit (FCFA)" error={errors.creditLimit} hint={canLimit ? undefined : 'Modifiable par un gérant'}>
          <Input id="cf-limit" value={v.creditLimit} onChange={(e) => setV((s) => ({ ...s, creditLimit: e.target.value.replace(/[^\d]/g, '') }))} inputMode="numeric" className="font-mono" disabled={!canLimit} />
        </Field>
        <Field id="cf-notes" label="Remarques" className="sm:col-span-2">
          <Input id="cf-notes" value={v.notes} onChange={set('notes')} />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>Annuler</Button>
        <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button>
      </DialogFooter>
    </form>
  )
}
