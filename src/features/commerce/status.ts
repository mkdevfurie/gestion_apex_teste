/** Couleur du badge d'état d'un document ou d'une réception. */
export const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'outline' | 'secondary'> = {
  PAID: 'success',
  PARTIAL: 'warning',
  UNPAID: 'warning',
  OVERDUE: 'danger',
  OPEN: 'secondary',
  CONVERTED: 'success',
  EXPIRED: 'outline',
  SETTLED: 'outline',
}
