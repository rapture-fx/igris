# P1: Operator reconciliation auth-method hardening

**Status:** documented debt — no exploit demonstrated on current main.  
**Origin:** Clock 3D soft WARN during stabilization review.

## Current behavior

`reconciliationOperator` requires authenticated identity + `IsAdminRequest`.
API-key auth builds `TenantContext` **without** setting `IsAdmin` / roles, so
API keys fail as `not_authorized`.

## Gap

Authorization relies on `IsAdmin` remaining unset on the API-key path rather
than an explicit `auth_method == "session"` gate. A future admin-capable API
key principal could accidentally gain operator reconciliation authority if
`IsAdmin` is ever set on non-session auth.

## Recommended fix (dedicated PR)

1. Require `auth_method == "session"` (or equivalent) inside `reconciliationOperator`.
2. Add a dedicated API-key rejection test for GET/POST reconciliation.
3. Keep tenant isolation and `cryptographic_proof=false` unchanged.

Do not expand Product Compression Slice 1 for this.
