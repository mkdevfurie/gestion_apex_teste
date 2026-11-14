import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft, FileCheck2, Printer, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { parseNumber, selectClass } from '@/features/catalog/form-utils'
import { Field } from '@/features/catalog/ui'
import { useConvertQuote, useDocument, useRefund } from '@/features/commerce/queries'
import { formatQty } from '@/lib/format'
import { documentKindLabels, documentStatusLabels, formatXof, paymentMethodLabels, type DocumentDetail } from '@/shared'
import { statusVariant } from '@/features/commerce/status'

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—')

/** Document A4 (facture, devis, avoir, ticket) : affichage, impression, conversion, retour. */
export function DocumentPage() {
  const { id } = useParams({ from: '/app/documents/$id' })
  const doc = useDocument(id)
  const [converting, setConverting] = useState(false)
  const [refunding, setRefunding] = useState(false)
  const d = doc.data

  if (doc.isPending) return <Skeleton className="h-[80vh]" />
  if (!d) return <p role="alert" className="text-destructive">{doc.error?.message ?? 'Document introuvable'}</p>

  const canRefund = (d.kind === 'INVOICE' || d.kind === 'TICKET') && d.lines.some((l) => l.returnedQuantity < l.quantity)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/documents"><ArrowLeft /> Retour aux documents</Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {d.kind === 'QUOTE' && d.status === 'OPEN' && (
            <Button variant="success" onClick={() => setConverting(true)}><FileCheck2 /> Convertir en facture</Button>
          )}
          {canRefund && <Button variant="outline" onClick={() => setRefunding(true)}><Undo2 /> Retour / avoir</Button>}
          <Button variant="outline" onClick={() => window.print()}><Printer /> Imprimer (A4)</Button>
        </div>
      </div>

      <A4 d={d} />
      <ConvertDialog d={d} open={converting} onClose={() => setConverting(false)} />
      <RefundDialog d={d} open={refunding} onClose={() => setRefunding(false)} />
    </div>
  )
}

function A4({ d }: { d: DocumentDetail }) {
  const title = d.kind === 'INVOICE' ? 'FACTURE' : d.kind === 'QUOTE' ? 'DEVIS' : d.kind === 'CREDIT_NOTE' ? 'AVOIR' : 'TICKET DE CAISSE'
  return (
    <article className="print-a4 mx-auto w-full max-w-[210mm] bg-white p-[12mm] text-[12px] leading-relaxed text-black shadow-[0_1px_3px_rgba(15,23,42,0.08)] print:shadow-none">
      <header className="flex justify-between gap-6 border-b-2 border-black pb-4">
        <div>
          <div className="text-lg font-bold uppercase">{d.company.name}</div>
          {d.company.legalForm && <div>{d.company.legalForm}</div>}
          {d.company.address && <div>{d.company.address}</div>}
          {d.company.phone && <div>Tél. {d.company.phone}</div>}
          {d.company.email && <div>{d.company.email}</div>}
          <div className="mt-1 text-[11px]">
            {d.company.ninea && <>NINEA {d.company.ninea}</>}
            {d.company.rccm && <> · RCCM {d.company.rccm}</>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tracking-wide">{title}</div>
          <div className="font-mono text-sm">{d.number}</div>
          <div>Date : {date(d.issuedAt)}</div>
          {d.validUntil && <div>Valable jusqu’au {date(d.validUntil)}</div>}
          {d.dueDate && <div>Échéance : {date(d.dueDate)}</div>}
          {d.sourceNumber && <div>Réf. : {d.sourceNumber}</div>}
          <div className="mt-1 print:hidden"><Badge variant={statusVariant[d.status]}>{documentStatusLabels[d.status]}</Badge></div>
        </div>
      </header>

      <section className="my-5 flex justify-end">
        <div className="min-w-[45%] rounded border border-black/30 p-3">
          <div className="text-[10px] font-semibold tracking-wider uppercase">{d.kind === 'QUOTE' ? 'Destinataire' : 'Client'}</div>
          {d.customerDetail ? (
            <>
              <div className="font-semibold">{d.customerDetail.name}</div>
              {d.customerDetail.address && <div>{d.customerDetail.address}</div>}
              {d.customerDetail.phone && <div>Tél. {d.customerDetail.phone}</div>}
              {d.customerDetail.ninea && <div>NINEA {d.customerDetail.ninea}</div>}
              <div className="font-mono text-[11px]">{d.customerDetail.code}</div>
            </>
          ) : (
            <div>Client comptant</div>
          )}
        </div>
      </section>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-black text-left text-[10px] tracking-wider uppercase">
            <th className="py-1.5 pr-2">Désignation</th>
            <th className="py-1.5 pr-2 text-right">Qté</th>
            <th className="py-1.5 pr-2 text-right">P.U. HT</th>
            <th className="py-1.5 pr-2 text-right">Remise</th>
            <th className="py-1.5 pr-2 text-right">TVA</th>
            <th className="py-1.5 text-right">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {d.lines.map((l) => (
            <tr key={l.id} className="border-b border-black/15 align-top">
              <td className="py-1.5 pr-2">
                {l.description}
                {l.sku && <div className="font-mono text-[10px] text-black/60">{l.sku}</div>}
                {l.returnedQuantity > 0 && <div className="text-[10px] text-black/60 print:hidden">Retourné : {formatQty(l.returnedQuantity)}</div>}
              </td>
              <td className="py-1.5 pr-2 text-right font-mono">{formatQty(l.quantity)} {l.unit}</td>
              <td className="py-1.5 pr-2 text-right font-mono">{formatXof(l.unitPrice)}</td>
              <td className="py-1.5 pr-2 text-right font-mono">{l.discountRate ? `${formatQty(l.discountRate)} %` : ''}</td>
              <td className="py-1.5 pr-2 text-right font-mono">{formatQty(l.vatRate)} %</td>
              <td className="py-1.5 text-right font-mono">{formatXof(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-4 flex justify-end">
        <dl className="w-72 space-y-1">
          <div className="flex justify-between"><dt>Total HT</dt><dd className="font-mono">{formatXof(d.subtotal - d.discount)}</dd></div>
          {d.vat.map((v) => (
            <div key={v.rate} className="flex justify-between"><dt>TVA {formatQty(v.rate)} % sur {formatXof(v.base)}</dt><dd className="font-mono">{formatXof(v.vat)}</dd></div>
          ))}
          <div className="flex justify-between border-t-2 border-black pt-1 text-sm font-bold"><dt>TOTAL TTC</dt><dd className="font-mono">{formatXof(d.total)}</dd></div>
          {d.kind !== 'QUOTE' && d.kind !== 'CREDIT_NOTE' && (
            <>
              <div className="flex justify-between"><dt>Déjà réglé</dt><dd className="font-mono">{formatXof(d.amountPaid)}</dd></div>
              <div className="flex justify-between font-bold"><dt>Reste à payer</dt><dd className="font-mono">{formatXof(d.balance)}</dd></div>
            </>
          )}
        </dl>
      </section>

      {d.payments.length > 0 && (
        <section className="mt-4 text-[11px]">
          <div className="font-semibold">Règlements</div>
          <ul>
            {d.payments.map((p, i) => (
              <li key={i}>
                {new Date(p.at).toLocaleDateString('fr-FR')} · {p.direction === 'OUT' ? 'Remboursement' : paymentMethodLabels[p.method]}
                {p.direction === 'OUT' && ` (${paymentMethodLabels[p.method]})`} · {formatXof(p.amount)}
                {p.reference && ` · ${p.reference}`}
              </li>
            ))}
          </ul>
        </section>
      )}
      {d.creditNotes.length > 0 && (
        <p className="mt-2 text-[11px]">Avoirs émis : {d.creditNotes.map((c) => `${c.number} (${formatXof(c.total)})`).join(', ')}</p>
      )}
      {d.notes && <p className="mt-4 text-[11px]"><span className="font-semibold">{d.kind === 'CREDIT_NOTE' ? 'Motif' : 'Remarques'} :</span> {d.notes}</p>}

      <footer className="mt-10 flex items-end justify-between gap-6 text-[10px] text-black/60">
        <div>{d.hash ? `Empreinte ${d.hash.slice(0, 24)}` : documentKindLabels[d.kind]} · Établi par {d.user}</div>
        {d.kind === 'QUOTE' ? <div className="w-56 border-t border-black pt-1 text-center text-black">Bon pour accord (date, signature)</div> : null}
      </footer>
    </article>
  )
}

function ConvertDialog({ d, open, onClose }: { d: DocumentDetail; open: boolean; onClose: () => void }) {
  const convert = useConvertQuote(d.id)
  const navigate = useNavigate()
  const [method, setMethod] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [requestId] = useState(() => crypto.randomUUID())

  async function submit(e: FormEvent) {
    e.preventDefault()
    const paid = parseNumber(amount) ?? 0
    try {
      const inv = await convert.mutateAsync({
        clientRequestId: requestId,
        payments: method && paid > 0 ? [{ method: method as 'CASH', amount: paid, reference: reference.trim() || undefined }] : [],
      })
      toast.success(`Facture ${inv.number} émise`, { description: inv.balance ? `Reste dû : ${formatXof(inv.balance)}` : 'Soldée' })
      onClose()
      await navigate({ to: '/documents/$id', params: { id: inv.id } })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Convertir {d.number} en facture</DialogTitle>
            <DialogDescription>
              Total {formatXof(d.total)} aux prix du devis. Le stock sort maintenant. Sans règlement complet, le reste passe sur le compte de {d.customer?.name ?? 'client'} (plafond vérifié).
            </DialogDescription>
          </DialogHeader>
          <Field id="cv-method" label="Acompte / règlement (optionnel)">
            <select id="cv-method" value={method} onChange={(e) => setMethod(e.target.value)} className={selectClass}>
              <option value="">Aucun — tout à crédit</option>
              {(['CASH', 'WAVE', 'ORANGE_MONEY', 'FREE_MONEY', 'CARD', 'BANK_TRANSFER', 'CHEQUE'] as const).map((m) => (
                <option key={m} value={m}>{paymentMethodLabels[m]}</option>
              ))}
            </select>
          </Field>
          {method && (
            <>
              <Field id="cv-amount" label="Montant (FCFA)">
                <div className="flex gap-2">
                  <Input id="cv-amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" className="text-right font-mono" />
                  <Button type="button" variant="outline" onClick={() => setAmount(String(d.total))}>Total</Button>
                </div>
              </Field>
              {method !== 'CASH' && (
                <Field id="cv-ref" label="Référence (optionnel)">
                  <Input id="cv-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
                </Field>
              )}
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" variant="success" disabled={convert.isPending}>{convert.isPending ? 'Émission…' : 'Émettre la facture'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RefundDialog({ d, open, onClose }: { d: DocumentDetail; open: boolean; onClose: () => void }) {
  const refund = useRefund(d.id)
  const navigate = useNavigate()
  const [qty, setQty] = useState<Record<string, string>>({})
  const [method, setMethod] = useState('CASH')
  const [reason, setReason] = useState('')
  const [requestId] = useState(() => crypto.randomUUID())

  const lines = d.lines
    .map((l) => ({ l, q: parseNumber(qty[l.id] ?? '') ?? 0 }))
    .filter((x) => x.q > 0)
  const estimate = lines.reduce((a, { l, q }) => a + Math.round((l.lineTotal / l.quantity) * q * (1 + l.vatRate / 100)), 0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!lines.length) return toast.error('Indiquez au moins une quantité rendue')
    if (reason.trim().length < 3) return toast.error('Indiquez le motif du retour')
    try {
      const note = await refund.mutateAsync({
        clientRequestId: requestId,
        lines: lines.map(({ l, q }) => ({ lineId: l.id, quantity: q })),
        refundMethod: method as 'CASH',
        reason: reason.trim(),
      })
      toast.success(`Avoir ${note.number} émis (${formatXof(note.total)})`, { description: 'Articles remis en stock.' })
      onClose()
      await navigate({ to: '/documents/$id', params: { id: note.id } })
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Retour client sur {d.number}</DialogTitle>
            <DialogDescription>
              Un avoir est émis et les articles reviennent en stock. Le montant est d’abord déduit du reste dû ({formatXof(d.balance)}), le solde est remboursé.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-background text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                <tr><th className="h-8 px-3">Article</th><th className="h-8 px-3 text-right">Vendu</th><th className="h-8 px-3 text-right">Rendu</th></tr>
              </thead>
              <tbody>
                {d.lines.map((l) => {
                  const max = l.quantity - l.returnedQuantity
                  return (
                    <tr key={l.id} className="border-t">
                      <td className="px-3 py-1.5">{l.description}{l.returnedQuantity > 0 && <div className="text-xs text-muted-foreground">déjà rendu : {formatQty(l.returnedQuantity)}</div>}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{formatQty(l.quantity)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <Input aria-label={`Quantité rendue ${l.description}`} value={qty[l.id] ?? ''} onChange={(e) => setQty((s) => ({ ...s, [l.id]: e.target.value }))} placeholder={`max ${formatQty(max)}`} disabled={max <= 0} inputMode="decimal" className="ml-auto h-8 w-24 text-right font-mono" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="rf-method" label="Remboursement du solde">
              <select id="rf-method" value={method} onChange={(e) => setMethod(e.target.value)} className={selectClass}>
                {(['CASH', 'WAVE', 'ORANGE_MONEY', 'FREE_MONEY', 'BANK_TRANSFER', 'CHEQUE'] as const).map((m) => (
                  <option key={m} value={m}>{paymentMethodLabels[m]}</option>
                ))}
              </select>
            </Field>
            <Field id="rf-reason" label="Motif">
              <Input id="rf-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Article défectueux, erreur…" />
            </Field>
          </div>
          {estimate > 0 && <p className="text-sm text-muted-foreground">Montant estimé de l’avoir : <span className="font-mono font-semibold text-foreground">{formatXof(estimate)}</span></p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={refund.isPending}>{refund.isPending ? 'Émission…' : 'Émettre l’avoir'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
