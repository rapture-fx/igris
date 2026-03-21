# AI Discoverability — Audit & Implementation Guide

**Date:** March 20, 2026  
**Stack:** Next.js App Router (static export via `output: 'export'`) — Cloudflare Pages  
**Sites:** `igrisinertial.com` (landing) · `docs.igrisinertial.com` (docs hub)

---

## What This Is

An audit of how AI agents (ChatGPT, Perplexity, Claude, Gemini) can discover and pull information from the site. Includes feasibility assessment for purely additive, non-breaking improvements.

---

## Current State

- **Static export** — both apps use `output: 'export'`. All content is pre-rendered HTML at build time. AI agents can already parse docs content without JS execution.
- **25+ MDX docs files** — bounded execution, verifiable traces, governed runtime, ROS 2 integration, capability model, fleet management, SDK, safety, etc.
- **No robots.txt** — bots don't know they're welcome. Some may skip or rate-limit.
- **No llms.txt** — agents have to discover and parse site structure themselves.
- **No JSON-LD** — agents may not recognize docs as technical documentation.
- **No sitemap** — agents crawl blindly without a page index.

---

## How AI Agent Browsing Works

1. Agent encounters the site (search, link, or user prompt)
2. Checks `/robots.txt` — allowed to crawl? Without this, some bots skip entirely.
3. Checks `/llms.txt` — reads site summary, key descriptions, doc URLs. Gets a quick understanding without scraping every page.
4. If it needs more — follows URLs from `llms.txt`, parses HTML directly (already in static export).
5. JSON-LD (optional) — tells the agent "this page is a `TechArticle` about bounded execution" so it categorizes and cites correctly.

**Without these files:** Agent *can* find the site, but must blindly crawl, guess what's important, may miss key docs or misclassify content.

**With these files:** Agent gets a curated map and explicit permission — faster discovery, better extraction, accurate citations.

---

## Recommended Additions

### 1. `/llms.txt` — Site Summary for AI Agents

**What:** A plain text file at the root with site overview, product descriptions, and key doc URLs.

**Where:** `web/apps/web-landing/public/llms.txt` → served at `igrisinertial.com/llms.txt`

**Why:** ChatGPT, Perplexity, and Claude actively look for this file. It gives them a curated entry point instead of blind crawling.

**Risk:** None. Purely additive static file.

**Effort:** ~5 minutes

---

### 2. `/robots.txt` — Explicit Bot Permissions

**What:** Declares which AI bots are allowed to crawl (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended).

**Where:** `web/apps/web-landing/public/robots.txt` → served at `igrisinertial.com/robots.txt`

**Why:** Without it, some bots don't crawl or crawl slowly. Explicit `Allow` signals intent.

**Risk:** None. No existing file to conflict with.

**Effort:** ~5 minutes

---

### 3. Schema.org JSON-LD on Docs Pages

**What:** `<script type="application/ld+json">` blocks on key docs pages using `TechArticle`, `HowTo`, `SoftwareApplication` types.

**Where:** Added inside existing page wrappers on docs hub server components.

**Why:** Helps agents understand the content is technical documentation, not a generic page. Improves structured extraction and citation.

**Risk:** Very low. Inert `<script>` tags. No hydration conflicts. Docs pages are server components — clean injection.

**Effort:** ~20-30 minutes

---

## Feasibility Score

**92/100**

| Item | Feasibility | Priority | Risk |
|------|------------|----------|------|
| `/llms.txt` | Yes | High | None |
| `/robots.txt` | Yes | High | None |
| JSON-LD Schema | Yes-with-caveats | Medium | Very low |
| Semantic HTML | Already adequate | Low | N/A |

**Showstoppers:** None. All items are purely additive — no layout changes, no component changes, no build config changes.

---

## Top Priority

**`/llms.txt`** — highest impact-to-effort ratio, zero risk, directly serves AI agent discoverability.

---

## What Already Works

- Static export ensures all docs content is in initial HTML (no JS execution needed for agents to read it)
- Docs use server components — MDX content is pre-rendered
- Landing page has OpenGraph and Twitter card metadata
- `trailingSlash: true` ensures consistent URL paths

## What's Missing

- No robots.txt — silent to bots
- No llms.txt — no curated site map for agents
- No JSON-LD — agents can't classify docs as technical documentation
- No sitemap — no page index for crawlers

---

## Implementation Notes

- All changes are files in `public/` or `<script>` tags inside existing components
- No new pages, routes, or layout changes
- No impact on existing UI, routing, or build config
- Compatible with `output: 'export'` and Cloudflare Pages deployment
