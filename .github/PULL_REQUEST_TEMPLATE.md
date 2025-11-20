# Pull Request

## Description
<!-- Describe your changes in detail -->

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring
- [ ] Dependency update

## Checklist

### General
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes

### Production Code Quality (REQUIRED)
- [ ] ✅ **NO imports from `/labs` in production code** (`internal/`, `cmd/`)
- [ ] ✅ **NO CGO references to `/labs` paths** (use `/rust-core/` instead)
- [ ] If moving code from `/labs` to production, it has been graduated to `/rust-core/` or `/internal/`
- [ ] See `rust-core/README.md` for graduation policy

### Rust Modules (if applicable)
- [ ] Cargo build passes (`cargo build --release`)
- [ ] Cargo tests pass (`cargo test`)
- [ ] FFI interface is properly documented in C header
- [ ] Go FFI bindings are memory-safe
- [ ] Module is in `/rust-core/` (NOT `/labs`)

### Database Migrations (if applicable)
- [ ] Migration is idempotent (can run multiple times safely)
- [ ] Migration includes rollback procedure
- [ ] Migration is numbered sequentially
- [ ] Migration tested on fresh database
- [ ] Migration tested on production-like dataset

### SLO Enforcer Changes (if applicable)
- [ ] SLO thresholds are reasonable and tested
- [ ] Remediation actions are safe and reversible
- [ ] HMAC audit signatures are verified
- [ ] Action executors have proper error handling

### BYOK Changes (if applicable)
- [ ] Encryption uses AES-256-GCM with separated IV/tag
- [ ] No plaintext keys logged or stored
- [ ] Key rotation tested
- [ ] Vault HMAC signatures verified

## Testing
<!-- Describe the tests you ran to verify your changes -->

### Test Coverage
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

### Test Results
```
# Paste test output here
```

## Documentation
- [ ] README updated (if needed)
- [ ] API documentation updated (if needed)
- [ ] Code comments added/updated
- [ ] Migration guide created (if breaking change)

## Deployment Notes
<!-- Any special deployment considerations -->

- [ ] No special deployment steps required
- [ ] OR: Special deployment steps documented below

### Special Deployment Steps
<!-- If checked above, list deployment steps here -->

## Related Issues
<!-- Link to related issues using #issue_number -->

Closes #

## Screenshots (if applicable)
<!-- Add screenshots to help explain your changes -->

---

## Reviewer Checklist

### Code Quality
- [ ] Code is clean, readable, and maintainable
- [ ] Error handling is comprehensive
- [ ] Edge cases are handled
- [ ] No security vulnerabilities introduced

### Production Separation (CRITICAL)
- [ ] ✅ NO `/labs` imports in `internal/` or `cmd/`
- [ ] ✅ NO `/labs` paths in CGO directives
- [ ] ✅ All Rust modules in `/rust-core/` (not `/labs`)

### Testing
- [ ] Tests are comprehensive and meaningful
- [ ] Tests pass in CI
- [ ] Manual testing performed (if needed)

### Documentation
- [ ] Code changes are documented
- [ ] API changes are documented
- [ ] README updated if needed

---

**Remember:** Production code lives in `/internal`, `/cmd`, and `/rust-core`. Research lives in `/labs`. Never mix them.
