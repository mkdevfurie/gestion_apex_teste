import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

type Health = { status: 'ok'; database: 'up' | 'down'; time: string }

export function ApiStatus() {
  const { data, isError, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: () => api<Health>('/health'),
    refetchInterval: 30_000,
  })

  const state = isPending
    ? { label: 'Connexion…', tone: 'bg-muted-foreground' }
    : isError
      ? { label: 'API injoignable', tone: 'bg-destructive' }
      : data.database === 'up'
        ? { label: 'API & base OK', tone: 'bg-success' }
        : { label: 'Base injoignable', tone: 'bg-warning' }

  return (
    <div className="rounded-lg border border-sidebar-border px-3 py-2 text-xs">
      <div className="font-semibold tracking-wider text-sidebar-muted uppercase">
        Serveur
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className={cn('size-2 rounded-full', state.tone)} />
        {state.label}
      </div>
    </div>
  )
}
