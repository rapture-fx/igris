# Igris Inertial Web Console — End-to-End Functionality Audit Report

---

## 1. Executive Summary

The Igris Inertial web console is a Next.js 14 App Router application comprising approximately 37,276 lines of TypeScript/TSX across 80+ files. It serves as the management interface for an AI inference routing platform, covering runtime fleet management, provider configuration, policy enforcement, billing, and observability.

**Overall assessment: The console is approximately 40% production-ready.** The authentication flow, dashboard overview, billing integration, and API key management are functional end-to-end. However, the codebase suffers from a dual-route architecture (legacy `/dashboard/*` routes alongside new sidebar-defined routes), inconsistent error handling across hooks, three competing API base URL definitions, and several dead code artifacts. A 3,417-line observability page represents a significant maintainability risk.

**Critical findings:**
- 1 production security concern (`dev=true` hardcoded redirect)
- 1 data display bug (trial banner reads wrong property path)
- 3 API base URL conflicts that will cause runtime failures in production
- ~20 orphaned dashboard routes not linked from current navigation
- ~1,500 lines of confirmed dead code
- Inconsistent mock data safety patterns across 5 hook files

---

## 2. Audit Scope & Methodology

| Dimension | Coverage |
|---|---|
| Pages (app/) | All routes enumerated and read |
| Components (components/) | All layout, UI, and feature components |
| Hooks (hooks/) | All 18 hook files |
| Lib (lib/) | apiClient, auth, config, mockDataGuard, mock data, utils |
| Utils (utils/) | constants, helpers, chartTheme |
| Middleware | middleware.ts |
| API routes | app/api/auth/[...all]/route.ts |
| Config files | next.config.js, tailwind.config.ts, tsconfig.json, package.json |

**Out of scope:** Backend Go services, Rust runtime, SDK packages, web-landing, web-docs.

---

## 3. Complete Feature-to-Code Mapping

### 3.1 Authentication

| Layer | File | Status |
|---|---|---|
| Server config | `lib/auth.ts` | Complete — BetterAuth with PostgreSQL, Resend, Google/GitHub OAuth, admin/org plugins |
| Client exports | `lib/auth-client.ts` | Complete — signIn, signUp, signOut, useSession, getSession |
| Route handler | `app/api/auth/[...all]/route.ts` | Complete — 4-line catch-all |
| Auth page | `app/auth/page.tsx` | Complete — 362 lines, signin/signup/forgot tabs, OAuth buttons, email accordion |
| Middleware | `middleware.ts` | Complete — cookie-based session detection, cross-subdomain support |
| Root redirect | `app/page.tsx` | **ISSUE** — hardcodes `router.push('/dashboard?dev=true')` |

### 3.2 Onboarding

| Layer | File | Status |
|---|---|---|
| Modal | `components/onboarding/OnboardingModal.tsx` | Complete — 512 lines, 3-step wizard |
| Hook | `hooks/useOnboarding.ts` | Complete — localStorage persistence + API key check |
| API key hook | `hooks/useApiKey.ts` | Complete — generate/revoke mutations |

### 3.3 Dashboard Overview

| Layer | File | Status |
|---|---|---|
| Page | `app/dashboard/page.tsx` | Complete — 7 API queries, stat cards, execution table, violations, charts |
| Layout | `components/layout/DashboardLayout.tsx` | Complete — HealthCheckGate + ErrorBoundary + Sidebar + Navbar + Footer |
| Health gate | `components/HealthCheckGate.tsx` | Complete — blocks rendering when backend unhealthy, dev bypass |
| Health hook | `hooks/useBackendHealth.ts` | Complete — 30s polling |

### 3.4 Fleet Management

| Layer | File | Status |
|---|---|---|
| Page (old) | `app/dashboard/fleet/page.tsx` | Partial — 503 lines, UI complete |
| Hooks (old) | `app/dashboard/fleet/hooks.ts` | **ISSUE** — own API_BASE_URL (localhost:8080), duplicates types |
| Hooks (shared) | `hooks/useCostInsights.ts` | Defines overlapping RuntimeFleetInstance/RuntimeFleetMetrics types |

### 3.5 Billing & Subscription

| Layer | File | Status |
|---|---|---|
| Page | `app/settings/billing/page.tsx` | Complete — 237 lines, plan comparison, Polar.sh portal link |
| Tenant hook | `hooks/useTenant.ts` | Complete — normalizes API response to Tenant interface |

### 3.6 API Key & Vault Management

| Layer | File | Status |
|---|---|---|
| Page | `app/settings/keys/page.tsx` | Complete — 399 lines, combined Runtime API Key + Vault Keys |
| API key hook | `hooks/useApiKey.ts` | Complete |
| Vault hook | `hooks/useVault.ts` | Complete but contains dead MOCK_KEYS array |

### 3.7 Observability

| Layer | File | Status |
|---|---|---|
| Page | `app/dashboard/observability/page.tsx` | **OVERSIZED** — 3,417 lines in single file |
| Hooks | `app/dashboard/observability/hooks.ts` | **ISSUE** — own API_BASE_URL (localhost:8000), 150-item inline mock traces |

### 3.8 Advanced Features

| Feature | Hook file | Mock data | Error handling | Status |
|---|---|---|---|---|
| Cognitive Advisor | `hooks/useCognitive.ts` (358 lines) | Inline | handleApiError | Partial |
| Council Mode | `hooks/useCouncil.ts` (227 lines) | Inline | handleApiError | Partial |
| Shadow Mode | `hooks/useShadow.ts` (244 lines) | Inline | handleApiError | Partial |
| Speculative Router | `hooks/useSpeculative.ts` (217 lines) | Inline | **INCONSISTENT** | Partial |
| EscapeVector | `hooks/useEscapeVector.ts` (261 lines) | Inline | **INCONSISTENT** | Partial |
| Federated Learning | `hooks/useFederated.ts` (97 lines) | None | Throws on error | Scaffolding |
| Multimodal | `hooks/useMultimodal.ts` (48 lines) | None | Throws on error | Scaffolding |
| WASM Engine | `hooks/useWasmEngine.ts` (151 lines) | N/A | N/A | **DEAD — not wired** |

### 3.9 Navigation & Layout

| Component | File | Status |
|---|---|---|
| Sidebar | `components/layout/Sidebar.tsx` (584 lines) | Complete — search modal, profile dropdown, expandable sections |
| Navbar | `components/layout/Navbar.tsx` | Placeholder — 2px height, mobile menu trigger only |
| Footer | `components/layout/Footer.tsx` | Placeholder — 2px spacer div |
| Error boundary | `components/ErrorBoundary.tsx` | Complete — class-based with fallback UI |

---

## 4. Identified Redundancies

| Description | Files Involved | Impact | Severity | Why It Exists |
|---|---|---|---|---|
| Duplicate `cn()` utility | `lib/utils.ts` + `utils/helpers.ts` | Import confusion | Low | shadcn scaffold + existing utils co-exist |
| 3 competing API_BASE_URL values | `utils/constants.ts` (8081), `fleet/hooks.ts` (8080), `observability/hooks.ts` (8000) | Fleet + observability fail in prod | **High** | Stale dev-time values never consolidated |
| Duplicate fleet types | `hooks/useCostInsights.ts` + `app/dashboard/fleet/hooks.ts` | Sync burden on API changes | Medium | Dual implementation of same feature |
| Dual route architecture | `/dashboard/*` (old) + sidebar routes (new) — ~20 orphaned routes | User confusion, stale pages | **High** | Incremental migration never completed |

---

## 5. Unnecessary Code & Features

| Item | Location | Justification | Lines Saved | Risk of Removal |
|---|---|---|---|---|
| `updateCatchBlocks.ts` | `hooks/updateCatchBlocks.ts` | Exports nothing, documentation artifact only | 67 | None |
| Getting started stub | `app/getting-started/page.tsx` | Orphaned, old branding ("Overture Developer Console"), unreachable | 16 | None |
| `useWasmEngine.ts` | `hooks/useWasmEngine.ts` | WASM not wired into any UI component | 151 | None |
| `MOCK_KEYS` array | `hooks/useVault.ts` lines 22–68 | Defined but never referenced anywhere | 47 | None |
| Navbar + Footer | `components/layout/Navbar.tsx` + `Footer.tsx` | No meaningful UI content, 2px height placeholders | ~20 | Low — inline into DashboardLayout |
| Inline mock data in 5 hooks | `useCognitive`, `useCouncil`, `useShadow`, `useSpeculative`, `useEscapeVector` | Pattern already centralized in `lib/mock/` | ~800 | Low |

**Total confirmed dead code: ~1,500+ lines**

---

## 6. Improvement Opportunities

### Functionality
- **Fix trial banner property path** — reads `tenant?.metadata?.trial_active` but useTenant normalizes to `tenant.trial_active` (top-level). Trial users never see their status.
- **Fix `useTenant` null return** — returns `null as unknown as Tenant` on error; downstream consumers will throw on property access.
- **Standardize mock data error handling** — `useEscapeVectorHistory` and `useSpeculativeRaces` bypass `handleApiError`, risking mock data leaking to production.

### Performance
- **Decompose observability page** — 3,417 lines in a single file causes slow IDE performance, slow cold-start parsing, and prevents code splitting. Target: no file exceeds ~500 lines.
- **Consolidate API base URL** — eliminates redundant fetch failures in fleet/observability pages.

### DX / Maintainability
- **Single `cn()` source** — pick `utils/helpers.ts` (more consumers) as canonical import.
- **Centralize all mock data** — move inline mock blocks from 5 hooks to `lib/mock/` files to match existing pattern in `data.ts` and `execution.ts`.
- **Delete confirmed dead code** — ~280 lines of zero-impact removal that will confuse future developers.

### Simplification
- **Resolve dual route architecture** — add `next.config.js` redirects from old `/dashboard/*` paths to new routes, then remove old route files.
- **Inline Navbar/Footer** — if these components serve no purpose, absorb their 2-line placeholders into DashboardLayout directly.

---

## 7. Prioritized Recommendations

| Priority | ID | Finding | Effort | Expected Impact | Clean/Simple Alignment |
|---|---|---|---|---|---|
| **P0** | BUG-1 | Remove `dev=true` hardcoded redirect in `app/page.tsx` | 5 min | Removes auth bypass risk in production | ✅ Direct |
| **P0** | R2 | Consolidate API base URLs to `utils/constants.ts` | 30 min | Fleet + observability pages work in production | ✅ Direct |
| **P1** | BUG-2 | Fix trial banner property path in DashboardLayout | 5 min | Trial users see their status | ✅ Direct |
| **P1** | BUG-3/4 | Fix missing `handleApiError` in 2 hooks | 15 min | Consistent mock safety across all hooks | ✅ Direct |
| **P1** | R4 | Add redirects + remove old `/dashboard/*` routes | 1–2 hr | Single canonical URL per feature | ✅ High |
| **P2** | I3 | Decompose observability page into sub-components | 4 hr | Maintainability, IDE performance, code splitting | ✅ High |
| **P2** | D1–D4 | Remove confirmed dead code (~280 lines) | 30 min | Cleaner codebase for new contributors | ✅ Direct |
| **P3** | R1 | Unify `cn()` import path | 15 min | Eliminates developer guesswork | ✅ Low |
| **P3** | D6 | Externalize inline mock data to `lib/mock/` | 3 hr | Consistent pattern, reduces hook file sizes | ✅ Medium |

---

## 8. Impact on Product Design

### What works well
1. **Authentication flow** is clean and complete — OAuth + email/password, session middleware, BetterAuth server/client split. Production-ready.
2. **Onboarding wizard** is well-structured with clear step progression mapping to the user's first-run journey.
3. **Sidebar navigation** is thoughtfully organized with logical groupings and Cmd+F search.
4. **Central apiClient + mockDataGuard pattern** is architecturally sound — production safety throw is good defense-in-depth.
5. **Billing page** cleanly presents tier comparison with Polar.sh portal integration.

### What undermines the "clean & simple" philosophy
1. **Route duplication** — two URLs for many features is the antithesis of simple.
2. **3,417-line observability file** — opposite of clean. Component, state, and style logic are entangled.
3. **Inconsistent hook patterns** — some use `handleApiError`, some don't; some use central constants, some define their own. Creates cognitive overhead for maintainers.
4. **Empty Navbar and Footer** — if they serve no purpose, their presence suggests unfinished design intent.
5. **Advanced feature hooks without pages** — creates a "feature graveyard" where the console promises more than it delivers.

### User-facing risk summary
A new user who signs in will successfully complete onboarding and manage API keys, billing, and the dashboard. But navigating to fleet or observability will silently fail (wrong backend port). The trial banner never appears for trial users. Old bookmarked URLs reach stale pages. These are the gaps between "demo-ready" and "production-ready."

---

## 9. Appendix

### A. Bug Registry

| ID | File | Description | Severity |
|---|---|---|---|
| BUG-1 | `app/page.tsx` | Hardcodes `dev=true` query parameter in production redirect | **Critical** |
| BUG-2 | `components/layout/DashboardLayout.tsx` | Trial banner reads `tenant?.metadata?.trial_active` but should read `tenant?.trial_active` | **High** |
| BUG-3 | `hooks/useEscapeVector.ts` | `useEscapeVectorHistory` returns mock data in catch without `handleApiError` wrapper | **Medium** |
| BUG-4 | `hooks/useSpeculative.ts` | `useSpeculativeRaces` returns mock data in catch without `handleApiError` wrapper | **Medium** |
| BUG-5 | `app/dashboard/fleet/hooks.ts` | Hardcodes `API_BASE_URL = localhost:8080` | **High** |
| BUG-6 | `app/dashboard/observability/hooks.ts` | Hardcodes `API_BASE_URL = localhost:8000` | **High** |
| BUG-7 | `hooks/useTenant.ts` | Returns `null as unknown as Tenant` on error — downstream callers will throw | **Medium** |

### B. Dead Code Registry

| File | Lines | Reason |
|---|---|---|
| `hooks/updateCatchBlocks.ts` | 67 | Documentation artifact, exports nothing, no importers |
| `app/getting-started/page.tsx` | 16 | Orphaned stub, old branding, unreachable from navigation |
| `hooks/useWasmEngine.ts` | 151 | WASM not wired into any UI component |
| `hooks/useVault.ts` MOCK_KEYS | 47 | Defined but never referenced |
| Old `/dashboard/*` routes | ~2,000+ | Superseded by new sidebar route structure, no redirects in place |

### C. Key File Paths

| Category | Path |
|---|---|
| Root page | `app/page.tsx` |
| Middleware | `middleware.ts` |
| API client | `lib/apiClient.ts` |
| Auth server | `lib/auth.ts` |
| Auth client | `lib/auth-client.ts` |
| Mock data guard | `lib/mockDataGuard.ts` |
| Mock data | `lib/mock/data.ts` (873 lines) |
| Mock execution | `lib/mock/execution.ts` (553 lines) |
| Constants | `utils/constants.ts` |
| Helpers | `utils/helpers.ts` |
| Sidebar | `components/layout/Sidebar.tsx` (584 lines) |
| Dashboard layout | `components/layout/DashboardLayout.tsx` |
| Dashboard page | `app/dashboard/page.tsx` |
| Observability page | `app/dashboard/observability/page.tsx` (3,417 lines) |
| Fleet hooks | `app/dashboard/fleet/hooks.ts` |
| Observability hooks | `app/dashboard/observability/hooks.ts` |
| Billing page | `app/settings/billing/page.tsx` |
| Keys page | `app/settings/keys/page.tsx` |
| Auth page | `app/auth/page.tsx` |
