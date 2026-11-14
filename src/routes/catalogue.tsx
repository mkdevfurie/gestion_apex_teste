import { useDeferredValue, useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowLeftRight, ClipboardCheck, Database, PackagePlus, Plus, Search, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateTime, formatQty } from '@/lib/format'
import { useUser } from '@/lib/session'
import {
  can,
  formatXof,
  movementTypeLabels,
  movementTypeSchema,
  priceWithVat,
  stockStatusLabels,
  type CatalogSummary,
  type MovementRow,
  type MovementType,
  type ProductRow,
  type StockStatus,
} from '@/shared'
import { ProductFormDialog } from '@/features/catalog/product-form-dialog'
import { ProductSheet } from '@/features/catalog/product-sheet'
import { useCategories, useMovements, useProducts, useWarehouses } from '@/features/catalog/queries'
import { StockActionDialog, type StockAction } from '@/features/catalog/stock-action-dialog'
import { selectClass } from '@/features/catalog/form-utils'
import { Caps, MovementTypeBadge, SignedQty, StockQty } from '@/features/catalog/ui'

const PAGE_SIZE = 25

export function CataloguePage() {
  const user = useUser()
  const canMove = can(user.role, 'moveStock')
  const canEdit = can(user.role, 'manageCatalog')
  const warehouses = useWarehouses()
  const categories = useCategories()

  // Filtres
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search.trim())
  const [categoryId, setCategoryId] = useState('')
  const [status, setStatus] = useState<StockStatus | ''>('')
  const [warehouseId, setWarehouseId] = useState('')
  const [movementType, setMovementType] = useState<MovementType | ''>('')
  const [tab, setTab] = useState('catalogue')
  const [page, setPage] = useState(1)
  const [journalPage, setJournalPage] = useState(1)

  // Fenêtres
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [action, setAction] = useState<StockAction | null>(null)
  const [actionProduct, setActionProduct] = useState<ProductRow>()
  const [productForm, setProductForm] = useState<{ open: boolean; product?: ProductRow }>({ open: false })

  const products = useProducts({
    q: q || undefined,
    categoryId: categoryId || undefined,
    status: status || undefined,
    warehouseId: warehouseId || undefined,
    page,
    pageSize: PAGE_SIZE,
  })
  const movements = useMovements(
    { warehouseId: warehouseId || undefined, type: movementType || undefined, page: journalPage, pageSize: 50 },
    tab === 'journal',
  )

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPage(1)
    setJournalPage(1)
  }

  const openAction = (a: StockAction, p?: ProductRow) => {
    setActionProduct(p)
    setAction(a)
  }

  const warehouseLabel = warehouses.data?.find((w) => w.id === warehouseId)?.name ?? 'Tous les dépôts'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Caps>Inventaire permanent · {warehouseLabel}</Caps>
          <h1 className="text-2xl font-semibold tracking-tight">Catalogue & mouvements de stock</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {canMove && (
            <Button variant="success" onClick={() => openAction({ mode: 'movement', type: 'PURCHASE_RECEIPT' })}>
              <PackagePlus /> Entrée de stock
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => setProductForm({ open: true })}>
              <Plus /> Nouvel article
            </Button>
          )}
          {canMove && (
            <>
              <Button variant="outline" onClick={() => openAction({ mode: 'inventory' })}>
                <ClipboardCheck /> Inventaire
              </Button>
              <Button variant="outline" onClick={() => openAction({ mode: 'transfer' })}>
                <ArrowLeftRight /> Transfert
              </Button>
            </>
          )}
        </div>
      </div>

      <Kpis summary={products.data?.summary} />

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <Card className="py-3">
          <CardContent className="flex flex-wrap items-end gap-3 px-3">
            <div className="relative min-w-56 flex-1">
              <label htmlFor="cat-search" className="sr-only">
                Rechercher un article
              </label>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="cat-search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Rechercher par SKU, désignation, code-barres"
                className="pl-9"
                disabled={tab !== 'catalogue'}
              />
            </div>
            <FilterSelect id="cat-warehouse" label="Dépôt" value={warehouseId} onChange={resetPage(setWarehouseId)}>
              <option value="">Tous les dépôts</option>
              {warehouses.data?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </FilterSelect>
            {tab === 'catalogue' ? (
              <>
                <FilterSelect id="cat-category" label="Catégorie" value={categoryId} onChange={resetPage(setCategoryId)}>
                  <option value="">Toutes</option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.productCount})
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect id="cat-status" label="État" value={status} onChange={resetPage((v: string) => setStatus(v as StockStatus | ''))}>
                  <option value="">Tous les états</option>
                  {(['OK', 'LOW', 'OUT'] as const).map((s) => (
                    <option key={s} value={s}>
                      {stockStatusLabels[s]}
                    </option>
                  ))}
                </FilterSelect>
              </>
            ) : (
              <FilterSelect id="cat-type" label="Type" value={movementType} onChange={resetPage((v: string) => setMovementType(v as MovementType | ''))}>
                <option value="">Tous les types</option>
                {movementTypeSchema.options.map((t) => (
                  <option key={t} value={t}>
                    {movementTypeLabels[t]}
                  </option>
                ))}
              </FilterSelect>
            )}
            <TabsList>
              <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
              <TabsTrigger value="journal">Journal</TabsTrigger>
            </TabsList>
          </CardContent>
        </Card>

        <TabsContent value="catalogue">
          <Card className="gap-0 overflow-hidden py-0">
            <ProductTable
              rows={products.data?.items}
              loading={products.isPending}
              error={products.error?.message}
              onSelect={(p) => setSelectedId(p.id)}
            />
            <Pager
              page={page}
              pageSize={PAGE_SIZE}
              total={products.data?.total ?? 0}
              noun="articles"
              onPage={setPage}
              fetching={products.isFetching}
            />
          </Card>
        </TabsContent>

        <TabsContent value="journal">
          <Card className="gap-0 overflow-hidden py-0">
            <MovementTable rows={movements.data?.items} loading={movements.isPending} error={movements.error?.message} />
            <Pager
              page={journalPage}
              pageSize={50}
              total={movements.data?.total ?? 0}
              noun="mouvements"
              onPage={setJournalPage}
              fetching={movements.isFetching}
            />
          </Card>
        </TabsContent>
      </Tabs>

      <ProductSheet
        productId={selectedId}
        warehouseId={warehouseId || undefined}
        onClose={() => setSelectedId(null)}
        onAction={canMove ? (a, p) => openAction(a, p) : undefined}
        onEdit={canEdit ? (p) => setProductForm({ open: true, product: p }) : undefined}
      />
      <StockActionDialog
        action={action}
        onClose={() => setAction(null)}
        product={actionProduct}
        warehouseId={warehouseId || undefined}
      />
      <ProductFormDialog
        open={productForm.open}
        product={productForm.product}
        onOpenChange={(open) => setProductForm((s) => ({ ...s, open }))}
      />
    </div>
  )
}

function Kpis({ summary }: { summary?: CatalogSummary }) {
  const loading = !summary
  const ok = summary ? summary.activeCount - summary.lowCount - summary.outCount : 0
  const pct = (n: number) => (summary && summary.activeCount ? (n / summary.activeCount) * 100 : 0)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Valorisation du stock (PMP)" icon={<Wallet />} loading={loading}>
        <div className="font-mono text-2xl font-semibold">{summary && formatXof(summary.valuation)}</div>
        <div className="mt-1 text-sm text-muted-foreground">Quantités × prix moyen pondéré</div>
      </KpiCard>

      <KpiCard label="Articles actifs" loading={loading}>
        <div className="font-mono text-2xl font-semibold">{summary && formatQty(summary.activeCount)}</div>
        <div className="mt-1 text-sm text-muted-foreground">{formatQty(ok)} en stock suffisant</div>
        <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="bg-success" style={{ width: `${pct(ok)}%` }} />
          <div className="bg-warning" style={{ width: `${pct(summary?.lowCount ?? 0)}%` }} />
          <div className="bg-destructive" style={{ width: `${pct(summary?.outCount ?? 0)}%` }} />
        </div>
      </KpiCard>

      <KpiCard
        label="Alertes & ruptures"
        icon={<AlertTriangle className="text-destructive" />}
        loading={loading}
        className={summary && summary.lowCount + summary.outCount > 0 ? 'border-[#FECACA]' : undefined}
      >
        <div className="font-mono text-2xl font-semibold text-danger-soft-foreground">
          {summary && summary.lowCount + summary.outCount}
          <span className="ml-1 font-sans text-sm font-normal text-muted-foreground">articles</span>
        </div>
        <div className="mt-1 flex gap-3 text-sm">
          <span className="text-warning-soft-foreground">{summary?.lowCount} stock bas</span>
          <span className="text-danger-soft-foreground">
            {summary?.outCount} rupture{summary && summary.outCount > 1 ? 's' : ''}
          </span>
        </div>
      </KpiCard>

      <KpiCard label="Journal immuable" icon={<Database />} loading={loading} dark>
        <div className="font-mono text-2xl font-semibold">
          {summary && formatQty(summary.movementCount)}
          <span className="ml-1 font-sans text-sm font-normal opacity-70">mouvements</span>
        </div>
        <div className="mt-1 text-sm opacity-70">Stock = somme des mouvements</div>
      </KpiCard>
    </div>
  )
}

function KpiCard({
  label,
  icon,
  loading,
  dark,
  className,
  children,
}: {
  label: string
  icon?: ReactNode
  loading: boolean
  dark?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={cn('gap-0 py-4', dark && 'border-primary bg-primary text-primary-foreground', className)}>
      <CardContent className="px-4">
        <div className="mb-3 flex items-center justify-between">
          <Caps className={cn(dark && 'text-primary-foreground/70')}>{label}</Caps>
          <span className="[&_svg]:size-4 [&_svg]:opacity-70">{icon}</span>
        </div>
        {loading ? <Skeleton className={cn('h-14 w-3/4', dark && 'bg-white/10')} /> : children}
      </CardContent>
    </Card>
  )
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  children: ReactNode
}) {
  return (
    <div className="grid min-w-40 gap-1">
      <label htmlFor={id} className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {children}
      </select>
    </div>
  )
}

const th = 'h-8 bg-background text-[11px] font-semibold tracking-wider text-muted-foreground uppercase'

function ProductTable({
  rows,
  loading,
  error,
  onSelect,
}: {
  rows?: ProductRow[]
  loading: boolean
  error?: string
  onSelect: (p: ProductRow) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={cn(th, 'pl-4')}>SKU</TableHead>
          <TableHead className={th}>Désignation</TableHead>
          <TableHead className={th}>Catégorie</TableHead>
          <TableHead className={th}>Unité</TableHead>
          <TableHead className={cn(th, 'text-right')}>PMP</TableHead>
          <TableHead className={cn(th, 'text-right')}>Prix TTC</TableHead>
          <TableHead className={cn(th, 'text-right')}>Stock</TableHead>
          <TableHead className={cn(th, 'pr-4 text-right')}>Seuil</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading &&
          Array.from({ length: 6 }, (_, i) => (
            <TableRow key={i}>
              <TableCell colSpan={8} className="px-4">
                <Skeleton className="h-6 w-full" />
              </TableCell>
            </TableRow>
          ))}
        {error && <EmptyRow cols={8}>{error}</EmptyRow>}
        {rows?.length === 0 && <EmptyRow cols={8}>Aucun article ne correspond à ces filtres.</EmptyRow>}
        {rows?.map((p) => (
          <TableRow
            key={p.id}
            tabIndex={0}
            role="button"
            aria-label={`Ouvrir la fiche ${p.sku}`}
            onClick={() => onSelect(p)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(p)
              }
            }}
            className="h-12 cursor-pointer focus-visible:bg-accent focus-visible:outline-none"
          >
            <TableCell className="pl-4 font-mono text-[13px]">{p.sku}</TableCell>
            <TableCell className="max-w-72 whitespace-normal">
              <div className="font-medium">{p.name}</div>
              {p.location && <div className="text-xs text-muted-foreground">{p.location}</div>}
            </TableCell>
            <TableCell>
              {p.category && (
                <Badge variant="secondary" className="rounded-sm text-[11px] tracking-wide uppercase">
                  {p.category.name}
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">{p.unit}</TableCell>
            <TableCell className="text-right font-mono text-[13px]">{formatXof(p.averageCost)}</TableCell>
            <TableCell className="text-right font-mono text-[13px]">{formatXof(priceWithVat(p.salePrice, p.vatRate))}</TableCell>
            <TableCell className="text-right">
              <StockQty value={p.stock} status={p.status} className="text-base" />
              <span className="sr-only"> — {stockStatusLabels[p.status]}</span>
            </TableCell>
            <TableCell className="pr-4 text-right font-mono text-[13px] text-muted-foreground">{formatQty(p.alertThreshold)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function MovementTable({ rows, loading, error }: { rows?: MovementRow[]; loading: boolean; error?: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={cn(th, 'pl-4')}>Date</TableHead>
          <TableHead className={th}>Type</TableHead>
          <TableHead className={th}>Article</TableHead>
          <TableHead className={th}>Dépôt</TableHead>
          <TableHead className={cn(th, 'text-right')}>Quantité</TableHead>
          <TableHead className={cn(th, 'text-right')}>Solde</TableHead>
          <TableHead className={cn(th, 'text-right')}>Coût unit.</TableHead>
          <TableHead className={cn(th, 'pr-4')}>Motif · Saisi par</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading &&
          Array.from({ length: 6 }, (_, i) => (
            <TableRow key={i}>
              <TableCell colSpan={8} className="px-4">
                <Skeleton className="h-6 w-full" />
              </TableCell>
            </TableRow>
          ))}
        {error && <EmptyRow cols={8}>{error}</EmptyRow>}
        {rows?.length === 0 && <EmptyRow cols={8}>Aucun mouvement.</EmptyRow>}
        {rows?.map((m) => (
          <TableRow key={m.id} className="h-11">
            <TableCell className="pl-4 font-mono text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</TableCell>
            <TableCell>
              <MovementTypeBadge type={m.type} />
            </TableCell>
            <TableCell className="max-w-64 whitespace-normal">
              <span className="font-mono text-xs text-muted-foreground">{m.product.sku}</span>{' '}
              <span className="font-medium">{m.product.name}</span>
            </TableCell>
            <TableCell className="font-mono text-xs">{m.warehouse.code}</TableCell>
            <TableCell className="text-right">
              <SignedQty value={m.quantity} />
            </TableCell>
            <TableCell className="text-right font-mono text-[13px]">{formatQty(m.balanceAfter)}</TableCell>
            <TableCell className="text-right font-mono text-[13px] text-muted-foreground">{formatXof(m.unitCost)}</TableCell>
            <TableCell className="max-w-56 pr-4 text-xs whitespace-normal text-muted-foreground">
              {m.reason ?? '—'} · {m.user.name}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-10 text-center text-sm text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  )
}

function Pager({
  page,
  pageSize,
  total,
  noun,
  onPage,
  fetching,
}: {
  page: number
  pageSize: number
  total: number
  noun: string
  onPage: (p: number) => void
  fetching: boolean
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
      <span aria-live="polite">
        {from}–{to} sur {formatQty(total)} {noun}
        {fetching && ' · mise à jour…'}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Précédent
        </Button>
        <span className="font-mono text-xs">
          {page} / {pages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Suivant
        </Button>
      </div>
    </div>
  )
}
