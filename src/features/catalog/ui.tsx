import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { formatQty, formatSignedQty } from '@/lib/format'
import { isInbound, movementTypeLabels, stockStatusLabels, type MovementType, type StockStatus } from '@/shared'

const statusVariant = { OK: 'success', LOW: 'warning', OUT: 'danger' } as const

export function StockBadge({ status }: { status: StockStatus }) {
  return <Badge variant={statusVariant[status]}>{stockStatusLabels[status]}</Badge>
}

const stockTone: Record<StockStatus, string> = {
  OK: 'text-success-soft-foreground',
  LOW: 'text-warning-soft-foreground',
  OUT: 'text-danger-soft-foreground',
}

export function StockQty({ value, status, className }: { value: number; status: StockStatus; className?: string }) {
  return <span className={cn('font-mono font-semibold', stockTone[status], className)}>{formatQty(value)}</span>
}

export function MovementTypeBadge({ type }: { type: MovementType }) {
  return (
    <Badge variant={isInbound(type) ? 'success' : 'outline'} className="rounded-sm">
      {movementTypeLabels[type]}
    </Badge>
  )
}

export function SignedQty({ value }: { value: number }) {
  return (
    <span className={cn('font-mono font-medium', value >= 0 ? 'text-success-soft-foreground' : 'text-danger-soft-foreground')}>
      {formatSignedQty(value)}
    </span>
  )
}

/** Libellé en petites capitales de la charte (label-caps). */
export function Caps({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('text-[11px] font-semibold tracking-wider text-muted-foreground uppercase', className)}>
      {children}
    </div>
  )
}

/** Champ de formulaire : libellé, contrôle, aide ou erreur. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string
  label: string
  error?: string
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
