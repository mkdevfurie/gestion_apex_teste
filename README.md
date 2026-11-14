# Gestion Apex — Front

Interface de gestion commerciale (caisse, catalogue & stock, factures & créances, tiers)
pour boutiques, quincailleries et grossistes au Sénégal. Charte « Apex Ledger ».

**Stack** : Vite 7 · React 19 · TanStack Router & Query · Tailwind CSS 4 · shadcn/ui

Dépôts liés :

- API NestJS — [gestion_apex_backend](https://github.com/mkdevfurie/gestion_apex_backend)
- Dashboard admin (Angular) — [gestion_apex_admin](https://github.com/mkdevfurie/gestion_apex_admin)

## Démarrage

L'API doit tourner sur `http://localhost:3001` (voir le dépôt backend).

```bash
corepack enable pnpm   # une seule fois
pnpm install
pnpm dev               # http://localhost:5173 — /api est relayé vers :3001
```

En production, définir `VITE_API_URL` (voir `.env.example`) et ajouter l'URL du
front à `WEB_ORIGIN` côté API.

## Code partagé

`src/shared` (calculs de totaux/TVA/escompte, `formatXof`, schémas Zod) existe aussi
dans l'API et l'admin. **Toute modification doit être reportée dans les trois dépôts.**
L'API reste la source qui fait foi pour les montants ; le front ne fait qu'afficher.

## Commandes

```bash
pnpm build | pnpm typecheck | pnpm lint
pnpm test      # tests des calculs de facture
```
