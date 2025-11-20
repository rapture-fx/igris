# SCHLEP LABS — ARCHIVED R&D MODULES

⚠️ **IMPORTANT:** **NOTHING in /labs is production-integrated.**

**Production Rust lives in `/rust-core/`**

## Purpose

This directory preserves experimental research, prototypes, and archived modules that are:
- **NOT production-ready**
- **NOT imported by production code** (internal/, cmd/)
- Serving as R&D prototypes for future features
- Historical reference for design decisions

## Directory Structure

- **research/** - Experimental Rust modules (cognitive, RL, predictive)
  - ⚠️ **cognitive/** - Cognitive reasoning experiments (Phase 11.5) - NOT INTEGRATED
  - ⚠️ **autonomous/** - Autonomous control experiments (Phase 12) - NOT INTEGRATED
  - ⚠️ **predictive/** - Predictive forecasting (Phase 11.2) - NOT INTEGRATED
  - ⚠️ **rl/** - Reinforcement learning experiments (Phase 11.1) - NOT INTEGRATED
- **archived/** - Previously active modules that have been moved to production
  - `slo_enforcer_moved_to_production_2025-11-20/` - Graduated to `/rust-core/production_slo_enforcer/`
- **cognitive/** - Cognitive reasoning JSON outputs
- **scaling/** - Auto-scaling research
- **validation/** - Shadow evaluation frameworks
- **_archive/** - Older archived code

## Graduated Modules (Moved to Production)

### ✅ SLO Enforcer (2025-11-20)
- **Old Location:** `labs/research/slo_enforcer/`
- **New Location:** `rust-core/production_slo_enforcer/`
- **Production Crate:** `schlep_slo_enforcer` v1.1.0
- **Status:** Production-ready, FFI-integrated, runs every 20s

## Integration Policy

**Before promoting any labs module to production:**

1. ✅ Graduate to `/rust-core/` or `/internal/` (NOT in `/labs`)
2. ✅ Ensure clear documentation and test coverage
3. ✅ Validate through benchmarks showing measurable improvements
4. ✅ Align with product roadmap
5. ✅ Get approval from engineering leads
6. ✅ Update CI/CD to prevent `/labs` imports in production code

## CI/CD Protection

Production code (`internal/`, `cmd/`) **CANNOT import from `/labs`**.

This is enforced via:
- Pre-commit hooks
- CI linting rules
- Pull request template checks

**Rule:** If a module is good enough for production, graduate it to `/rust-core/` or `/internal/` first.

## Future Research Modules

The following modules are under active research but NOT production-integrated:

- **Cognitive Layer** (Q2-Q3 2026) - Requires RL + Predictive + Simulation
- **Autonomous Control** (Q4 2026+) - Requires Cognitive + SLO Enforcer
- **Predictive Optimization** - May replace with existing `/internal/forecasting/`
- **Multi-Objective RL** - Extract reward engine, integrate with Thompson Sampling

---

**Remember:** Labs is for experimentation. Production is for shipping. Keep them separate.
