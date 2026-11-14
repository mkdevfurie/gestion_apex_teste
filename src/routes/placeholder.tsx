import { Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function PlaceholderPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <Card>
        <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
          <Construction className="size-5 shrink-0" />
          <span>Module à construire — {description}</span>
        </CardContent>
      </Card>
    </div>
  )
}
