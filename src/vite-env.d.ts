/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de l'API en production. En dev, laisser vide (proxy Vite). */
  readonly VITE_API_URL?: string
  /** Adresse de la console d'administration (lien depuis l'espace gérant). */
  readonly VITE_ADMIN_URL?: string
}
