import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, qs } from '@/lib/api'
import {
  defaultSettings,
  type AppSettings,
  type DailySales,
  type EmployeeStats,
  type Overview,
  type Paged,
  type Period,
  type SaleRow,
  type TopProduct,
} from '@/shared'

/** Paramètres de fonctionnement (remise max, TVA par défaut, pied de ticket…). */
export const useSettings = () =>
  useQuery({
    queryKey: ['settings'],
    queryFn: () => api<AppSettings>('/settings'),
    staleTime: 5 * 60_000,
    placeholderData: defaultSettings,
  })

export const useOverview = (p: Period = {}) =>
  useQuery({ queryKey: ['reports', 'overview', p], queryFn: () => api<Overview>(`/reports/overview${qs(p)}`), refetchInterval: 60_000 })

export const useDaily = (days: number) =>
  useQuery({ queryKey: ['reports', 'daily', days], queryFn: () => api<DailySales>(`/reports/daily${qs({ days })}`) })

export const useEmployees = (p: Period = {}) =>
  useQuery({ queryKey: ['reports', 'employees', p], queryFn: () => api<EmployeeStats[]>(`/reports/employees${qs(p)}`) })

export const useTopProducts = (p: Period = {}) =>
  useQuery({ queryKey: ['reports', 'top', p], queryFn: () => api<TopProduct[]>(`/reports/top-products${qs(p)}`) })

export const useMyDay = () =>
  useQuery({ queryKey: ['me', 'overview'], queryFn: () => api<EmployeeStats | null>('/me/overview') })

export const useMySales = (f: Period & { q?: string; page: number; pageSize: number }) =>
  useQuery({
    queryKey: ['me', 'sales', f],
    queryFn: () => api<Paged<SaleRow>>(`/me/sales${qs(f)}`),
    placeholderData: keepPreviousData,
  })
