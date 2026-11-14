import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, patch, post, qs } from '@/lib/api'
import type {
  Category,
  InventoryCount,
  MovementInput,
  MovementRow,
  MovementType,
  ProductDetail,
  ProductInput,
  ProductPage,
  ProductRow,
  ProductUpdate,
  StockStatus,
  TransferInput,
  Warehouse,
} from '@/shared'

export type ProductFilters = {
  q?: string
  categoryId?: string
  warehouseId?: string
  status?: StockStatus
  page: number
  pageSize: number
}

export type MovementFilters = {
  warehouseId?: string
  productId?: string
  type?: MovementType
  page: number
  pageSize: number
}

type MovementPage = { items: MovementRow[]; total: number; page: number; pageSize: number }

export const catalogKeys = {
  warehouses: ['warehouses'] as const,
  categories: ['categories'] as const,
  products: (f: ProductFilters) => ['products', f] as const,
  product: (id: string, warehouseId?: string) => ['product', id, warehouseId] as const,
  movements: (f: MovementFilters) => ['movements', f] as const,
}

export const useWarehouses = () =>
  useQuery({
    queryKey: catalogKeys.warehouses,
    queryFn: () => api<Warehouse[]>('/warehouses'),
    staleTime: 5 * 60_000,
  })

export const useCategories = () =>
  useQuery({ queryKey: catalogKeys.categories, queryFn: () => api<Category[]>('/categories') })

export const useProducts = (f: ProductFilters) =>
  useQuery({
    queryKey: catalogKeys.products(f),
    queryFn: () => api<ProductPage>(`/products${qs(f)}`),
    placeholderData: keepPreviousData,
  })

export const useProduct = (id: string | undefined, warehouseId?: string) =>
  useQuery({
    queryKey: catalogKeys.product(id ?? '', warehouseId),
    queryFn: () => api<ProductDetail>(`/products/${id}${qs({ warehouseId })}`),
    enabled: Boolean(id),
  })

export const useMovements = (f: MovementFilters, enabled = true) =>
  useQuery({
    queryKey: catalogKeys.movements(f),
    queryFn: () => api<MovementPage>(`/stock/movements${qs(f)}`),
    placeholderData: keepPreviousData,
    enabled,
  })

/**
 * Toute écriture de stock rafraîchit listes, fiches et journal.
 * Sans attendre : la fenêtre se ferme dès que le serveur a confirmé l'écriture
 * (le rechargement peut être lent quand Neon sort de veille).
 */
function useStockInvalidation() {
  const qc = useQueryClient()
  return () => {
    void Promise.all([
      qc.invalidateQueries({ queryKey: ['products'] }),
      qc.invalidateQueries({ queryKey: ['product'] }),
      qc.invalidateQueries({ queryKey: ['movements'] }),
      qc.invalidateQueries({ queryKey: catalogKeys.categories }),
    ])
  }
}

export function useCreateProduct() {
  const invalidate = useStockInvalidation()
  return useMutation({
    mutationFn: (input: ProductInput) => post<ProductRow>('/products', input),
    onSuccess: invalidate,
  })
}

export function useUpdateProduct(id: string) {
  const invalidate = useStockInvalidation()
  return useMutation({
    mutationFn: (input: ProductUpdate) => patch<ProductRow>(`/products/${id}`, input),
    onSuccess: invalidate,
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => post<Category>('/categories', { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogKeys.categories }),
  })
}

export function useRecordMovement() {
  const invalidate = useStockInvalidation()
  return useMutation({
    mutationFn: (input: MovementInput) => post<MovementRow>('/stock/movements', input),
    onSuccess: invalidate,
  })
}

export function useInventoryCount() {
  const invalidate = useStockInvalidation()
  return useMutation({
    mutationFn: (input: InventoryCount) =>
      post<{ difference: number; movement: MovementRow | null }>('/stock/inventory', input),
    onSuccess: invalidate,
  })
}

export function useTransfer() {
  const invalidate = useStockInvalidation()
  return useMutation({
    mutationFn: (input: TransferInput) =>
      post<{ transferGroup: string; movements: MovementRow[] }>('/stock/transfers', input),
    onSuccess: invalidate,
  })
}
