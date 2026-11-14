import { useState, type FormEvent } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Eye, EyeOff, Landmark, Loader2, LockKeyhole, ShieldCheck, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLogin } from '@/features/auth/auth-actions'
import { fieldErrors } from '@/features/catalog/form-utils'
import { Field } from '@/features/catalog/ui'
import { ApiError } from '@/lib/api'
import { loginInputSchema } from '@/shared'

export function LoginPage() {
  const navigate = useNavigate()
  const { redirect, expired } = useSearch({ from: '/connexion' })
  const login = useLogin()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const raw = { email, password }
    const parsed = loginInputSchema.safeParse(raw)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues, raw))
      return
    }
    setErrors({})
    try {
      const res = await login.mutateAsync(parsed.data)
      if (res.user.mustChangePassword) {
        await navigate({ to: '/mot-de-passe', replace: true })
        return
      }
      // Ne suit que des chemins internes (pas de redirection ouverte).
      const target = redirect?.startsWith('/') && !redirect.startsWith('//') ? redirect : '/'
      await navigate({ to: target, replace: true })
    } catch {
      setPassword('')
    }
  }

  const serverError =
    login.error instanceof ApiError && login.error.status === 429
      ? 'Trop de tentatives. Patientez une minute avant de réessayer.'
      : login.error?.message

  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-primary-foreground text-primary">
            <Landmark className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-semibold">Apex Ledger</div>
            <div className="text-[11px] font-semibold tracking-wider uppercase opacity-60">ERP Commerce</div>
          </div>
        </div>

        <div className="max-w-md space-y-6">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">
            Stock, caisse et créances, tenus au franc près.
          </h2>
          <ul className="space-y-4 text-sm text-primary-foreground/75">
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
              Chaque mouvement est signé et conservé : le stock se justifie ligne par ligne.
            </li>
            <li className="flex gap-3">
              <LockKeyhole className="mt-0.5 size-4 shrink-0 text-success" />
              Accès selon le rôle : gérant, caissier, magasinier.
            </li>
            <li className="flex gap-3">
              <Wifi className="mt-0.5 size-4 shrink-0 text-success" />
              FCFA, Wave et Orange Money pris en charge.
            </li>
          </ul>
        </div>

        <p className="font-mono text-xs text-primary-foreground/40">Session fermée après 12 h d’inactivité</p>
        {/* Motif discret de grille, rappel du registre */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:32px_32px]"
        />
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
              <Landmark className="size-5" />
            </div>
            <div className="leading-tight">
              <div className="text-lg font-semibold">Apex Ledger</div>
              <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">ERP Commerce</div>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
            <p className="text-sm text-muted-foreground">Identifiez-vous pour accéder à votre espace.</p>
          </div>

          {expired && !serverError && (
            <p role="status" className="rounded-md border border-[#FDE68A] bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
              Votre session a expiré. Reconnectez-vous pour continuer.
            </p>
          )}
          {serverError && (
            <p role="alert" className="rounded-md border border-[#FECACA] bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
              {serverError}
            </p>
          )}

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <Field id="login-email" label="Adresse e-mail" error={errors.email}>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
                aria-invalid={Boolean(errors.email) || undefined}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
              />
            </Field>

            <Field id="login-password" label="Mot de passe" error={errors.password}>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-11"
                  aria-invalid={Boolean(errors.password) || undefined}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            <Button type="submit" className="h-11 w-full" disabled={login.isPending}>
              {login.isPending ? (
                <>
                  <Loader2 className="animate-spin" /> Connexion…
                </>
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Mot de passe oublié ? Demandez à votre gérant de le réinitialiser.
          </p>
        </div>
      </main>
    </div>
  )
}
