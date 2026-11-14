import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MonitorSmartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'

type SessionRow = { id: string; createdAt: string; lastUsedAt: string; ip: string | null; userAgent: string | null; current: boolean }

function device(ua: string | null) {
  if (!ua) return 'Appareil inconnu'
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Autre'
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur'
  return `${br} · ${os}`
}

/** Appareils connectés au compte, avec déconnexion à distance (téléphone perdu…). */
export function SessionsCard() {
  const qc = useQueryClient()
  const list = useQuery({ queryKey: ['auth', 'sessions'], queryFn: () => api<SessionRow[]>('/auth/sessions') })
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/auth/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Appareil déconnecté')
      void qc.invalidateQueries({ queryKey: ['auth', 'sessions'] })
    },
    onError: (e) => toast.error((e as Error).message),
  })
  if (!list.data?.length) return null
  return (
    <section aria-labelledby="sessions-title" className="space-y-2">
      <h2 id="sessions-title" className="text-sm font-semibold">Appareils connectés</h2>
      <ul className="divide-y rounded-md border text-sm">
        {list.data.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-3 py-2">
            <MonitorSmartphone className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate">{device(s.userAgent)}{s.current && <span className="ml-1 text-xs text-success">(cet appareil)</span>}</div>
              <div className="truncate font-mono text-xs text-muted-foreground">{s.ip ?? '—'} · {formatDateTime(s.lastUsedAt)}</div>
            </div>
            {!s.current && (
              <Button size="sm" variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate(s.id)}>Déconnecter</Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
