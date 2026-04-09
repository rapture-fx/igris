# Fumadocs Migration Notes

## Summary

The docs app has now been migrated to a working Fumadocs-first architecture.

Current verified state:

- Fumadocs is installed and wired into the docs app
- Tailwind 4 is in place for `web-docs-hub`
- the docs content ships from `content/docs`
- the catch-all docs route is owned by Fumadocs at `app/docs/[[...slug]]/page.tsx`
- legacy article route ownership has been removed
- the API reference now ships as generated MDX content under `content/docs/api-reference`
- the old custom API route tree and custom API page components have been removed
- the legacy `docs/` source tree and old custom MDX runtime files have been removed
- the docs app passes `lint`, `typecheck`, and `build`

This is now a migration status and follow-up note, not a feasibility note.

## Audit

### Docs content

- the active docs source lives under `content/docs`
- the shipped content is primarily plain Markdown + tables + code fences
- a small number of pages use Fumadocs primitives such as `Callout`, `Tabs`, and `Steps`

### Active MDX runtime behavior

The live docs route renders through:

- `fumadocs-ui/mdx` for default links, tables, headings, and code blocks
- `components/fumadocs-mdx-components.tsx` for thin aliases of Fumadocs primitives used in content

### Frontmatter usage

Frontmatter is currently used primarily in article files under `content/docs/articles`.

Metadata fields seen:

- `title`
- `date`
- `summary`
- `author`

### Current docs system

The current docs platform is now Fumadocs-owned:

- Fumadocs owns the docs route via `app/docs/[[...slug]]/page.tsx`
- content is sourced from `content/docs`
- API reference is generated into `content/docs/api-reference`
- MDX component injection for Fumadocs lives in `components/fumadocs-mdx-components.tsx`
- the legacy direct docs loader at `app/docs/[slug]/page.tsx` is gone

## Compatibility Matrix

### Fully compatible

- Plain MDX pages using:
  - headings
  - paragraphs
  - tables
  - fenced code blocks
  - links
  - lists

Examples:

- `docs/quickstart.mdx`
- `docs/context-engineering.mdx`
- `docs/deploy-local-runtime.mdx`
- most workflow and concept pages

### Partially compatible

- Pages with imported React components
- Mermaid code fences, because rendering still depends on custom wrapper styling
- Pages with frontmatter, because Fumadocs source metadata/schema must be defined
- `SdkSupportMatrix` in `docs/sdk.mdx`

### Incompatible without architectural refactor

- current custom route loader
- current handwritten sidebar/navigation/search ownership
- current MCP reference page architecture

These are not incompatible as content, but they are incompatible as a direct drop-in docs system model.

## Recommended Target Architecture

### Keep

- existing MDX content
- `SdkSupportMatrix`
- minimal product-specific Mermaid styling where needed

### Replace

- custom route loader with Fumadocs-native content source
- handwritten sidebar ownership with Fumadocs navigation
- current MDX bootstrapping via `@next/mdx` with `fumadocs-mdx`

### Preserve initially as embedded custom pages

- none on the active docs route

The API reference is generated into Fumadocs content as part of the docs build. MCP is currently content-backed under `content/docs/mcp.mdx`.

## Current Migration Status

### Completed

1. Installed and pinned a Fumadocs-compatible stack:
   - `fumadocs-ui`
   - `fumadocs-core`
   - `fumadocs-mdx`
2. Replaced the previous MDX setup with `fumadocs-mdx`.
3. Added:
   - `source.config.ts`
   - `lib/source.ts`
   - `content/docs/meta.json`
4. Migrated the portable docs corpus into `content/docs`.
5. Added the Fumadocs catch-all route at `app/docs/[[...slug]]/page.tsx`.
6. Removed the legacy article route conflict at `app/docs/articles/[slug]/page.tsx`.
7. Re-aligned the search index generator to the new Fumadocs content source.
8. Added generated API reference content under `content/docs/api-reference` via `scripts/generate-api-reference-content.js`.
9. Removed the old custom API route tree and custom API page components.
10. Removed the legacy `docs/` source tree and unused custom MDX/runtime components.
11. Verified the production build.

### Remaining work

1. Decide whether MCP should remain a content page or also move to generated/content-backed reference pages.
2. Audit the remaining MDX runtime behavior and reintroduce richer code-block handling only if it can be done without destabilizing prerender.
3. Review page weight on `/docs/[[...slug]]` and reduce client-side cost where practical.
4. Do a browser QA pass on representative docs, API reference, article, and MCP pages.

## Files That Will Need Direct Changes

### Replaced or refactored

- `web/apps/web-docs-hub/package.json`
- `web/apps/web-docs-hub/next.config.mjs`
- `web/apps/web-docs-hub/app/globals.css`
- `web/apps/web-docs-hub/app/docs/[[...slug]]/page.tsx`
- `web/apps/web-docs-hub/components/fumadocs-mdx-components.tsx`
- `web/apps/web-docs-hub/scripts/generate-api-reference-content.js`
- `web/apps/web-docs-hub/scripts/generate-search-index.js`

### Kept and rewired

- `web/apps/web-docs-hub/components/fumadocs-mdx-components.tsx`
- `web/apps/web-docs-hub/components/docs/SdkSupportMatrix.tsx`

### New files now present

- `web/apps/web-docs-hub/source.config.ts`
- `web/apps/web-docs-hub/lib/source.ts`
- `web/apps/web-docs-hub/app/docs/[[...slug]]/page.tsx`
- `web/apps/web-docs-hub/content/docs/meta.json`
- `web/apps/web-docs-hub/content/docs/*`
- `web/apps/web-docs-hub/content/docs/api-reference/*`

## Tailwind / Styling Note

The docs app is now on Tailwind 4, which matches the Fumadocs baseline more closely. The main remaining styling work is not tooling migration; it is UI review and selective cleanup where the old docs styles and Fumadocs styles overlap.

## Verification Commands

From `web/`:

```bash
pnpm --filter @igris/web-docs-hub lint
pnpm --filter @igris/web-docs-hub typecheck
pnpm --filter @igris/web-docs-hub build
```

## Migration Risk Assessment

Overall remaining effort: `Medium`

The platform migration itself is largely done. The remaining work is cleanup, UX polish, and deciding whether MCP should follow the same generated-content path as the API reference.

Why:

- content migration is relatively straightforward
- architecture migration is the real work
- MCP remains the main special case
- Tailwind 4 requirement increases migration risk

Main risks:

- code block/Mermaid regressions
- metadata drift for articles
- nav/search regressions
- over-customizing on top of Fumadocs after the migration is already structurally complete

## Recommended First Cut

If doing the real migration next, the safest first release should:

1. move plain docs into Fumadocs
2. port only the components actually used in content
3. remove custom route loading and sidebar ownership
4. generate the API reference into Fumadocs content
5. decide whether MCP should follow the same pattern

## What Was Done In This Environment

- completed a full audit of MDX compatibility and current docs architecture
- installed and pinned a Fumadocs-compatible dependency set
- migrated the docs route ownership to Fumadocs
- migrated the primary docs corpus into `content/docs`
- generated the API reference into Fumadocs content
- removed the old custom API route tree
- removed the old `docs/` source tree and dead custom MDX/runtime files
- verified `lint`, `typecheck`, and `build`
