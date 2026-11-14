/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de l'API en production. En dev, laisser vide (proxy Vite). */
  readonly VITE_API_URL?: string
}
