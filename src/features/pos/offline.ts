import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, api, post, qs } from '@/lib/api'
import type { ProductPage, ProductRow, SaleInput, SaleReceipt } from '@/shared'

/**
 * Mode hors ligne de la caisse.
 *
 * Quand le réseau tombe, la vente est mise dans une FILE D'ATTENTE locale avec
 * son identifiant de requête : à la reconnexion, elle est envoyée telle quelle.
 * Le serveur reste seul juge (prix, stock, numéro) et l'envoi est idempotent :
 * une vente rejouée n'est jamais enregistrée deux fois.
 * Un reçu provisoire SANS numéro est remis au client en attendant.
 */

export type QueuedSale = {
  id: string // = clientRequestId
  input: Omit<SaleInput, 'kind' | 'credit'> & Partial<Pick<SaleInput, 'kind' | 'credit'>>
  createdAt: string
  /** Aperçu affiché sur le reçu provisoire (non contractuel). */
  preview: { total: number; lines: { name: string; quantity: number; lineTotal: number }[] }
  status: 'pending' | 'failed'
  error?: string
  number?: string
}

const key = (userId: string) => `apex.outbox.${userId}`
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function read(userId: string): QueuedSale[] {
  try {
    return JSON.parse(localStorage.getItem(key(userId)) ?? '[]') as QueuedSale[]
  } catch {
    return []
  }
}
function write(userId: string, items: QueuedSale[]) {
  localStorage.setItem(key(userId), JSON.stringify(items))
  emit()
}

export const outbox = {
  add(userId: string, sale: QueuedSale) {
    write(userId, [...read(userId), sale])
  },
  remove(userId: string, id: string) {
    write(userId, read(userId).filter((s) => s.id !== id))
  },
  update(userId: string, id: string, patch: Partial<QueuedSale>) {
    write(userId, read(userId).map((s) => (s.id === id ? { ...s, ...patch } : s)))
  },
}

/** Erreur réseau (serveur injoignable) : la vente peut être mise en file. */
export const isNetworkError = (e: unknown) => e instanceof ApiError && e.status === 0

const snapshots = new Map<string, { raw: string | null; value: QueuedSale[] }>()

export function useOutbox(userId: string) {
  const items = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      const onStorage = (e: StorageEvent) => e.key === key(userId) && l()
      window.addEventListener('storage', onStorage)
      return () => {
        listeners.delete(l)
        window.removeEventListener('storage', onStorage)
      }
    },
    () => {
      // Instantané stable tant que le stockage ne change pas (exigence de useSyncExternalStore).
      const raw = localStorage.getItem(key(userId))
      const cached = snapshots.get(userId)
      if (cached && cached.raw === raw) return cached.value
      const value = read(userId)
      snapshots.set(userId, { raw, value })
      return value
    },
  )
  const online = useOnline()
  const qc = useQueryClient()
  const [syncing, setSyncing] = useState(false)

  /** Envoie la file dans l'ordre ; s'arrête à la première coupure réseau. */
  const sync = useCallback(async () => {
    const pending = read(userId).filter((s) => s.status === 'pending')
    if (!pending.length) return
    setSyncing(true)
    try {
      for (const s of pending) {
        try {
          const r = await post<SaleReceipt>('/sales', s.input)
          void r
          outbox.remove(userId, s.id)
        } catch (e) {
          if (isNetworkError(e)) break
          // Refus métier (stock insuffisant, article désactivé…) : à traiter par un gérant.
          outbox.update(userId, s.id, { status: 'failed', error: (e as Error).message })
        }
      }
    } finally {
      setSyncing(false)
      void qc.invalidateQueries({ queryKey: ['pos'] })
      void qc.invalidateQueries({ queryKey: ['products'] })
    }
  }, [userId, qc])

  useEffect(() => {
    // Différé : l'envoi met à jour l'état, pas pendant l'exécution de l'effet.
    const first = online ? setTimeout(() => void sync(), 0) : undefined
    const t = setInterval(() => navigator.onLine && void sync(), 30_000)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [online, sync])

  return {
    items,
    pending: items.filter((s) => s.status === 'pending'),
    failed: items.filter((s) => s.status === 'failed'),
    online,
    syncing,
    sync,
    retry: (id: string) => {
      outbox.update(userId, id, { status: 'pending', error: undefined })
      void sync()
    },
    discard: (id: string) => outbox.remove(userId, id),
  }
}

export function useOnline() {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener('online', l)
      window.addEventListener('offline', l)
      return () => {
        window.removeEventListener('online', l)
        window.removeEventListener('offline', l)
      }
    },
    () => navigator.onLine,
  )
}

// ───────────── Catalogue en cache pour vendre hors ligne ─────────────

const catalogKey = (warehouseId: string) => `apex.offline.catalog.${warehouseId}`

/** Garde une copie locale du catalogue du dépôt (prix, stock) pour la recherche hors ligne. */
export async function refreshOfflineCatalog(warehouseId: string) {
  const all: ProductRow[] = []
  for (let page = 1; page <= 20; page++) {
    const res = await api<ProductPage>(`/products${qs({ warehouseId, page, pageSize: 100 })}`)
    all.push(...res.items)
    if (all.length >= res.total) break
  }
  try {
    localStorage.setItem(catalogKey(warehouseId), JSON.stringify({ at: new Date().toISOString(), items: all }))
  } catch {
    /* stockage plein : la recherche hors ligne sera limitée */
  }
  return all.length
}

export function offlineCatalog(warehouseId: string): ProductRow[] {
  try {
    return (JSON.parse(localStorage.getItem(catalogKey(warehouseId)) ?? '{}') as { items?: ProductRow[] }).items ?? []
  } catch {
    return []
  }
}

/** Recherche dans la copie locale (SKU exact, code-barres exact, ou désignation). */
export function searchOffline(warehouseId: string, q: string): ProductRow[] {
  const s = q.trim().toLowerCase()
  const items = offlineCatalog(warehouseId)
  if (!s) return items.slice(0, 48)
  return items
    .filter((p) => p.sku.toLowerCase().includes(s) || p.name.toLowerCase().includes(s) || p.barcode === q.trim())
    .slice(0, 48)
}
