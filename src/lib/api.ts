// Client HTTP minimal.
// En dev, Vite relaie /api vers NestJS (voir vite.config.ts) : pas de CORS.
// En production, VITE_API_URL pointe vers l'API déployée (ex. https://api.exemple.sn/api).
const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    throw new Error(`API ${res.status} sur ${path}`)
  }
  return res.json() as Promise<T>
}
