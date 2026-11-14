import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, patch, post, qs } from '@/lib/api'
import type {
  AccountPayment,
  CustomerInput,
  CustomerRow,
  CustomerUpdate,
  DocumentDetail,
  DocumentKind,
  DocumentRow,
  InventoryBatch,
  InventoryReport,
  Paged,
  PurchaseDetail,
  PurchaseInput,
  PurchaseRow,
  QuoteConvert,
  QuoteInput,
  RefundInput,
  SupplierInput,
  SupplierRow,
} from '@/shared'

type Q = Record<string, string | number | boolean | undefined>

/** Après une écriture commerciale : comptes, documents, stock et caisse ont pu changer. */
function useInvalidateCommerce() {
  const qc = useQueryClient()
  return () => {
    for (const key of ['customers', 'customer', 'documents', 'document', 'suppliers', 'purchases', 'purchase', 'products', 'product', 'movements', 'pos']) {
      void qc.invalidateQueries({ queryKey: [key] })
    }
  }
}

// ───────────── Clients ─────────────
export const useCustomers = (f: Q & { page: number; pageSize: number }, enabled = true) =>
  useQuery({
    queryKey: ['customers', f],
    queryFn: () => api<Paged<CustomerRow>>(`/customers${qs(f)}`),
    placeholderData: keepPreviousData,
    enabled,
  })

export const useCustomer = (id: string | null | undefined) =>
  useQuery({ queryKey: ['customer', id], queryFn: () => api<CustomerRow>(`/customers/${id}`), enabled: Boolean(id) })

export function useSaveCustomer(id?: string) {
  const invalidate = useInvalidateCommerce()
  return useMutation({
    mutationFn: (input: CustomerInput | CustomerUpdate) =>
      id ? patch<CustomerRow>(`/customers/${id}`, input) : post<CustomerRow>('/customers', input),
    onSuccess: invalidate,
  })
}

export function useCustomerPayment(id: string) {
  const invalidate = useInvalidateCommerce()
  return useMutation({
    mutationFn: (input: AccountPayment) =>
      post<{ allocated: { id: string; amount: number; number: string }[] }>(`/customers/${id}/payments`, input),
    onSuccess: invalidate,
  })
}

// ───────────── Documents ─────────────
export const useDocuments = (f: { kind?: DocumentKind; customerId?: string; q?: string; unpaidOnly?: boolean; page: number; pageSize: number }) =>
  useQuery({
    queryKey: ['documents', f],
    queryFn: () => api<Paged<DocumentRow>>(`/documents${qs(f)}`),
    placeholderData: keepPreviousData,
  })

export const useDocument = (id: string | null | undefined) =>
  useQuery({ queryKey: ['document', id], queryFn: () => api<DocumentDetail>(`/documents/${id}`), enabled: Boolean(id) })

export function useCreateQuote() {
  const invalidate = useInvalidateCommerce()
  return useMutation({ mutationFn: (input: QuoteInput) => post<DocumentDetail>('/documents/quotes', input), onSuccess: invalidate })
}

export function useConvertQuote(id: string) {
  const invalidate = useInvalidateCommerce()
  return useMutation({ mutationFn: (input: QuoteConvert) => post<DocumentDetail>(`/documents/${id}/convert`, input), onSuccess: invalidate })
}

export function useRefund(id: string) {
  const invalidate = useInvalidateCommerce()
  return useMutation({ mutationFn: (input: RefundInput) => post<DocumentDetail>(`/documents/${id}/refund`, input), onSuccess: invalidate })
}

// ───────────── Achats ─────────────
export const useSuppliers = (f: Q & { page: number; pageSize: number }) =>
  useQuery({ queryKey: ['suppliers', f], queryFn: () => api<Paged<SupplierRow>>(`/suppliers${qs(f)}`), placeholderData: keepPreviousData })

export function useSaveSupplier() {
  const invalidate = useInvalidateCommerce()
  return useMutation({ mutationFn: (input: SupplierInput) => post<SupplierRow>('/suppliers', input), onSuccess: invalidate })
}

export function useSupplierPayment(id: string) {
  const invalidate = useInvalidateCommerce()
  return useMutation({ mutationFn: (input: AccountPayment) => post(`/suppliers/${id}/payments`, input), onSuccess: invalidate })
}

export const usePurchases = (f: Q & { page: number; pageSize: number }) =>
  useQuery({ queryKey: ['purchases', f], queryFn: () => api<Paged<PurchaseRow>>(`/purchases${qs(f)}`), placeholderData: keepPreviousData })

export const usePurchase = (id: string | null) =>
  useQuery({ queryKey: ['purchase', id], queryFn: () => api<PurchaseDetail>(`/purchases/${id}`), enabled: Boolean(id) })

export function useReceivePurchase() {
  const invalidate = useInvalidateCommerce()
  return useMutation({ mutationFn: (input: PurchaseInput) => post<PurchaseDetail>('/purchases', input), onSuccess: invalidate })
}

// ───────────── Inventaire ─────────────
export function useInventoryBatch() {
  const invalidate = useInvalidateCommerce()
  return useMutation({ mutationFn: (input: InventoryBatch) => post<InventoryReport>('/stock/inventory/batch', input), onSuccess: invalidate })
}
