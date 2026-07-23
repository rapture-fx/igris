# Secure external HTTPS Action targets — design brief (next slice)

**Status:** investigation only — not implemented in Product Compression Slice 1.  
**Verified on:** `feature/product-compression` after main `311c17433`.

## Current behavior (source)

Binding create (`POST …/bindings`) in `igris-overture/api/routes_contracts.go`:

* Rejects non-loopback webhook URLs with `unsafe_target_url` (“Clock 3B durable-local bindings require a loopback HTTP target”).
* Requires `local_auth_header_name` + `IGRIS_*` secret env (`adapter_auth_required`).
* `isLoopbackHTTPURL` (in `routes_actions.go`) allows only `http://` + `127.0.0.1` / `localhost` / `::1`.

Target **registration** (`POST /v1/actions`) can accept broader URLs; failure is deferred to **bind**. That trap door confuses external developers.

## Product impact

Blocks the intended external coding-agent deployment pilot (real `https://…` adapter). Loopback dogfood remains valid for Slice 1 validation.

## Narrow next-slice design must address

| Concern | Direction |
|---|---|
| HTTPS | Require `https` for non-loopback; no plaintext remote |
| DNS | Resolve at bind + at each dispatch; pin or re-check |
| Private/reserved IP | Deny RFC1918, loopback, link-local, metadata ranges (IPv4+IPv6) unless explicit local-dev exception |
| Redirects | Do not follow redirects while forwarding credentials (align with SDK `_NoRedirectHandler`) |
| DNS rebinding | Re-resolve and re-validate IP before connect; short TTL awareness |
| Credential forwarding | Adapter auth via registered header + secret env / vault ref — never customer Bearer to arbitrary hosts |
| Ownership | Target must be tenant-owned; bind only to tenant’s target id |
| Verification | Optional challenge URL / signed handshake before first bind |
| Local-dev exception | Keep today’s loopback path behind explicit `http://127.0.0.1` rule |
| Auditability | Log bind decisions (tenant, host, resolved IPs, policy version) |

## Hard rule

Do not allow arbitrary external URLs. Implement as a dedicated security slice after Slice 1 facade lands.
