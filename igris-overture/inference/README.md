# INFERENCE CORE — ROUTING & BATCHING ENGINE

This directory contains the core inference orchestration logic for the Igris Overture MVP.

## Modules

### router/
Model and provider arbitration using Thompson Sampling and adaptive algorithms.

### batcher/
Micro-batching windows for efficient request grouping and processing.

### policy/
Cost/latency/quality routing modes and policy management.

### cost/
Cost tracking, baseline vs actual comparison, and savings calculation.

## Status

**Phase:** MVP Development
**Priority:** High - Core product functionality

## Next Steps

1. Implement `/v1/infer` endpoint
2. Add multi-provider support (OpenAI, Anthropic, local)
3. Integrate Rust batch processing via FFI
4. Add cost tracking and reporting
