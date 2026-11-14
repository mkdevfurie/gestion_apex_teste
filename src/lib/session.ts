import { useSyncExternalStore } from 'react'
import { isAuthUser, type AuthUser, type LoginResponse } from '@/shared'

// Jeton de session opaque (révocable côté serveur). Conservé dans localStorage
// pour survivre à un rechargement de page ; il est invalidé à la déconnexion
// et expire après 12 h d'inactivité.
const KEY = 'apex.session'

export type Session = { token: string; expiresAt: string; user: AuthUser }

let current: Session | null = read()
const listeners = new Set<() => void>()

function read(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    if (typeof s.token !== 'string' || !isAuthUser(s.user)) return null
    if (new Date(s.expiresAt).getTime() <= Date.now()) return null
    return s
  } catch {
    return null
  }
}

function emit() {
  for (const l of listeners) l()
}

export const session = {
  get: () => current,
  token: () => current?.token,
  set(res: LoginResponse) {
    current = { token: res.token, expiresAt: res.expiresAt, user: res.user }
    try {
      localStorage.setItem(KEY, JSON.stringify(current))
    } catch {
      /* navigation privée : la session reste en mémoire */
    }
    emit()
  },
  /** Met à jour le profil (rôle changé par un administrateur…). */
  updateUser(user: AuthUser) {
    if (!current || JSON.stringify(current.user) === JSON.stringify(user)) return
    current = { ...current, user }
    try {
      localStorage.setItem(KEY, JSON.stringify(current))
    } catch {
      /* ignoré */
    }
    emit()
  },
  clear() {
    current = null
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignoré */
    }
    emit()
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

// Déconnexion dans un autre onglet → déconnexion ici aussi.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    current = read()
    emit()
  }
})

export function useSession(): Session | null {
  return useSyncExternalStore(session.subscribe, session.get)
}

/** Utilisateur connecté (à n'utiliser que sous la route protégée). */
export function useUser(): AuthUser {
  const s = useSession()
  if (!s) throw new Error('useUser hors session')
  return s.user
}
