import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { post } from '@/lib/api'
import { session } from '@/lib/session'
import type { LoginInput, LoginResponse } from '@/shared'

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) => post<LoginResponse>('/auth/login', input),
    onSuccess: (res) => {
      // Rien de la session précédente ne doit rester en cache.
      qc.clear()
      session.set(res)
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  return async () => {
    try {
      await post<void>('/auth/logout', {})
    } catch {
      /* déjà expirée ou serveur injoignable : on ferme quand même localement */
    }
    session.clear()
    qc.clear()
    await navigate({ to: '/connexion' })
  }
}
