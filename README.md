# Pantry Panic

Plan a week of dinners and lunches, get an AI-suggested recipe when you don't know
what to make, and turn the week into one shopping list automatically. Web app plus
an iPhone app, built security-first.

## Structure (pnpm workspace monorepo)

```
apps/
  web/      Next.js web app (TypeScript, Tailwind)
  mobile/   Expo (React Native) iPhone app — scaffolded in Week 4
packages/
  shared/   Types and validation schemas shared by web and mobile
```

## Getting started

```bash
pnpm install
pnpm dev        # runs the web app at http://localhost:3000
```

Environment variables the web app expects (create `apps/web/.env.local`, never commit it):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## Status

Following the 4-week build plan — see project board / commit history for day-by-day progress.
