const qty = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 })
const dateTime = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** 1250.5 → "1 250,5" */
export const formatQty = (n: number) => qty.format(n)

/** Quantité signée pour le journal : "+ 200", "− 10". */
export const formatSignedQty = (n: number) => `${n >= 0 ? '+' : '−'}\u00a0${qty.format(Math.abs(n))}`

/** ISO → "24/10/2026 14:15" */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))
