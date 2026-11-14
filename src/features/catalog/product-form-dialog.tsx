import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
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
import { formatXof, priceWithVat, productInputSchema, type ProductRow } from '@/shared'
import { useCategories, useCreateCategory, useCreateProduct, useUpdateProduct } from './queries'
import { fieldErrors, parseNumber, selectClass } from './form-utils'
import { Field } from './ui'

const NEW_CATEGORY = '__new__'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Absent : création. Présent : modification (le stock ne change jamais ici). */
  product?: ProductRow
}

export function ProductFormDialog({ open, onOpenChange, product }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {/* Remonté à chaque ouverture : le formulaire repart de l'article courant. */}
        {open && <ProductForm product={product} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ProductForm({ product, onDone }: { product?: ProductRow; onDone: () => void }) {
  const categories = useCategories()
  const createCategory = useCreateCategory()
  const create = useCreateProduct()
  const update = useUpdateProduct(product?.id ?? '')
  const saving = create.isPending || update.isPending || createCategory.isPending

  const [v, setV] = useState({
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    categoryId: product?.category?.id ?? '',
    newCategory: '',
    unit: product?.unit ?? '',
    salePrice: product ? String(product.salePrice) : '',
    vatRate: String(product?.vatRate ?? 18),
    alertThreshold: product ? String(product.alertThreshold) : '',
    location: product?.location ?? '',
    barcode: product?.barcode ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }))

  const priceHt = parseNumber(v.salePrice)
  const vat = Number(v.vatRate)
  const ttc = priceHt !== undefined && Number.isFinite(priceHt) ? priceWithVat(priceHt, vat) : undefined

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const raw = {
      sku: v.sku,
      name: v.name,
      categoryId: v.categoryId && v.categoryId !== NEW_CATEGORY ? v.categoryId : undefined,
      unit: v.unit,
      salePrice: priceHt,
      vatRate: vat,
      alertThreshold: parseNumber(v.alertThreshold) ?? 0,
      location: v.location.trim() || undefined,
      barcode: v.barcode.trim() || undefined,
    }
    const parsed = productInputSchema.safeParse(raw)
    const errs = parsed.success ? {} : fieldErrors(parsed.error.issues, raw)
    if (v.categoryId === NEW_CATEGORY && v.newCategory.trim().length < 2) {
      errs.newCategory = 'Nom de catégorie trop court'
    }
    setErrors(errs)
    if (!parsed.success || Object.keys(errs).length) return

    try {
      const input = { ...parsed.data }
      if (v.categoryId === NEW_CATEGORY) {
        input.categoryId = (await createCategory.mutateAsync(v.newCategory.trim())).id
      }
      if (product) {
        await update.mutateAsync(input)
        toast.success(`Article ${input.sku} mis à jour`)
      } else {
        await create.mutateAsync(input)
        toast.success(`Article ${input.sku} créé`, { description: 'Stock à 0 : saisissez une entrée de stock.' })
      }
      onDone()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const inv = (k: string) => ({ 'aria-invalid': Boolean(errors[k]) || undefined, 'aria-describedby': errors[k] ? `pf-${k}-error` : undefined })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{product ? `Modifier ${product.sku}` : 'Nouvel article'}</DialogTitle>
        <DialogDescription>
          {product
            ? 'Le stock et le PMP ne se modifient pas ici : ils évoluent uniquement par mouvement.'
            : 'L’article est créé avec un stock à zéro.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="pf-sku" label="Référence (SKU)" error={errors.sku}>
          <Input id="pf-sku" value={v.sku} onChange={set('sku')} placeholder="MAT-CIM-425" className="font-mono uppercase" autoFocus={!product} {...inv('sku')} />
        </Field>
        <Field id="pf-barcode" label="Code-barres (optionnel)" error={errors.barcode}>
          <Input id="pf-barcode" value={v.barcode} onChange={set('barcode')} inputMode="numeric" placeholder="EAN-13" className="font-mono" {...inv('barcode')} />
        </Field>
        <Field id="pf-name" label="Désignation" error={errors.name} className="sm:col-span-2">
          <Input id="pf-name" value={v.name} onChange={set('name')} placeholder="Ciment Portland CEM II 42,5R" {...inv('name')} />
        </Field>
        <Field id="pf-category" label="Catégorie">
          <select id="pf-category" value={v.categoryId} onChange={set('categoryId')} className={selectClass}>
            <option value="">Sans catégorie</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={NEW_CATEGORY}>+ Nouvelle catégorie…</option>
          </select>
        </Field>
        <Field id="pf-unit" label="Unité" error={errors.unit} hint="sac 50 kg, barre 12 m, pièce, m³…">
          <Input id="pf-unit" value={v.unit} onChange={set('unit')} {...inv('unit')} />
        </Field>
        {v.categoryId === NEW_CATEGORY && (
          <Field id="pf-newCategory" label="Nom de la nouvelle catégorie" error={errors.newCategory} className="sm:col-span-2">
            <Input id="pf-newCategory" value={v.newCategory} onChange={set('newCategory')} autoFocus {...inv('newCategory')} />
          </Field>
        )}
        <Field
          id="pf-salePrice"
          label="Prix de vente HT (FCFA)"
          error={errors.salePrice}
          hint={ttc !== undefined ? `Soit ${formatXof(ttc)} TTC` : undefined}
        >
          <Input id="pf-salePrice" value={v.salePrice} onChange={set('salePrice')} inputMode="numeric" className="font-mono" {...inv('salePrice')} />
        </Field>
        <Field id="pf-vat" label="TVA">
          <select id="pf-vat" value={v.vatRate} onChange={set('vatRate')} className={selectClass}>
            <option value="18">18 % (taux normal)</option>
            <option value="10">10 % (taux réduit)</option>
            <option value="0">0 % (exonéré)</option>
          </select>
        </Field>
        <Field id="pf-alertThreshold" label="Seuil d’alerte" error={errors.alertThreshold} hint="Stock bas en dessous de ce niveau">
          <Input id="pf-alertThreshold" value={v.alertThreshold} onChange={set('alertThreshold')} inputMode="decimal" className="font-mono" {...inv('alertThreshold')} />
        </Field>
        <Field id="pf-location" label="Emplacement (optionnel)" error={errors.location}>
          <Input id="pf-location" value={v.location} onChange={set('location')} placeholder="Allée A-04" {...inv('location')} />
        </Field>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Enregistrement…' : product ? 'Enregistrer' : 'Créer l’article'}
        </Button>
      </DialogFooter>
    </form>
  )
}
