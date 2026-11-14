import { formatXof } from '@/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// Données fictives en attendant les endpoints du tableau de bord.
const kpis = [
  { label: 'Valorisation stock (PMP)', value: 28_450_000, hint: '3 420 références' },
  { label: "Chiffre d'affaires du jour", value: 1_420_500, hint: '24 tickets' },
  { label: 'Marge brute', value: 385_000, hint: 'Taux réel 27,1 %' },
  { label: 'Créances clients', value: 4_850_000, hint: '8 dossiers ouverts', alert: true },
]

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Dépôt principal
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Vue exécutive
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button>Nouvelle vente</Button>
          <Button variant="outline">Entrée de stock</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader>
              <CardDescription className="text-[11px] font-semibold tracking-wider uppercase">
                {k.label}
              </CardDescription>
              <CardTitle className="font-mono text-2xl">
                {formatXof(k.value)}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
              {k.hint}
              {k.alert && (
                <Badge className="bg-warning-soft text-warning-soft-foreground">
                  À relancer
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
