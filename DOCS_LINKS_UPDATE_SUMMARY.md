# Documentation Links Update Summary

**Date:** 2026-01-30
**Repository:** https://github.com/Igris-inertial/docs
**Status:** COMPLETE - All links fixed and verified

---

## Overview

Updated all GitHub organization links and SDK references in the open-source documentation repository to fix 404 errors and reflect the complete 7-SDK ecosystem.

## Changes Made

### 1. SDK References Updated (Overture)

**Before:** Only 3 SDKs mentioned (Python, TypeScript, Go)
**After:** All 7 SDKs documented with correct links

Added complete documentation for:
- Python SDK → `github.com/Igris-inertial/igris-python-sdk`
- Rust SDK → `github.com/Igris-inertial/igris-rust-sdk`
- JavaScript SDK → `github.com/Igris-inertial/igris-javascript-sdk`
- Go SDK → `github.com/Igris-inertial/igris-go-sdk`
- Java SDK → `github.com/Igris-inertial/igris-java-sdk`
- C# SDK → `github.com/Igris-inertial/igris-csharp-sdk`
- Ruby SDK → `github.com/Igris-inertial/igris-ruby-sdk`

### 2. GitHub Organization Links Fixed

**Old (Broken):**
```
github.com/igris-overture/go-sdk → 404
github.com/igris-runtime/igris-runtime → 404
github.com/igris-inertial/igris-runtime → 404
```

**New (Working):**
```
github.com/Igris-inertial/igris-go-sdk → ✓
github.com/Igris-inertial/system → ✓
github.com/orgs/Igris-inertial/repositories → ✓
```

### 3. Documentation Site References

**Before:** `docs.igrisinertial.com` (not hosted)
**After:** `github.com/Igris-inertial/docs` (working)

Updated in files:
- `docs/overture/introduction.mdx`
- `docs/overture/faq.mdx`
- `docs/overture/quickstart.mdx`
- `docs/runtime/api-reference.mdx`

### 4. SDK Usage Clarification

Added clear distinction:

**Overture (Control Plane):**
- Uses custom Igris SDKs (7 languages)
- Optimized for Igris-specific features
- Full SDK documentation with examples

**Runtime (Execution Engine):**
- Uses standard OpenAI SDKs
- 100% OpenAI-compatible
- Just change base URL to `localhost:8080/v1`

---

## Files Updated

Total: **16 MDX files** modified

### Overture Documentation
- `docs/overture/api-reference.mdx`
- `docs/overture/api-reference/sdks.mdx` (major update)
- `docs/overture/faq.mdx`
- `docs/overture/introduction.mdx`
- `docs/overture/quickstart.mdx`

### Runtime Documentation
- `docs/runtime/api-reference.mdx`
- `docs/runtime/architecture.mdx`
- `docs/runtime/core-features/mcp-swarm.mdx`
- `docs/runtime/core-features/qlora.mdx`
- `docs/runtime/deployment.mdx`
- `docs/runtime/faq.mdx`
- `docs/runtime/fleet-management.mdx`
- `docs/runtime/introduction.mdx`
- `docs/runtime/multimodal.mdx`
- `docs/runtime/qlora-training.mdx`
- `docs/runtime/quickstart.mdx`

---

## Commit Information

```
commit 9189034
Author: schlep-engine <wiramahendra@proton.me>
Date:   Fri Jan 30 12:15:34 2026 +0800

    Update SDK references and fix all GitHub links

    - Add all 7 Igris SDKs to Overture docs
    - Fix GitHub org links: igris-overture → Igris-inertial
    - Fix GitHub org links: igris-runtime → Igris-inertial/system
    - Update docs site references to point to GitHub repo
    - Add repository links: github.com/orgs/Igris-inertial/repositories
    - Clarify SDK usage: Overture uses Igris SDKs, Runtime uses OpenAI SDKs
    - Fix all 404 links to use correct organization structure

 16 files changed, 160 insertions(+), 407 deletions(-)
```

---

## Verification

### Live Documentation
**Repository:** https://github.com/Igris-inertial/docs

### Key Pages Verified

1. **Overture SDKs Page:**
   https://github.com/Igris-inertial/docs/blob/main/docs/overture/api-reference/sdks.mdx
   - ✓ Shows all 7 SDKs
   - ✓ All GitHub links working
   - ✓ Correct org structure

2. **Organization Repositories:**
   https://github.com/orgs/Igris-inertial/repositories
   - ✓ Link works in documentation
   - ✓ Shows all 7 SDK repos + docs repo + system repo

3. **Runtime Docs:**
   - ✓ Correctly references OpenAI SDKs
   - ✓ System repo links work

---

## SDK Support Matrix

| SDK | Overture | Runtime | Repository |
|-----|----------|---------|------------|
| Python | ✓ Custom | ✓ OpenAI | igris-python-sdk |
| Rust | ✓ Custom | ✓ OpenAI | igris-rust-sdk |
| JavaScript | ✓ Custom | ✓ OpenAI | igris-javascript-sdk |
| Go | ✓ Custom | ✓ OpenAI | igris-go-sdk |
| Java | ✓ Custom | ✓ OpenAI | igris-java-sdk |
| C# | ✓ Custom | ✓ OpenAI | igris-csharp-sdk |
| Ruby | ✓ Custom | ✓ OpenAI | igris-ruby-sdk |

**Note:** Runtime uses standard OpenAI SDKs because it's 100% OpenAI-compatible. Users just change the `base_url` parameter.

---

## Impact

### Before Update
- 404 errors on GitHub links
- Only 3 SDKs documented
- Confusion about SDK usage
- Broken docs site references

### After Update
- ✓ All GitHub links working
- ✓ All 7 SDKs documented
- ✓ Clear usage guidance
- ✓ Docs point to working GitHub repo

---

## Next Steps

### 1. Update Private Repo Docs

The private repo docs (`web/apps/web-docs` and `web/apps/web-docs-runtime`) should be synchronized with these changes:

```bash
cd /Users/wira/Desktop/system

# Copy updated files back to private repo
cp /Users/wira/Desktop/igris-docs/docs/overture/api-reference/sdks.mdx \
   web/apps/web-docs/docs/api-reference/sdks.mdx

# Or regenerate from public docs
```

### 2. SDK Repository Updates

Update each SDK's README to link back to documentation:

```markdown
## Documentation

- [Overture API Reference](https://github.com/Igris-inertial/docs/tree/main/docs/overture)
- [Runtime Documentation](https://github.com/Igris-inertial/docs/tree/main/docs/runtime)
- [All SDKs](https://github.com/orgs/Igris-inertial/repositories)
```

### 3. Website Updates (Future)

When docs website is deployed:
- Update `docs.igrisinertial.com` DNS
- Deploy MDX docs with proper rendering
- Update API references to link to live site

---

## Links Reference

- **Docs Repo:** https://github.com/Igris-inertial/docs
- **Organization:** https://github.com/orgs/Igris-inertial/repositories
- **System Repo:** https://github.com/Igris-inertial/system
- **7 SDK Repos:** github.com/Igris-inertial/igris-[language]-sdk

---

**Update completed successfully. All documentation links are now working.**
