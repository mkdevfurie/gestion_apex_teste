import { useDeferredValue, useState } from 'react'
import { Search, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatXof, type CustomerRow } from '@/shared'
import { useCustomers } from './queries'

/** Choix d'un client (recherche par nom, code ou téléphone). Vide = client comptant. */
export function CustomerPicker({
  value,
  onChange,
  id = 'customer-picker',
}: {
  value: CustomerRow | null
  onChange: (c: CustomerRow | null) => void
  id?: string
}) {
  const [q, setQ] = useState('')
  const search = useDeferredValue(q.trim())
  const [open, setOpen] = useState(false)
  const results = useCustomers({ q: search || undefined, page: 1, pageSize: 6 }, open)

  if (value) {
    const available = value.creditLimit - value.balance
    return (
      <div className="flex items-start justify-between gap-2 rounded-md border bg-background px-3 py-2">
        <div className="min-w-0 text-sm">
          <div className="flex items-center gap-1.5 font-medium">
            <UserRound className="size-4 shrink-0" />
            <span className="truncate">{value.name}</span>
            <span className="font-mono text-xs text-muted-foreground">{value.code}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Encours {formatXof(value.balance)}
            {value.overdue > 0 && <span className="text-danger-soft-foreground"> (dont {formatXof(value.overdue)} échus)</span>}
            {value.creditLimit > 0 ? ` · crédit disponible ${formatXof(Math.max(0, available))}` : ' · pas de crédit autorisé'}
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Retirer le client" onClick={() => onChange(null)}>
          <X />
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        Client (optionnel)
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Client comptant — rechercher un client…"
        className="pl-9"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
      />
      {open && (
        <ul id={`${id}-list`} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 divide-y overflow-y-auto rounded-md border bg-popover shadow-lg">
          {results.data?.items.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(c)
                  setQ('')
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {c.code}
                    {c.phone && ` · ${c.phone}`}
                  </span>
                </span>
                {c.balance > 0 && <span className="shrink-0 font-mono text-xs text-warning-soft-foreground">{formatXof(c.balance)}</span>}
              </button>
            </li>
          ))}
          {results.data?.items.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Aucun client</li>}
        </ul>
      )}
    </div>
  )
}
