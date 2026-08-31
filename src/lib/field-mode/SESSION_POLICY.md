# Field Mode Session Policy

## JWT Access Token

- **TTL:** 1 hour. The Supabase JWT access token expires 1 hour after issue.
- **Refresh:** Refreshed automatically by Next.js middleware on every request. The middleware calls `supabase.auth.getUser()` which triggers a token refresh when needed.
- **Source:** Phase 0 PHASE_0_FINDINGS.md §3 — no custom session configuration found in the codebase; Supabase defaults (1-hour access, 7-day refresh) are in effect.

## "No re-login inside a shift" guarantee

Satisfied by middleware refresh as long as the user makes at least one request per hour (any page navigation refreshes the token). A standard 12-hour shift requires no manual re-authentication provided the user navigates at least once per hour.

**Risk:** A fitter who leaves the app idle for >1 hour on a locked phone without any navigation will find their session expired when they return. On next navigation, middleware will attempt to use the refresh token (7-day TTL) to issue a new access token silently. No manual re-login is required unless the refresh token has also expired.

## Biometric unlock

`@capacitor-community/biometric-auth` is **NOT installed** in this codebase (Phase 0 finding — confirmed by absence from package.json and node_modules).

To support biometric unlock (e.g., face ID / fingerprint to unlock the app after the screen locked mid-shift), `@capacitor-community/biometric-auth` would need to be added as a new package. This requires:

```
APPROVED: MODIFY package.json
```

This is outside the Phase 3 scope. **Biometric unlock is deferred pending explicit approval.**

Until approved, the app relies solely on the Supabase JWT refresh mechanism. Fitters who lock their phone mid-shift and return within 7 days (refresh token TTL) will be authenticated silently on next use.

## Re-auth challenge

No re-auth challenge exists in the codebase. There is no `requireReauth()` helper or step-up authentication flow. Field Mode relies entirely on the middleware-managed JWT refresh.

## Summary table

| Property | Value | Source |
|---|---|---|
| Access token TTL | 1 hour | Supabase default |
| Refresh token TTL | 7 days | Supabase default |
| Middleware refresh | Yes — every request | Next.js middleware |
| Re-auth challenge | Not implemented | Phase 0 finding |
| Biometric unlock | NOT installed — deferred | Phase 3 out of scope |
| "No re-login in shift" | Satisfied via middleware | Requires 1 nav/hour |
