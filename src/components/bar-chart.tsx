import { formatXof } from '@/shared'

type Point = { label: string; value: number; sub?: string }

/**
 * Histogramme léger (pas de bibliothèque) : une barre par jour.
 * Accessible : la même donnée est exposée en tableau pour les lecteurs d'écran.
 */
export function BarChart({ data, title }: { data: Point[]; title: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <figure className="space-y-2">
      <figcaption className="sr-only">{title}</figcaption>
      <div className="flex h-36 items-end gap-1.5" aria-hidden>
        {data.map((d) => (
          <div key={d.label} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
            <div
              className="relative rounded-t-sm bg-primary/85 transition-colors group-hover:bg-primary"
              style={{ height: `${Math.max(d.value ? 3 : 0, (d.value / max) * 100)}%` }}
              title={`${d.label} : ${formatXof(d.value)}${d.sub ? ` · ${d.sub}` : ''}`}
            />
            {d.value === 0 && <div className="h-px bg-border" />}
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 font-mono text-[10px] text-muted-foreground" aria-hidden>
        {data.map((d) => (
          <div key={d.label} className="min-w-0 flex-1 truncate text-center">
            {d.label}
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{formatXof(d.value)}</td>
              {d.sub && <td>{d.sub}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
