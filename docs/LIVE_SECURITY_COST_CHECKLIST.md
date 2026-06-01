# Live Security And Cost Checklist

Use this as a small production-readiness gate before showing Igris to users.

| Item | Status | Notes |
| --- | --- | --- |
| Budget alert exists | Manual pending | Confirm in Azure subscription. |
| Container Apps min replicas/max replicas checked | Manual pending | Expected MVP setting: min 0, max 1 unless intentionally changed. |
| No Azure PostgreSQL created | Manual pending | Database should be Neon Postgres only. |
| No VM/AKS/App Service created | Manual pending | Azure footprint should remain Container Apps plus supporting environment/logging. |
| Log volume reviewed | Manual pending | Confirm Log Analytics cost remains low and request bodies/auth headers are not logged. |
| GHCR token scope reviewed | Manual pending | If packages are private, token should be read-only package scope. |
| Admin password stored | Manual pending | Store in password manager, not repo or shell history notes. |
| Console service key stored | Manual pending | Store the console service key securely; raw value is copy-once. |
| Neon URLs stored | Manual pending | Store pooled and direct URLs securely. |
| API keys shown once only | Pass + manual pending | Code path renders raw Agent/app keys once; verify live browser behavior. |
| Runtime keys shown once only | Pass + manual pending | Code path renders raw runtime keys once; verify live browser behavior. |
| Key purpose/scope hardening still pending | Pending | Current keys are tenant-scoped. Finer-grained key purpose/scope is future work. |
| Custom domains pending | Pending | Do not bind until live QA passes on Azure default URLs. |
| Backups/restore process pending | Pending | Neon backup/restore drill still needs a dated runbook execution. |
