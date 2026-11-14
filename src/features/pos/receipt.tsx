import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { formatDateTime, formatQty } from '@/lib/format'
import { formatXof, paymentMethodLabels, type CashSessionSummary, type SaleReceipt } from '@/shared'

// Ticket thermique 80 mm : 72 mm imprimables, police à chasse fixe.
// À l'impression (window.print), seule la zone .print-area sort (voir index.css).

const money = (n: number) => formatXof(n).replace(' FCFA', ' F')

function Row({ left, right, strong }: { left: ReactNode; right: ReactNode; strong?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-2', strong && 'font-bold')}>
      <span className="min-w-0">{left}</span>
      <span className="shrink-0 text-right">{right}</span>
    </div>
  )
}

const Rule = ({ double }: { double?: boolean }) => (
  <div aria-hidden className={cn('my-1.5 border-t border-black', double ? 'border-double border-t-[3px]' : 'border-dashed')} />
)

function Paper({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'print-area mx-auto w-[72mm] bg-white px-1 py-3 font-mono text-[11px] leading-[1.35] text-black',
        className,
      )}
    >
      {children}
    </div>
  )
}

function Header({ company }: { company: SaleReceipt['company'] }) {
  return (
    <div className="text-center">
      <div className="text-[13px] font-bold uppercase">{company.name}</div>
      {company.legalForm && <div>{company.legalForm}</div>}
      {company.address && <div>{company.address}</div>}
      {company.phone && <div>Tél : {company.phone}</div>}
      {company.ninea && <div>NINEA : {company.ninea}</div>}
      {company.rccm && <div>RCCM : {company.rccm}</div>}
    </div>
  )
}

export function Ticket80({ receipt, duplicate }: { receipt: SaleReceipt; duplicate?: boolean }) {
  return (
    <Paper>
      <Header company={receipt.company} />
      <Rule double />
      <Row left={<>Ticket : <b>{receipt.number}</b></>} right={duplicate ? <b>DUPLICATA</b> : ''} />
      <Row left={formatDateTime(receipt.issuedAt)} right={receipt.warehouse.code} />
      <Row left={`Caissier : ${receipt.cashier}`} right="" />
      <Rule />
      {receipt.lines.map((l, i) => (
        <div key={i} className="mb-1">
          <div className="uppercase">{l.description}</div>
          <Row
            left={`${formatQty(l.quantity)} × ${money(l.unitPrice)}${l.discountRate ? ` −${formatQty(l.discountRate)} %` : ''}`}
            right={money(l.lineTotal)}
          />
        </div>
      ))}
      <Rule />
      <Row left="Articles" right={formatQty(receipt.itemCount)} />
      <Row left="Total HT" right={money(receipt.subtotal - receipt.discount)} />
      {receipt.vat.map((v) => (
        <Row key={v.rate} left={`TVA ${formatQty(v.rate)} % sur ${money(v.base)}`} right={money(v.vat)} />
      ))}
      <Rule double />
      <div className="text-[14px]">
        <Row left="TOTAL TTC" right={money(receipt.total)} strong />
      </div>
      <Rule double />
      {receipt.payments.map((p, i) => (
        <Row key={i} left={`${paymentMethodLabels[p.method]}${p.reference ? ` (${p.reference})` : ''}`} right={money(p.amount)} />
      ))}
      {receipt.cashTendered ? (
        <>
          <Row left="Espèces reçues" right={money(receipt.cashTendered)} />
          <Row left="Monnaie rendue" right={money(receipt.change ?? 0)} strong />
        </>
      ) : null}
      <Rule />
      <div className="text-center text-[10px]">
        <div>Empreinte : {receipt.hash.slice(0, 16)}</div>
        {receipt.footer && <div className="mt-2 whitespace-pre-line">{receipt.footer}</div>}
      </div>
    </Paper>
  )
}

/** Ticket Z : clôture de caisse. */
export function ZReport({ z, company }: { z: CashSessionSummary; company?: string }) {
  return (
    <Paper>
      <div className="text-center">
        {company && <div className="text-[13px] font-bold uppercase">{company}</div>}
        <div className="font-bold">CLÔTURE DE CAISSE (Z)</div>
      </div>
      <Rule double />
      <Row left="Dépôt" right={z.warehouse.code} />
      <Row left="Caissier" right={z.openedBy} />
      <Row left="Ouverture" right={formatDateTime(z.openedAt)} />
      {z.closedAt && <Row left="Clôture" right={formatDateTime(z.closedAt)} />}
      {z.closedBy && z.closedBy !== z.openedBy && <Row left="Clôturée par" right={z.closedBy} />}
      <Rule />
      <Row left="Tickets" right={z.ticketCount} />
      <Row left="Chiffre d’affaires TTC" right={money(z.salesTotal)} strong />
      <Rule />
      {z.byMethod.length === 0 && <div>Aucun encaissement</div>}
      {z.byMethod.map((m) => (
        <Row key={m.method} left={paymentMethodLabels[m.method]} right={money(m.amount)} />
      ))}
      <Rule />
      <Row left="Fond de caisse" right={money(z.openingFloat)} />
      <Row left="Espèces attendues" right={money(z.expectedCash)} strong />
      {z.countedCash !== null && <Row left="Espèces comptées" right={money(z.countedCash)} />}
      {z.difference !== null && (
        <Row
          left={z.difference === 0 ? 'Écart' : z.difference > 0 ? 'Excédent' : 'Manquant'}
          right={money(Math.abs(z.difference))}
          strong
        />
      )}
      <Rule />
      <div className="mt-6 grid grid-cols-2 gap-4 text-center text-[10px]">
        <div className="border-t border-black pt-1">Caissier</div>
        <div className="border-t border-black pt-1">Gérant</div>
      </div>
    </Paper>
  )
}
