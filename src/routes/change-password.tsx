import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Landmark, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLogout } from '@/features/auth/auth-actions'
import { fieldErrors } from '@/features/catalog/form-utils'
import { Field } from '@/features/catalog/ui'
import { post } from '@/lib/api'
import { session, useSession } from '@/lib/session'
import { changePasswordSchema, type AuthUser } from '@/shared'

export function ChangePasswordPage() {
  const navigate = useNavigate()
  const logout = useLogout()
  const user = useSession()?.user
  const pending = user?.mustChangePassword ?? false

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const raw = { currentPassword: current, newPassword: next }
    const parsed = changePasswordSchema.safeParse(raw)
    const errs = parsed.success ? {} : fieldErrors(parsed.error.issues, raw)
    if (next !== confirmation) errs.confirm = 'Les deux mots de passe ne correspondent pas'
    setErrors(errs)
    if (!parsed.success || Object.keys(errs).length) return

    setSaving(true)
    setError(null)
    try {
      session.updateUser(await post<AuthUser>('/auth/password', parsed.data))
      await navigate({ to: '/', replace: true })
    } catch (err) {
      setError((err as Error).message)
      setCurrent('')
    } finally {
      setSaving(false)
    }
  }

  const inv = (k: string) => ({
    'aria-invalid': Boolean(errors[k]) || undefined,
    'aria-describedby': errors[k] ? `cp-${k}-error` : undefined,
  })

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
            <Landmark className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-semibold">Apex Ledger</div>
            <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">ERP Commerce</div>
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {pending ? 'Choisissez votre mot de passe' : 'Changer mon mot de passe'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {pending
              ? `Bonjour ${user?.name ?? ''}, votre mot de passe actuel est provisoire. Remplacez-le pour continuer.`
              : 'Vos autres appareils seront déconnectés.'}
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-[#FECACA] bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
            {error}
          </p>
        )}

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field id="cp-currentPassword" label={pending ? 'Mot de passe provisoire' : 'Mot de passe actuel'} error={errors.currentPassword}>
            <Input id="cp-currentPassword" type="password" autoComplete="current-password" autoFocus className="h-11"
              value={current} onChange={(e) => setCurrent(e.target.value)} {...inv('currentPassword')} />
          </Field>
          <Field id="cp-newPassword" label="Nouveau mot de passe" error={errors.newPassword} hint="Au moins 10 caractères, avec des lettres et des chiffres.">
            <Input id="cp-newPassword" type="password" autoComplete="new-password" className="h-11"
              value={next} onChange={(e) => setNext(e.target.value)} {...inv('newPassword')} />
          </Field>
          <Field id="cp-confirm" label="Confirmer le nouveau mot de passe" error={errors.confirm}>
            <Input id="cp-confirm" type="password" autoComplete="new-password" className="h-11"
              value={confirmation} onChange={(e) => setConfirmation(e.target.value)} {...inv('confirm')} />
          </Field>
          <Button type="submit" className="h-11 w-full" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="animate-spin" /> Enregistrement…
              </>
            ) : (
              'Enregistrer le mot de passe'
            )}
          </Button>
        </form>

        <div className="flex justify-between text-sm">
          {pending ? (
            <span />
          ) : (
            <button type="button" onClick={() => navigate({ to: '/' })} className="text-muted-foreground underline-offset-4 hover:underline">
              Retour
            </button>
          )}
          <button type="button" onClick={logout} className="text-muted-foreground underline-offset-4 hover:underline">
            Se déconnecter
          </button>
        </div>
      </div>
    </main>
  )
}
