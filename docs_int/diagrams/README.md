# Schlep-Engine Architecture Diagrams

This directory contains Mermaid diagrams documenting the Schlep-engine architecture.

**Last Updated:** 2025-10-20

## Diagram Inventory

### Internal Diagrams (`docs/diagrams/`)

Technical diagrams synchronized with the current codebase for internal development and documentation.

| Diagram | Description | File |
|---------|-------------|------|
| **System Overview** | Complete system architecture with all layers (Go, Rust, FFI, CGO) | `01-system-overview.mmd` |
| **Request Flow** | End-to-end request flow with SafetyController, ShadowRunner, and InferenceRouter | `02-request-flow.mmd` |
| **Optimizer Modes** | Three operating modes: go, shadow, rust with detailed state transitions | `03-optimizer-modes.mmd` |
| **Shadow Mode Detail** | Shadow comparison flow showing parallel Go and Rust execution | `04-shadow-mode-detail.mmd` |
| **Rust FFI Architecture** | CGO/FFI bridge between Go and Rust optimizer with all FFI functions | `05-rust-ffi-architecture.mmd` |
| **Admin Control Plane** | Hot-reload configuration via Admin API without service restart | `06-admin-control-plane.mmd` |

### Public Diagrams (`docs/public/architecture/`)

Customer-facing diagrams that abstract implementation details and focus on conceptual understanding.

| Diagram | Description | File |
|---------|-------------|------|
| **Public Overview** | High-level conceptual architecture for external documentation | `schlep_engine_public_overview.mmd` |

## Architecture Components (Synchronized with Codebase)

### Go Layer
- **InferHandler** (`cmd/schlep-engine-api/handlers/infer.go`)
- **ShadowRunner** (`internal/inference/optimizer/shadow/shadow_runner.go`)
- **InferenceRouter** (`internal/router/`)
- **ProviderRegistry** (`internal/providers/`)
- **SafetyController** (`internal/safety/`)
- **RuntimeOptimizerConfig** (`internal/config/`)

### FFI/CGO Layer
- **OptimizerHandle** (`internal/inference/optimizer/ffi/ffi_wrapper.go`)
- FFI Functions:
  - `optimizer_init(config_json)` → `*OptimizerHandle`
  - `optimizer_select_action(handle)` → `*char` (JSON)
  - `optimizer_update_reward(handle, action_id, reward)` → `int`
  - `optimizer_update_metrics(handle, action_id, metrics_json)` → `int`
  - `optimizer_get_stats(handle)` → `*char` (JSON)
  - `optimizer_export_state(handle)` → `*char` (JSON)
  - `optimizer_free(handle)` → `void`

### Rust Layer
- **Thompson Sampling Optimizer** (`rust-core/rust_kernel/src/optimizer/`)
- **Beta Distribution** (Per-arm state: α, β parameters)
- **Reward Calculator** (Weighted metrics: latency, cost, quality, success, cache)
- **State Manager** (JSON export/import)

## Naming Conventions

Diagrams use consistent naming conventions:

- **Structs/Modules**: `PascalCase` (e.g., `InferHandler`, `ShadowRunner`, `OptimizerHandle`)
- **Functions**: `camelCase` (e.g., `selectAction`, `updateMetrics`, `getStats`)
- **FFI/CGO**: `snake_case` (e.g., `optimizer_init`, `optimizer_select_action`)

## Color Mapping

Consistent color scheme across all diagrams:

| Component | Color | Hex |
|-----------|-------|-----|
| Go Layer | Light Blue | `#D6EAF8` |
| Rust Layer | Light Pink | `#FADBD8` |
| FFI/CGO Bridge | Pale Yellow | `#FCF3CF` |
| Routing & Handlers | Purple Tint | `#E8DAEF` |
| Optimizer Core | Peach Tint | `#FDEBD0` |
| Provider Layer | Mint Green | `#D5F5E3` |
| Metrics/Observability | Lavender | `#EBDEF0` |
| Control Plane | Beige | `#FEF9E7` |

## Viewing Diagrams

### Online Viewer
Visit [Mermaid Live Editor](https://mermaid.live) and paste the diagram contents.

### VSCode
Install the [Mermaid Preview](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) extension.

### Command Line
```bash
# Install Mermaid CLI
npm install -g @mermaid-js/mermaid-cli

# Render to PNG
mmdc -i docs/diagrams/01-system-overview.mmd -o docs/rendered/diagrams/01-system-overview.png

# Render to SVG
mmdc -i docs/diagrams/01-system-overview.mmd -o docs/rendered/diagrams/01-system-overview.svg
```

## Synchronization Notes

All diagrams were synchronized with the codebase on **2025-10-20**. Key updates:

- ✅ Updated component names to match actual Go structs and functions
- ✅ Added SafetyController and SLOBreaker to system diagrams
- ✅ Updated FFI function signatures to match `ffi_wrapper.go`
- ✅ Added BenchmarkProvider to provider layer
- ✅ Synchronized optimizer modes with `shadow_runner.go` constants
- ✅ Updated control plane to show RuntimeOptimizerConfig hot-reload
- ✅ Applied consistent color mapping across all diagrams
- ✅ Created public-facing diagram with abstracted implementation details

## Maintenance

When updating diagrams:
1. Verify component names match actual code
2. Apply consistent naming conventions (PascalCase, camelCase, snake_case)
3. Use standard color mapping
4. Update this README with synchronization date
5. Test rendering in Mermaid Live Editor
