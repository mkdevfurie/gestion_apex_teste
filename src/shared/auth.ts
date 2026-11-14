import { z } from 'zod'
import { roleSchema } from './schemas.js'

// Rôles, libellés et permissions : voir roles.ts (sans Zod).

export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Mot de passe obligatoire').max(200),
})
export type LoginInput = z.infer<typeof loginInputSchema>

/** Règle unique pour tout nouveau mot de passe (création, changement). */
export const newPasswordSchema = z
  .string()
  .min(10, 'Au moins 10 caractères')
  .max(200)
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), 'Au moins une lettre et un chiffre')

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
})
