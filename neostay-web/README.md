## NeoStay - Phase 1

Cette application couvre la **Phase 1** du plan d'implementation:

- Initialisation Next.js (App Router)
- Tailwind CSS
- shadcn/ui
- Configuration initiale Supabase

## Prerequis

- Node.js 20+
- npm

## Configuration des variables d'environnement

1. Copier le fichier d'exemple:

```bash
cp .env.example .env.local
```

2. Renseigner les variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Lancer le projet

```bash
npm run dev
```

## Verification Phase 1

1. Ouvrir la page d'accueil: `http://localhost:3000`
2. Verifier la route de sante Supabase: `http://localhost:3000/api/health/supabase`

Exemple de reponse attendue:

```json
{
	"ok": true,
	"source": "supabase",
	"message": "Configuration loaded and Supabase API reachable.",
	"hasSession": false,
	"checkedAt": "2026-03-05T00:00:00.000Z"
}
```

Si les variables d'environnement manquent, la route retourne `500` avec un message explicite.

## Scripts disponibles

```bash
npm run dev
npm run lint
npm run build
```
