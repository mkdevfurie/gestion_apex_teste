import { useState, type FormEvent } from 'react'
import { Printer, Store } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { parseNumber, selectClass } from '@/features/catalog/form-utils'
import { useWarehouses } from '@/features/catalog/queries'
import { useSettings } from '@/features/reports/queries'
import { Field } from '@/features/catalog/ui'
import { formatXof, type CashSessionSummary } from '@/shared'
import { useCloseSession, useOpenSession } from './queries'
import { ZReport } from './receipt'

/** Écran d'ouverture : dépôt + fond de caisse. */
export function OpenSessionCard({ userName }: { userName: string }) {
  const warehouses = useWarehouses()
  const open = useOpenSession()
  const minFloat = useSettings().data?.minOpeningFloat ?? 0
  const [warehouseId, setWarehouseId] = useState('')
  const [float, setFloat] = useState('')
  const [error, setError] = useState<string>()

  const selected = warehouseId || warehouses.data?.find((w) => w.code.startsWith('DEP'))?.id || warehouses.data?.[0]?.id || ''

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const amount = parseNumber(float) ?? 0
    if (!Number.isInteger(amount) || amount < 0) {
      setError('Montant invalide')
      return
    }
    if (amount < minFloat) {
      setError(`Fond de caisse minimum : ${formatXof(minFloat)}`)
      return
    }
    setError(undefined)
    try {
      await open.mutateAsync({ warehouseId: selected, openingFloat: amount })
      toast.success('Caisse ouverte')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Card className="w-full max-w-md">
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
                <Store className="size-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Ouvrir la caisse</h1>
                <p className="text-sm text-muted-foreground">Bonjour {userName}, comptez le fond de caisse avant de commencer.</p>
              </div>
            </div>
            <Field id="open-warehouse" label="Dépôt de vente">
              <select id="open-warehouse" value={selected} onChange={(e) => setWarehouseId(e.target.value)} className={selectClass}>
                {warehouses.data?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="open-float" label="Fond de caisse (espèces)" error={error} hint={minFloat ? `Minimum : ${formatXof(minFloat)}. Billets et pièces présents dans le tiroir.` : 'Billets et pièces présents dans le tiroir à l’ouverture.'}>
              <Input
                id="open-float"
                value={float}
                onChange={(e) => setFloat(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                placeholder="0"
                className="h-11 text-right font-mono text-lg"
                autoFocus
              />
            </Field>
            <Button type="submit" className="h-11 w-full" disabled={open.isPending || !selected}>
              {open.isPending ? 'Ouverture…' : 'Ouvrir la caisse'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

/** Clôture « à l'aveugle » : on saisit le comptage avant de voir l'attendu. */
export function CloseSessionDialog({
  session,
  open,
  onOpenChange,
  onClosed,
}: {
  session: CashSessionSummary
  open: boolean
  onOpenChange: (o: boolean) => void
  /** Reçoit le ticket Z (la page de caisse se démonte à la clôture). */
  onClosed: (z: CashSessionSummary) => void
}) {
  const close = useCloseSession()
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string>()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const amount = parseNumber(counted)
    if (amount === undefined || !Number.isInteger(amount)) {
      setError('Saisissez le montant compté')
      return
    }
    setError(undefined)
    try {
      onClosed(await close.mutateAsync({ id: session.id, countedCash: amount, notes: notes.trim() || undefined }))
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Clôturer la caisse</DialogTitle>
              <DialogDescription>
                Comptez les espèces du tiroir (fond de caisse compris) et saisissez le total. L’écart s’affichera après validation.
              </DialogDescription>
            </DialogHeader>
            <Field id="close-counted" label="Espèces comptées" error={error}>
              <Input
                id="close-counted"
                value={counted}
                onChange={(e) => setCounted(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                className="h-11 text-right font-mono text-lg"
                autoFocus
              />
            </Field>
            <Field id="close-notes" label="Remarque (optionnel)">
              <Input id="close-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex. billet de 10 000 abîmé" />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={close.isPending}>
                {close.isPending ? 'Clôture…' : 'Clôturer et éditer le Z'}
              </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Ticket Z affiché après la clôture (au niveau de la page). */
export function ZReportDialog({ z, onClose }: { z: CashSessionSummary | null; onClose: () => void }) {
  return (
    <Dialog open={z !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {z && (
          <>
            <DialogHeader>
              <DialogTitle>Caisse clôturée</DialogTitle>
              <DialogDescription>
                {z.difference === 0
                  ? 'Le comptage correspond aux espèces attendues.'
                  : `Écart de caisse : ${z.difference! > 0 ? 'excédent' : 'manquant'} de ${formatXof(Math.abs(z.difference!))}.`}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[55vh] overflow-y-auto rounded-md border bg-muted/40 py-2">
              <ZReport z={z} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer /> Imprimer le ticket Z
              </Button>
              <Button onClick={onClose}>Terminer</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
