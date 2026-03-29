# Cloudflare Support Request — Managed robots.txt Override

## Issue

Cloudflare's managed robots.txt is overriding my custom robots.txt file deployed via Cloudflare Pages. This blocks AI bots (GPTBot, ClaudeBot, Google-Extended) from crawling my site.

## Project

- **Platform:** Cloudflare Pages
- **Site:** igrisinertial.com
- **Stack:** Next.js with `output: 'export'` (static site generation)
- **Build output:** Files are generated in `out/` directory

## What I've confirmed

1. My custom `robots.txt` exists in `public/robots.txt` and is included in the build output (`out/robots.txt` — 385 bytes)
2. The file explicitly allows GPTBot, ClaudeBot, PerplexityBot, Google-Extended, OAI-SearchBot
3. After deployment, `https://igrisinertial.com/robots.txt` returns Cloudflare's managed version instead
4. The managed version has `Disallow: /` for GPTBot, ClaudeBot, Google-Extended — blocking all AI bots

## What Cloudflare serves (live)

```
# BEGIN Cloudflare Managed content

User-agent: *
Content-Signal: search=yes,ai-train=no
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Applebot-Extended
Disallow: /

# END Cloudflare Managed Content
```

## What I need

Disable the managed robots.txt feature for my Pages project so my custom robots.txt from `public/robots.txt` is served instead.

## What I've tried

- Checked Pages project settings — no "Managed robots.txt" or "AI Labyrinth" toggle found
- Checked domain-level Security → Bots — no relevant toggle found
- Checked Rules → Configuration Rules / Transform Rules — no robots.txt rules found
- Checked DNS — no Worker routes for robots.txt
- Files are correctly built and present in output

## Request

Please disable Cloudflare's managed robots.txt for my Pages project at igrisinertial.com, or tell me the exact setting/location to do this myself.
