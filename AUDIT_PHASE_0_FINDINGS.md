# Phase 0 — Recon & Baseline Findings

## 1. Framework & Language Versions

| Package | Installed | Notes |
|---------|-----------|-------|
| Next.js | **14.2.29** | Latest in the 14.x line; no known critical CVEs; Next.js 15.x is current stable (App Router improvements, React 19 support, Turbopack stable). Upgrade is optional but recommended for Partial Pre-rendering & improved caching APIs. |
| React | 18.3.1 | Current React 18 release. |
| TypeScript | 5.9.3 | Current. |
| @supabase/ssr | ^0.12.0 | Current SSR client. |
| @tanstack/react-query | 5.101.0 | Current v5. |

## 2. Router Paradigm

**App Router exclusively.** All routes live under `src/app/`. No `pages/` directory present. Route groups: `(auth)`, `(dashboard)`, `(admin)`.

## 3. TypeScript Strictness

| Setting | Value |
|---------|-------|
| `strict` | ✅ true |
| `skipLibCheck` | ⚠️ true (hides type errors in dependencies) |
| `noUncheckedIndexedAccess` | ❌ not set |
| `noImplicitAny` | ✅ (implied by strict) |
| Path aliases | `@/*` → `./src/*` |
| `scripts/` excluded | ✅ (added to prevent audit script build errors) |

## 4. Ten Heaviest Client-Side Dependencies (by node_modules disk size)

| Dependency | Disk Size | Ships Client? | Notes |
|------------|-----------|---------------|-------|
| `date-fns` | 36 MB | ⚠️ Partial | Tree-shakeable; named imports used correctly |
| `lucide-react` | 30 MB | ⚠️ Partial | 30MB on disk; with tree-shaking only used icons ship — verify in bundle |
| `pdf-parse` | 21 MB | ❌ Server only | Used only in API routes — correct |
| `stripe` (server SDK) | 18 MB | ❌ Server only | API routes only — correct |
| `openai` | 17 MB | ❌ Server only | API routes only — correct |
| `recharts` | 9 MB | ✅ Client | Used in `'use client'` chart components |
| `@react-pdf/renderer` | 320 KB (dist) | ❌ Server only | API routes only — correct |
| `zod` | 5 MB | ⚠️ Partial | Some client-side form validation |
| `mammoth` | 2.9 MB | ❌ Server only | Knowledge upload API route |
| `@tanstack/react-query` | 1.7 MB | ✅ Client | Expected; ships compressed ~15 kB |

## 5. Available Scripts

| Script | Command | Notes |
|--------|---------|-------|
| `build` | `next build` | ✅ Succeeds |
| `lint` | `next lint` | ⚠️ **No ESLint config exists** — running `npm run lint` prompts interactive setup; no rules enforced |
| `type-check` | `tsc --noEmit` | ✅ 0 errors |
| `test:e2e` | `playwright test` | E2E tests exist (`e2e/` dir) but not run in this audit |
| Bundle analyzer | `ANALYZE=true npm run build` | ✅ Configured via `@next/bundle-analyzer` |

## 6. Rendering Surface Inventory

| Metric | Count |
|--------|-------|
| Total route files (`.tsx`/`.ts` under `src/app`) | 189 |
| Files with `'use client'` (all `src/`) | **191** |
| Layout files with `'use client'` | 4 (`projects/[id]`, `spools/[id]`, `welds/[id]`, `(admin)`) |
| `loading.tsx` files | 20 |
| `error.tsx` files | 20 |
| `not-found.tsx` files | **0** — none anywhere in the app |
| Route groups | `(auth)`, `(dashboard)`, `(admin)` |

## 7. Baseline Verification

### TypeScript (`tsc --noEmit`)
```
✅ 0 errors
```

### ESLint (`npm run lint`)
```
⚠️ No .eslintrc config found — command drops into interactive setup prompt.
   ESLint is a listed devDependency but has never been configured.
   Zero rules are enforced; no lint warnings or errors are reported.
```

### Build (`npm run build`)
```
✅ Build succeeded
Build time: ~2 min (Vercel remote)
Shared baseline (First Load JS shared by all): 89.9 kB
```

### First Load JS — Top 10 Heaviest Routes

| Route | Own Size | First Load JS |
|-------|----------|---------------|
| `/projects/[id]` | 27.4 kB | **313 kB** |
| `/reports/progress` | 10.1 kB | **289 kB** |
| `/welds/[id]` | 12.2 kB | 235 kB |
| `/welders` | 8.05 kB | 215 kB |
| `/welds/[id]/edit` | 3.3 kB | 212 kB |
| `/spools/[id]/edit` | 5.03 kB | 212 kB |
| `/welds` | 12.9 kB | 205 kB |
| `/settings` | 4.65 kB | 203 kB |
| `/spools/new` | 1.48 kB | 201 kB |
| `/welds/[id]/qr` | 4.04 kB | 200 kB |

**Note:** The 89.9 kB shared baseline accounts for the large per-route "First Load JS" figures. The shared chunk contains `@supabase/ssr`, React Query, and Supabase client — reducing this would improve every route simultaneously.

## 8. Architectural Observations (Pre-Audit)

- **191 `'use client'` files** in a Next.js 14 App Router project is very high. Most pages and many components are fully client-rendered, negating most server-component benefits.
- **`usePlanLimits`** (a `useEffect`-based fetch hook) and **`useUsage`** (a React Query hook) both hit `/api/billing/usage` independently, doubling requests.
- **No `not-found.tsx`** at any level — 404 pages will show the generic Next.js fallback.
- **Raw `fetch` instead of `apiFetch`** in at least 15 hook call sites — these calls lack the `Authorization: Bearer` header and will produce 401s when cookies are missing.
- **`apiFetch` calls `createClient()` on every invocation** — `createBrowserClient` is internally cached per origin, so this is not expensive, but the pattern is worth noting.
- **Middleware runs `auth.getUser()` on every non-static request**, including all API routes. This means every API call incurs an extra Supabase JWT validation round-trip on the Edge.
- **`INTERNAL_API_SECRET`** defaults to the literal string `'internal'` if not set in env — the knowledge processing trigger endpoint is effectively open if the secret is not configured in production.

## 9. Assumptions & Unknowns

- **ESLint rules**: No config exists — it is unknown what lint rules the team intended to enforce. The `eslint-config-next` package is installed but never wired up.
- **Bundle composition**: The 89.9 kB shared chunk contents are not broken down here; `ANALYZE=true npm run build` would reveal exact chunk composition.
- **Database schema**: Audit relies on migration files in `supabase/migrations/`; actual production schema may differ (evidenced by the `notifications.body` column incident).
- **Test coverage**: E2E test files exist under `e2e/` but were not executed; actual pass/fail rate is unknown.
- **Capacitor/mobile build**: `android/` and `ios/` directories plus `capacitor.config.ts` indicate a mobile app target; mobile-specific code paths were not audited.
- **`noUncheckedIndexedAccess`**: Not enabled — array index access is not type-safe; actual incidence of index-OOB bugs is unknown without deeper scan.
- **`INTERNAL_API_SECRET` env var**: Whether this is set in Vercel production environment is unknown.
