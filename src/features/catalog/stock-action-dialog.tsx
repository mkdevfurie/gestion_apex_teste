import { useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatQty, formatSignedQty } from '@/lib/format'
import {
  formatXof,
  inventoryCountSchema,
  isInbound,
  manualMovementTypes,
  movementInputSchema,
  movementTypeLabels,
  transferInputSchema,
  type ProductRow,
} from '@/shared'
import { useInventoryCount, useProduct, useProducts, useRecordMovement, useTransfer, useWarehouses } from './queries'
import { fieldErrors, parseNumber, selectClass } from './form-utils'
import { Caps, Field } from './ui'

export type StockAction =
  | { mode: 'movement'; type?: (typeof manualMovementTypes)[number] }
  | { mode: 'inventory' }
  | { mode: 'transfer' }

type Props = {
  action: StockAction | null
  onClose: () => void
  /** Article présélectionné (depuis la fiche). */
  product?: Pick<ProductRow, 'id' | 'sku' | 'name' | 'unit'>
  /** Dépôt présélectionné (filtre courant). */
  warehouseId?: string
}

const titles = {
  movement: 'Saisir un mouvement',
  inventory: 'Ajustement d’inventaire',
  transfer: 'Transfert entre dépôts',
}

const descriptions = {
  movement: 'Le mouvement est définitif : une erreur se corrige par un mouvement inverse.',
  inventory: 'Saisissez la quantité comptée : l’écart est enregistré comme ajustement.',
  transfer: 'Crée une sortie et une entrée liées, valorisées au PMP.',
}

export function StockActionDialog({ action, onClose, product, warehouseId }: Props) {
  return (
    <Dialog open={action !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {action && (
          <StockActionForm
            key={action.mode}
            action={action}
            onDone={onClose}
            preset={product}
            warehouseId={warehouseId}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function StockActionForm({
  action,
  onDone,
  preset,
  warehouseId,
}: {
  action: StockAction
  onDone: () => void
  preset?: Props['product']
  warehouseId?: string
}) {
  const warehouses = useWarehouses()
  const defaultWarehouse =
    warehouseId ?? warehouses.data?.find((w) => w.code.startsWith('DEP'))?.id ?? warehouses.data?.[0]?.id ?? ''

  const [picked, setPicked] = useState(preset)
  const [type, setType] = useState<(typeof manualMovementTypes)[number]>(
    action.mode === 'movement' ? (action.type ?? 'PURCHASE_RECEIPT') : 'PURCHASE_RECEIPT',
  )
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const fromId = from || defaultWarehouse
  const toId = to || warehouses.data?.find((w) => w.id !== fromId)?.id || ''

  const detail = useProduct(picked?.id)
  const stockIn = (id: string) => detail.data?.stockByWarehouse.find((s) => s.warehouseId === id)?.quantity ?? 0
  const current = stockIn(fromId)
  const qty = parseNumber(quantity)

  const record = useRecordMovement()
  const inventory = useInventoryCount()
  const transfer = useTransfer()
  const saving = record.isPending || inventory.isPending || transfer.isPending

  // Aperçu du solde après opération (le serveur reste seul juge).
  let after: number | undefined
  if (qty !== undefined && Number.isFinite(qty) && picked) {
    if (action.mode === 'inventory') after = qty
    else if (action.mode === 'transfer') after = current - qty
    else after = isInbound(type) ? current + qty : current - qty
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!picked) {
      setErrors({ productId: 'Choisissez un article' })
      return
    }
    const base = { productId: picked.id, reason: reason.trim() || undefined }
    const parsed =
      action.mode === 'movement'
        ? movementInputSchema.safeParse({
            ...base,
            type,
            warehouseId: fromId,
            quantity: qty,
            unitCost: type === 'PURCHASE_RECEIPT' ? parseNumber(unitCost) : undefined,
          })
        : action.mode === 'inventory'
          ? inventoryCountSchema.safeParse({ ...base, warehouseId: fromId, countedQuantity: qty })
          : transferInputSchema.safeParse({ ...base, fromWarehouseId: fromId, toWarehouseId: toId, quantity: qty })

    if (!parsed.success) {
      const errs = fieldErrors(parsed.error.issues, {
        quantity: qty,
        countedQuantity: qty,
        unitCost: parseNumber(unitCost),
      })
      // Le champ affiché s'appelle "quantity" quel que soit le mode.
      if (errs.countedQuantity) errs.quantity = errs.countedQuantity
      setErrors(errs)
      return
    }
    setErrors({})

    try {
      if (action.mode === 'movement') {
        const m = await record.mutateAsync(parsed.data as Parameters<typeof record.mutateAsync>[0])
        toast.success(`${movementTypeLabels[m.type]} enregistrée`, {
          description: `${picked.sku} : ${formatSignedQty(m.quantity)} ${picked.unit} · solde ${formatQty(m.balanceAfter)}`,
        })
      } else if (action.mode === 'inventory') {
        const r = await inventory.mutateAsync(parsed.data as Parameters<typeof inventory.mutateAsync>[0])
        if (r.difference === 0) toast.info(`${picked.sku} : aucun écart, rien n’a été enregistré`)
        else toast.success(`Écart de ${formatSignedQty(r.difference)} ${picked.unit} enregistré`, { description: picked.sku })
      } else {
        await transfer.mutateAsync(parsed.data as Parameters<typeof transfer.mutateAsync>[0])
        toast.success(`Transfert de ${formatQty(qty ?? 0)} ${picked.unit} enregistré`, { description: picked.sku })
      }
      onDone()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const inv = (k: string) => ({
    'aria-invalid': Boolean(errors[k]) || undefined,
    'aria-describedby': errors[k] ? `sa-${k}-error` : undefined,
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{titles[action.mode]}</DialogTitle>
        <DialogDescription>{descriptions[action.mode]}</DialogDescription>
      </DialogHeader>

      {preset ? (
        <div className="rounded-md border bg-background px-3 py-2">
          <div className="font-mono text-xs text-muted-foreground">{preset.sku}</div>
          <div className="font-medium">{preset.name}</div>
        </div>
      ) : (
        <ProductPicker value={picked} onChange={setPicked} error={errors.productId} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {action.mode === 'movement' && (
          <Field id="sa-type" label="Type de mouvement" className="sm:col-span-2">
            <select id="sa-type" value={type} onChange={(e) => setType(e.target.value as typeof type)} className={selectClass}>
              {manualMovementTypes.map((t) => (
                <option key={t} value={t}>
                  {isInbound(t) ? '↓ Entrée' : '↑ Sortie'} — {movementTypeLabels[t]}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field id="sa-from" label={action.mode === 'transfer' ? 'Depuis le dépôt' : 'Dépôt'} error={errors.warehouseId ?? errors.fromWarehouseId}>
          <select id="sa-from" value={fromId} onChange={(e) => setFrom(e.target.value)} className={selectClass}>
            {warehouses.data?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
        </Field>

        {action.mode === 'transfer' && (
          <Field id="sa-toWarehouseId" label="Vers le dépôt" error={errors.toWarehouseId}>
            <select id="sa-toWarehouseId" value={toId} onChange={(e) => setTo(e.target.value)} className={selectClass} {...inv('toWarehouseId')}>
              {warehouses.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field
          id="sa-quantity"
          label={action.mode === 'inventory' ? `Quantité comptée${picked ? ` (${picked.unit})` : ''}` : `Quantité${picked ? ` (${picked.unit})` : ''}`}
          error={errors.quantity}
        >
          <Input id="sa-quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" className="font-mono" autoFocus={Boolean(preset)} {...inv('quantity')} />
        </Field>

        {action.mode === 'movement' && type === 'PURCHASE_RECEIPT' && (
          <Field
            id="sa-unitCost"
            label="Coût d’achat unitaire HT"
            error={errors.unitCost}
            hint={detail.data ? `PMP actuel : ${formatXof(detail.data.averageCost)}` : 'Sert au recalcul du PMP'}
          >
            <Input id="sa-unitCost" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} inputMode="numeric" className="font-mono" {...inv('unitCost')} />
          </Field>
        )}

        <Field id="sa-reason" label="Motif / référence (optionnel)" className="sm:col-span-2" error={errors.reason}>
          <Input
            id="sa-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={action.mode === 'movement' && type === 'PURCHASE_RECEIPT' ? 'N° de bon de livraison' : 'Ex. casse à la livraison'}
          />
        </Field>
      </div>

      {picked && (
        <div className="grid grid-cols-2 gap-3 rounded-md border bg-background p-3 text-sm" aria-live="polite">
          <div>
            <Caps>Stock actuel</Caps>
            <div className="font-mono font-semibold">{detail.isPending ? '…' : `${formatQty(current)} ${picked.unit}`}</div>
          </div>
          <div>
            <Caps>Après opération</Caps>
            <div className={cn('font-mono font-semibold', after !== undefined && after < 0 && 'text-destructive')}>
              {after === undefined ? '—' : `${formatQty(after)} ${picked.unit}`}
            </div>
            {after !== undefined && after < 0 && <div className="text-xs text-destructive">Stock insuffisant</div>}
          </div>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" variant={action.mode === 'movement' && isInbound(type) ? 'success' : 'default'} disabled={saving}>
          {saving ? 'Enregistrement…' : 'Valider'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Recherche d'article par SKU, désignation ou code-barres (scan douchette). */
function ProductPicker({
  value,
  onChange,
  error,
}: {
  value?: Props['product']
  onChange: (p: Props['product']) => void
  error?: string
}) {
  const [q, setQ] = useState('')
  const results = useProducts({ q, page: 1, pageSize: 6 })

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
        <div className="min-w-0">
          <div className="font-mono text-xs text-muted-foreground">{value.sku}</div>
          <div className="truncate font-medium">{value.name}</div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
          Changer
        </Button>
      </div>
    )
  }

  return (
    <Field id="sa-productId" label="Article" error={error}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="sa-productId"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="SKU, désignation ou code-barres"
          className="pl-9"
          autoFocus
          aria-invalid={Boolean(error) || undefined}
          aria-controls="sa-product-results"
        />
      </div>
      <ul id="sa-product-results" className="max-h-56 divide-y overflow-y-auto rounded-md border" aria-label="Résultats">
        {results.data?.items.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onChange(p)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            >
              <span className="min-w-0">
                <span className="block font-mono text-xs text-muted-foreground">{p.sku}</span>
                <span className="block truncate">{p.name}</span>
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {formatQty(p.stock)} {p.unit}
              </span>
            </button>
          </li>
        ))}
        {results.data?.items.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Aucun article</li>}
      </ul>
    </Field>
  )
}
