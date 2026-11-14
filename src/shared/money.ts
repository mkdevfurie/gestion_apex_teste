// Montants en FCFA (XOF) : entiers, sans centimes.
const integer = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

/** 1420500 → "1 420 500 FCFA" (espaces insécables fines, format sénégalais). */
export function formatXof(amount: number): string {
  return `${integer.format(Math.round(amount))}\u00a0FCFA`
}

/** Arrondi commercial au franc le plus proche (0,5 → vers le haut). */
export function roundXof(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value))
}
