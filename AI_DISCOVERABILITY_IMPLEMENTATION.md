# AI Discoverability — Implementation Report

All files created. Compatible with `output: 'export'` and Cloudflare Pages. Zero changes to existing components, layouts, or build config.

---

## Files Created

| File | Location | Purpose |
|------|----------|---------|
| `llms.txt` | `web/apps/web-landing/public/llms.txt` | Site summary for AI agents |
| `robots.txt` | `web/apps/web-landing/public/robots.txt` | Explicit bot permissions |
| `JsonLd.tsx` | `web/apps/web-docs-hub/components/JsonLd.tsx` | Reusable Schema.org JSON-LD component |

---

## 1. llms.txt

**Location:** `web/apps/web-landing/public/llms.txt`  
**Served at:** `https://igrisinertial.com/llms.txt`  
**Status:** Created

### What's in it

- H1 project name + blockquote summary
- Product section: Runtime, Overture with descriptions
- Documentation section: 20 docs pages with full URLs and one-line descriptions
- Other section: Pricing, Use Cases, Security

### Verification

```bash
curl https://igrisinertial.com/llms.txt
```

---

## 2. robots.txt

**Location:** `web/apps/web-landing/public/robots.txt`  
**Served at:** `https://igrisinertial.com/robots.txt`  
**Status:** Created

### Bots explicitly allowed

- GPTBot (ChatGPT web browsing)
- OAI-SearchBot (ChatGPT search index)
- ChatGPT-User (ChatGPT plugins/actions)
- ClaudeBot (Claude web browsing)
- Anthropic-AI (Anthropic training/indexing)
- PerplexityBot (Perplexity search)
- Google-Extended (Gemini/Google AI)
- Bytespider (ByteDance)
- Applebot-Extended (Apple Intelligence)

### Verification

```bash
curl https://igrisinertial.com/robots.txt
```

---

## 3. JSON-LD Implementation

**Component:** `web/apps/web-docs-hub/components/JsonLd.tsx`  
**Status:** Created

The component is a server component (no `'use client'`). It accepts a `data` prop and renders an inert `<script type="application/ld+json">` block. Zero hydration risk.

### Usage in docs pages

Add to any docs server component page:

```tsx
import { JsonLd } from '@/components/JsonLd';

export default function DocPage({ params }: PageProps) {
  return (
    <>
      <JsonLd data={/* JSON-LD object */} />
      <DocsLayout>
        <MDXContent>
          <MDXComponent />
        </MDXContent>
      </DocsLayout>
    </>
  );
}
```

### Example 1 — SoftwareApplication (platform overview)

Use on the main `/docs/` page.

```tsx
<JsonLd data={{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Igris Runtime",
  "description": "A 16MB secure, governed AI execution runtime for agents, inference, and robotics. Bounded execution with verifiable traces, deterministic behavior, and local fallback.",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Linux, macOS, Windows, ARM",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "author": {
    "@type": "Organization",
    "name": "Igris Inertial",
    "url": "https://igrisinertial.com"
  },
  "url": "https://docs.igrisinertial.com/docs/",
  "softwareVersion": "latest",
  "featureList": [
    "Bounded execution with resource limits",
    "Verifiable traces and execution receipts",
    "Local GGUF model inference",
    "Cloud API routing via Overture",
    "Fleet management and OTA updates",
    "OS-level sandboxed containment"
  ]
}} />
```

### Example 2 — TechArticle (execution model)

Use on `/docs/execution-model/`.

```tsx
<JsonLd data={{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "Execution Model — Bounded AI Execution with Verifiable Traces",
  "description": "How Igris governs AI execution through envelopes, resource limits, signed violation logs, and deterministic paths. Covers cloud and local execution with cryptographic proof.",
  "url": "https://docs.igrisinertial.com/docs/execution-model/",
  "author": {
    "@type": "Organization",
    "name": "Igris Inertial"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Igris Inertial",
    "url": "https://igrisinertial.com"
  },
  "about": [
    "Bounded execution",
    "Verifiable traces",
    "Execution envelopes",
    "Deterministic behavior"
  ],
  "isPartOf": {
    "@type": "WebSite",
    "name": "Igris Documentation",
    "url": "https://docs.igrisinertial.com"
  }
}} />
```

### Example 3 — HowTo (quickstart)

Use on `/docs/quickstart/`.

```tsx
<JsonLd data={{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "Get Started with Igris Runtime",
  "description": "Install the 16MB Runtime binary, configure your model providers, and execute your first bounded task with verifiable traces.",
  "url": "https://docs.igrisinertial.com/docs/quickstart/",
  "estimatedCost": {
    "@type": "MonetaryAmount",
    "currency": "USD",
    "value": "0"
  },
  "step": [
    {
      "@type": "HowToStep",
      "name": "Install Runtime",
      "text": "Download the 16MB binary for your platform (Linux, macOS, Windows, ARM)."
    },
    {
      "@type": "HowToStep",
      "name": "Configure Providers",
      "text": "Set up your model providers — local GGUF models or cloud APIs (OpenAI, Anthropic, etc.)."
    },
    {
      "@type": "HowToStep",
      "name": "Execute Your First Task",
      "text": "Run a bounded execution task with resource limits and receive a signed execution receipt."
    }
  ],
  "author": {
    "@type": "Organization",
    "name": "Igris Inertial"
  }
}} />
```

### Example 4 — TechArticle (ROS 2 integration)

Use on `/docs/ros2-integration/`.

```tsx
<JsonLd data={{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "ROS 2 Integration — Governed AI Execution for Robotics",
  "description": "Run Igris Runtime on ROS 2 Humble and Iron systems. Topics, services, and behavior trees for autonomous robot execution with bounded safety limits.",
  "url": "https://docs.igrisinertial.com/docs/ros2-integration/",
  "author": {
    "@type": "Organization",
    "name": "Igris Inertial"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Igris Inertial",
    "url": "https://igrisinertial.com"
  },
  "about": [
    "ROS 2 integration",
    "Autonomous systems",
    "Robotics execution",
    "Fleet management"
  ],
  "isPartOf": {
    "@type": "WebSite",
    "name": "Igris Documentation",
    "url": "https://docs.igrisinertial.com"
  }
}} />
```

---

## Next Steps After Adding Files

### Test locally

```bash
# From the web-landing directory
npm run dev

# Then open in browser or curl
curl http://localhost:3000/llms.txt
curl http://localhost:3000/robots.txt
```

### Test after deploy (Cloudflare Pages)

```bash
curl https://igrisinertial.com/llms.txt
curl https://igrisinertial.com/robots.txt
```

### Validate robots.txt

- [Google robots.txt Tester](https://www.google.com/webmasters/tools/robots-testing-tool)
- Or: `curl -A GPTBot https://igrisinertial.com/robots.txt`

### Validate JSON-LD

- [Google Rich Results Test](https://search.google.com/test/rich-results) — paste the docs page URL
- [Schema.org Validator](https://validator.schema.org/) — paste the page URL or JSON-LD snippet
- Browser DevTools → inspect `<script type="application/ld+json">` in page source

### Validate llms.txt

- `curl https://igrisinertial.com/llms.txt` — should return plain text
- Test with ChatGPT browsing or Perplexity — ask about Igris and check if it cites docs pages

---

## Summary

| Item | Status | URL |
|------|--------|-----|
| `/llms.txt` | Created | `igrisinertial.com/llms.txt` |
| `/robots.txt` | Created | `igrisinertial.com/robots.txt` |
| `JsonLd.tsx` | Created | `docs.igrisinertial.com` (ready to import) |

All files are additive. No existing code modified. Compatible with static export and Cloudflare Pages.
