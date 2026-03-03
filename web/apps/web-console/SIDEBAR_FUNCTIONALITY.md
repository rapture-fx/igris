# Dashboard Sidebar - Current Functionality

## Overview

This document describes the current functionality of each sidebar item in the web console dashboard.

---

## Sidebar Structure

### Overview

| Route | Label | Current Functionality |
|-------|-------|----------------------|
| `/dashboard` | Dashboard | **System Overview** - Displays 6 metric cards: Active Executions, Recent Violations, Fleet Status, Model Usage, Recent Receipts, and Active Alerts. Shows real-time overview of the runtime execution system. |

---

### Execution

| Route | Label | Current Functionality |
|-------|-------|----------------------|
| `/execution/runs` | Runs | Currently loads **Fleet** page - Shows fleet instance management, device status, and fleet-wide configuration. Displays list of runtime instances with their status (online/offline), CPU usage, and inference metrics. |
| `/execution/agents` | Agents | Currently loads **QLoRA Agents** page - Shows agent configuration and management. Displays agent models, tool configurations, and planning settings for agent-based execution. |

---

### Fleet

| Route | Label | Current Functionality |
|-------|-------|----------------------|
| `/fleet/devices` | Devices | Currently loads **Runtime Devices** page - Shows all registered edge devices in the fleet. Displays device details including status, version, last seen timestamp, execution count, and violation history. |

---

### Models

| Route | Label | Current Functionality |
|-------|-------|----------------------|
| `/models/routing` | Routing | Currently loads **Policy** page - Shows routing configuration, provider selection rules, and fallback settings. Allows configuration of how requests are routed to different model providers. |
| `/models/providers` | Providers | Currently loads **Providers** page - Shows configured model providers (OpenAI, Anthropic, etc.). Allows adding, editing, and managing API keys and provider configurations. |
| `/models/cost` | Cost | Currently loads **Usage** page - Shows cost analytics and spending by provider. Displays cost trends, cost per model, and usage breakdown across different providers. |

---

### Policy

| Route | Label | Current Functionality |
|-------|-------|----------------------|
| `/policy/bounds` | Bounds | Currently loads **Policy** page - Shows execution limits and bounds configuration. Includes CPU percentage limits, memory allocation, max tick duration, and quota settings. |
| `/policy/capabilities` | Capabilities | Currently loads **Planning** page - Shows agent capabilities and permissions. Configuration for HTTP access, shell commands, filesystem access, and allowed domains. |

---

### Proof

| Route | Label | Current Functionality |
|-------|-------|----------------------|
| `/proof/receipts` | Receipts | Currently loads **Observability** page - Shows execution receipts, audit logs, and signed execution records. |
| `/proof/violations` | Violations | Currently loads **Observability** page - Shows policy violations and breach history across executions and devices. |

---

### History

| Route | Label | Current Functionality |
|-------|-------|----------------------|
| `/history/logs` | Logs | Currently loads **Observability** page - Shows system logs and execution event history. |
| `/history/metrics` | Metrics | Currently loads **Observability** page - Shows performance metrics including latency, throughput, and error rates. |
| `/history/alerts` | Alerts | Currently loads **Observability** page - Shows active alerts and notifications requiring attention. |

---

### Settings

| Route | Label | Current Functionality |
|-------|-------|----------------------|
| `/settings/general` | General | Currently loads **Settings** page - General system configuration, tenant settings, and preferences. |
| `/settings/keys` | Keys | Currently loads **Settings** page - API key management for providers and system credentials. |
| `/settings/license` | License | Currently loads **Settings** page - Subscription and license information, usage quotas. |

---

## Notes

- Many routes currently point to existing pages for backward compatibility
- The new route structure is in place but content is dynamically loaded from existing pages
- As pages are developed, the route mappings will be updated to point to dedicated pages
- All pages use **shadcn/ui** components for consistent styling
- The dashboard follows a **light mode** design with minimal, technical styling similar to Stripe/Cloudflare dashboards
