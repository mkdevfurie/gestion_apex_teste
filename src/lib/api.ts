// Client HTTP minimal.
// En dev, Vite relaie /api vers NestJS (voir vite.config.ts) : pas de CORS.
// En production, VITE_API_URL pointe vers l'API déployée (ex. https://api.exemple.sn/api).
import { session } from './session'

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

/** Erreur API avec le message métier renvoyé par NestJS (en français). */
export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = session.token()
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'Serveur injoignable. Vérifiez la connexion.')
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null
    const msg = Array.isArray(body?.message) ? body.message.join(' · ') : body?.message
    // Session expirée ou révoquée : on la ferme, la route protégée renvoie
    // vers la page de connexion (sauf pour l'appel de connexion lui-même).
    if (res.status === 401 && token && session.token() === token) session.clear()
    throw new ApiError(res.status, msg ?? `Erreur ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function api<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, init)
}

export const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) })

/** Construit une query string en ignorant les valeurs vides. */
export function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}
