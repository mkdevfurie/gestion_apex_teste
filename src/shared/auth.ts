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

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel obligatoire').max(200),
    newPassword: newPasswordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'Le nouveau mot de passe doit être différent de l’actuel',
    path: ['newPassword'],
  })
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

const nameSchema = z.string().trim().min(2, 'Nom trop court').max(80)

export const userCreateSchema = z.object({
  name: nameSchema,
  email: loginInputSchema.shape.email,
  role: roleSchema,
})
export type UserCreateInput = z.infer<typeof userCreateSchema>

export const userUpdateSchema = z
  .object({ name: nameSchema, role: roleSchema, active: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Aucune modification')
export type UserUpdateInput = z.infer<typeof userUpdateSchema>
