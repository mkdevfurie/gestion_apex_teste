// Utilitaires de formulaires du catalogue (hors composants : fast refresh).

/** "2,5" ou "2.5" → 2.5 ; vide → undefined ; invalide → NaN (rejeté par Zod). */
export function parseNumber(raw: string): number | undefined {
  const s = raw.replace(/\s|\u00a0/g, '').replace(',', '.')
  if (s === '') return undefined
  return Number(s)
}

/**
 * Erreurs Zod → { champ: premier message }.
 * Les erreurs de type (champ vide, texte dans un champ numérique) sont
 * reformulées : le message générique de Zod est trop technique pour la caisse.
 */
export function fieldErrors(
  issues: readonly { path: PropertyKey[]; message: string; code?: string }[],
  input?: Record<string, unknown>,
) {
  const out: Record<string, string> = {}
  for (const i of issues) {
    const key = String(i.path[0] ?? '_')
    let message = i.message
    if (i.code === 'invalid_type') {
      message = input?.[key] === undefined ? 'Champ obligatoire' : 'Nombre invalide'
    }
    out[key] ??= message
  }
  return out
}

/** Classe commune des <select> natifs (accessibles, légers, bons sur mobile). */
export const selectClass =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:opacity-50'
