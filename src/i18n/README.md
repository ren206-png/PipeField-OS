# i18n Setup (Sprint 8)

## Status: SCAFFOLDED — needs `next-intl` installed to activate.

### Install
```bash
npm install next-intl
```

### Files
- `messages/en-US.json` — English (US) source strings (canonical)
- `messages/en-GB.json` — English (UK) stub
- `messages/fr-CA.json` — French Canadian stub (needs professional translation)
- `src/i18n/request.ts` — locale detection (activate after install)
- `src/lib/units.ts` — unit conversion (active now, no next-intl dependency)

### Locale resolution order (to implement in request.ts)
1. `project.locale` (project-level override)
2. `org.locale` (org-level default)
3. Browser `Accept-Language` header
4. `'en-US'` hard default

### String extraction
Run `npx ts-node scripts/extract_strings.ts` to generate a report of
all inline English string literals not yet extracted to messages files.
(Script to be written in Phase 3.)

### Activation checklist
- [ ] `npm install next-intl`
- [ ] Add `NextIntlClientProvider` to `src/app/layout.tsx`
- [ ] Replace hardcoded `<p>` / `<button>` labels with `useTranslations()` calls
- [ ] Test with `Accept-Language: fr-CA` header to verify routing
