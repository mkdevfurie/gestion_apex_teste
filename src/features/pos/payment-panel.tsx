import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseNumber } from '@/features/catalog/form-utils'
import { formatXof, paymentMethodLabels, quickCashAmounts, type PaymentMethod, type Settlement } from '@/shared'
import { newPayment, type MoneyMethod, type PaymentDraft } from './payment-draft'

const METHODS: MoneyMethod[] = ['CASH', 'WAVE', 'ORANGE_MONEY', 'FREE_MONEY', 'CARD', 'BANK_TRANSFER', 'CHEQUE']
const needsReference = (m: PaymentMethod) => m !== 'CASH'

type Props = {
  total: number
  payments: PaymentDraft[]
  onChange: (p: PaymentDraft[]) => void
  settlement: Settlement | null
  disabled?: boolean
}

export function PaymentPanel({ total, payments, onChange, settlement, disabled }: Props) {
  const single = payments.length === 1
  const update = (key: string, patch: Partial<PaymentDraft>) =>
    onChange(payments.map((p) => (p.key === key ? { ...p, ...patch } : p)))

  const otherPaid = (exceptKey: string) =>
    payments.filter((p) => p.key !== exceptKey).reduce((a, p) => a + (parseNumber(p.amount) || 0), 0)

  /** Choix du moyen (paiement simple) : hors espèces, on propose le montant exact. */
  function pickMethod(method: MoneyMethod) {
    const p = payments[0]
    onChange([{ ...p, method, amount: method === 'CASH' ? '' : String(total), reference: '' }])
  }

  function addPayment() {
    const remaining = Math.max(0, total - payments.reduce((a, p) => a + (parseNumber(p.amount) || 0), 0))
    onChange([...payments, newPayment('WAVE', remaining ? String(remaining) : '')])
  }

  const cashRow = payments.find((p) => p.method === 'CASH')
  const cashDue = cashRow ? Math.max(0, total - otherPaid(cashRow.key)) : 0

  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Règlement</legend>

      {single && (
        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Moyen de paiement">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={payments[0].method === m}
              onClick={() => pickMethod(m)}
              className={cn(
                'h-10 rounded-md border px-1 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                payments[0].method === m ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent',
              )}
            >
              {paymentMethodLabels[m]}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {payments.map((p, i) => (
          <div key={p.key} className="space-y-1.5 rounded-md border bg-background p-2">
            <div className="flex items-center gap-2">
              {single ? (
                <span className="min-w-28 text-sm font-medium">{paymentMethodLabels[p.method]}</span>
              ) : (
                <>
                  <label htmlFor={`pm-${p.key}`} className="sr-only">
                    Moyen de paiement {i + 1}
                  </label>
                  <select
                    id={`pm-${p.key}`}
                    value={p.method}
                    onChange={(e) => update(p.key, { method: e.target.value as MoneyMethod })}
                    className="h-9 min-w-28 rounded-md border border-input bg-card px-2 text-sm"
                  >
                    {METHODS.map((m) => (
                      <option key={m} value={m}>
                        {paymentMethodLabels[m]}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <label htmlFor={`amt-${p.key}`} className="sr-only">
                {p.method === 'CASH' ? 'Montant reçu en espèces' : `Montant ${paymentMethodLabels[p.method]}`}
              </label>
              <div className="relative flex-1">
                <Input
                  id={`amt-${p.key}`}
                  value={p.amount}
                  onChange={(e) => update(p.key, { amount: e.target.value.replace(/[^\d]/g, '') })}
                  inputMode="numeric"
                  placeholder={p.method === 'CASH' ? 'Montant reçu' : 'Montant'}
                  className="h-10 pr-14 text-right font-mono text-base"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-muted-foreground">
                  FCFA
                </span>
              </div>
              {!single && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Retirer le paiement ${paymentMethodLabels[p.method]}`}
                  onClick={() => onChange(payments.filter((x) => x.key !== p.key))}
                >
                  <X />
                </Button>
              )}
            </div>
            {needsReference(p.method) && (
              <>
                <label htmlFor={`ref-${p.key}`} className="sr-only">
                  Référence de la transaction
                </label>
                <Input
                  id={`ref-${p.key}`}
                  value={p.reference}
                  onChange={(e) => update(p.key, { reference: e.target.value })}
                  placeholder={p.method === 'CHEQUE' ? 'N° de chèque (optionnel)' : 'Référence de transaction (optionnel)'}
                  className="h-8 font-mono text-xs"
                />
              </>
            )}
          </div>
        ))}
      </div>

      {cashRow && total > 0 && (
        <div className="grid grid-cols-4 gap-1.5">
          {quickCashAmounts(cashDue).map((v, i) => (
            <button
              key={v}
              type="button"
              onClick={() => update(cashRow.key, { amount: String(v) })}
              className="h-9 rounded-md border bg-background font-mono text-xs hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {i === 0 ? 'Exact' : formatXof(v).replace(' FCFA', '')}
            </button>
          ))}
        </div>
      )}

      {payments.length < 6 && (
        <button
          type="button"
          onClick={addPayment}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <Plus className="size-3.5" /> Paiement mixte (ex. espèces + Wave)
        </button>
      )}

      <SettlementLine settlement={settlement} hasAmount={payments.some((p) => p.amount)} />
    </fieldset>
  )
}

function SettlementLine({ settlement, hasAmount }: { settlement: Settlement | null; hasAmount: boolean }) {
  if (!settlement) return null
  if (settlement.ok) {
    return (
      <div className="flex items-center justify-between rounded-md bg-success-soft px-3 py-2 text-success-soft-foreground" aria-live="polite">
        <span className="text-sm font-medium">Monnaie à rendre</span>
        <span className="font-mono text-2xl font-semibold">{formatXof(settlement.change)}</span>
      </div>
    )
  }
  if (!hasAmount) return null
  return (
    <div className="flex items-center justify-between rounded-md bg-warning-soft px-3 py-2 text-warning-soft-foreground" aria-live="polite">
      <span className="text-sm font-medium">{settlement.remaining > 0 ? 'Reste à payer' : settlement.error}</span>
      {settlement.remaining > 0 && <span className="font-mono text-xl font-semibold">{formatXof(settlement.remaining)}</span>}
    </div>
  )
}
