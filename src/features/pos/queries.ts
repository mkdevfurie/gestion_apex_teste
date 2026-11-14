import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, post } from '@/lib/api'
import type { CashSessionClose, CashSessionOpen, CashSessionSummary, PaymentMethod, SaleInput, SaleReceipt } from '@/shared'

export const posKeys = {
  session: ['pos', 'session'] as const,
  sales: (sessionId: string) => ['pos', 'sales', sessionId] as const,
  receipt: (id: string) => ['pos', 'receipt', id] as const,
}

export type SessionSale = { id: string; number: string; issuedAt: string; total: number; methods: PaymentMethod[] }

export const useCurrentSession = () =>
  useQuery({
    queryKey: posKeys.session,
    queryFn: async () => (await api<{ session: CashSessionSummary | null }>('/cash-sessions/current')).session,
  })

export const useSessionSales = (sessionId: string | undefined) =>
  useQuery({
    queryKey: posKeys.sales(sessionId ?? ''),
    queryFn: () => api<SessionSale[]>(`/cash-sessions/${sessionId}/sales`),
    enabled: Boolean(sessionId),
  })

export const useReceipt = (id: string | null) =>
  useQuery({
    queryKey: posKeys.receipt(id ?? ''),
    queryFn: () => api<SaleReceipt>(`/sales/${id}/receipt`),
    enabled: Boolean(id),
    staleTime: Infinity,
  })

export function useOpenSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CashSessionOpen) => post<CashSessionSummary>('/cash-sessions', input),
    onSuccess: (s) => qc.setQueryData(posKeys.session, s),
  })
}

export function useCloseSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: CashSessionClose & { id: string }) =>
      post<CashSessionSummary>(`/cash-sessions/${id}/close`, input),
    onSuccess: () => qc.setQueryData(posKeys.session, null),
  })
}

export function useCreateSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SaleInput) => post<SaleReceipt>('/sales', input),
    onSuccess: (receipt) => {
      qc.setQueryData(posKeys.receipt(receipt.id), receipt)
      // Stock, indicateurs de session et liste des tickets ont changé.
      void Promise.all([
        qc.invalidateQueries({ queryKey: posKeys.session }),
        qc.invalidateQueries({ queryKey: ['pos', 'sales'] }),
        qc.invalidateQueries({ queryKey: ['products'] }),
        qc.invalidateQueries({ queryKey: ['product'] }),
        qc.invalidateQueries({ queryKey: ['movements'] }),
      ])
    },
  })
}
