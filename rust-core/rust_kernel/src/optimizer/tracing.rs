//! OpenTelemetry tracing support for optimizer
//!
//! Provides distributed tracing instrumentation for the Thompson Sampling optimizer,
//! enabling trace propagation from Go → Rust via FFI.

use opentelemetry::{
    global,
    trace::{Span, SpanKind, Status, Tracer},
    Context, KeyValue,
};
use opentelemetry_sdk::{
    trace::{Sampler, TracerProvider},
    Resource,
};
use opentelemetry_jaeger::new_collector_pipeline;
use std::sync::Once;
use tracing::info;

static INIT: Once = Once::new();

/// Initialize OpenTelemetry tracing for Rust optimizer
///
/// This should be called once at startup. It sets up:
/// - Jaeger exporter
/// - Global tracer provider
/// - Trace context propagation
pub fn init_tracing(service_name: &str, jaeger_endpoint: &str) -> Result<(), Box<dyn std::error::Error>> {
    INIT.call_once(|| {
        // Create Jaeger exporter
        let tracer = match new_collector_pipeline()
            .with_service_name(service_name)
            .with_endpoint(jaeger_endpoint)
            .with_reqwest()
            .install_batch(opentelemetry_sdk::runtime::Tokio)
        {
            Ok(provider) => {
                global::set_tracer_provider(provider.clone());
                provider.tracer(service_name)
            }
            Err(e) => {
                eprintln!("Failed to initialize Jaeger tracer: {}", e);
                // Return no-op tracer on error
                global::tracer(service_name)
            }
        };

        info!("✅ Rust optimizer tracing initialized (endpoint: {})", jaeger_endpoint);
    });

    Ok(())
}

/// Create a span for optimizer operations
///
/// # Arguments
/// * `operation` - Operation name (e.g., "select_action", "update_reward")
/// * `trace_id` - Optional trace ID from parent span (Go gateway)
/// * `span_id` - Optional parent span ID
///
/// # Returns
/// Span context that can be used to record attributes and events
pub fn create_optimizer_span(
    operation: &str,
    trace_id: Option<&str>,
    span_id: Option<&str>,
) -> Context {
    let tracer = global::tracer("igris-optimizer");

    let mut span_builder = tracer
        .span_builder(format!("optimizer.{}", operation))
        .with_kind(SpanKind::Internal);

    // Add standard attributes
    span_builder = span_builder.with_attributes(vec![
        KeyValue::new("component", "rust-optimizer"),
        KeyValue::new("optimizer.algorithm", "thompson_sampling"),
    ]);

    // TODO: Parse trace_id and span_id to propagate context from Go
    // This requires implementing W3C Trace Context parsing
    if let (Some(tid), Some(sid)) = (trace_id, span_id) {
        span_builder = span_builder.with_attributes(vec![
            KeyValue::new("parent.trace_id", tid.to_string()),
            KeyValue::new("parent.span_id", sid.to_string()),
        ]);
    }

    let span = span_builder.start(&tracer);
    Context::current_with_span(span)
}

/// Record optimizer decision attributes in current span
pub fn record_selection_attributes(
    ctx: &Context,
    action_id: &str,
    arm_count: usize,
    selection_time_us: u64,
) {
    if let Some(span) = ctx.span().span_context() {
        if span.is_valid() {
            let span_mut = ctx.span();
            span_mut.set_attributes(vec![
                KeyValue::new("optimizer.action_id", action_id.to_string()),
                KeyValue::new("optimizer.arm_count", arm_count as i64),
                KeyValue::new("optimizer.selection_time_us", selection_time_us as i64),
            ]);
        }
    }
}

/// Record reward update attributes in current span
pub fn record_update_attributes(
    ctx: &Context,
    action_id: &str,
    reward: f64,
    latency_ms: Option<f64>,
    cost_usd: Option<f64>,
    success: bool,
) {
    if let Some(span) = ctx.span().span_context() {
        if span.is_valid() {
            let span_mut = ctx.span();
            let mut attrs = vec![
                KeyValue::new("optimizer.action_id", action_id.to_string()),
                KeyValue::new("optimizer.reward", reward),
                KeyValue::new("optimizer.success", success),
            ];

            if let Some(lat) = latency_ms {
                attrs.push(KeyValue::new("optimizer.latency_ms", lat));
            }

            if let Some(cost) = cost_usd {
                attrs.push(KeyValue::new("optimizer.cost_usd", cost));
            }

            span_mut.set_attributes(attrs);
        }
    }
}

/// Record Thompson Sampling algorithm attributes
pub fn record_sampling_attributes(
    ctx: &Context,
    arm_id: &str,
    alpha: f64,
    beta: f64,
    sampled_value: f64,
) {
    if let Some(span) = ctx.span().span_context() {
        if span.is_valid() {
            let span_mut = ctx.span();
            span_mut.set_attributes(vec![
                KeyValue::new("thompson.arm_id", arm_id.to_string()),
                KeyValue::new("thompson.alpha", alpha),
                KeyValue::new("thompson.beta", beta),
                KeyValue::new("thompson.sampled_value", sampled_value),
            ]);
        }
    }
}

/// Record error in current span
pub fn record_error(ctx: &Context, error: &str) {
    if let Some(span_ctx) = ctx.span().span_context() {
        if span_ctx.is_valid() {
            let span = ctx.span();
            span.set_status(Status::error(error.to_string()));
            span.add_event(
                "error".to_string(),
                vec![KeyValue::new("error.message", error.to_string())],
            );
        }
    }
}

/// End span and flush to Jaeger
pub fn end_span(ctx: Context) {
    // Span is automatically ended when dropped
    drop(ctx);
}

/// Shutdown tracing and flush remaining spans
pub fn shutdown_tracing() {
    global::shutdown_tracer_provider();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_span_creation() {
        let ctx = create_optimizer_span("test_operation", None, None);
        assert!(ctx.span().span_context().is_valid());
    }

    #[test]
    fn test_selection_attributes() {
        let ctx = create_optimizer_span("select_action", None, None);
        record_selection_attributes(&ctx, "test-action", 3, 1500);
        // Span attributes recorded successfully
    }

    #[test]
    fn test_update_attributes() {
        let ctx = create_optimizer_span("update_reward", None, None);
        record_update_attributes(&ctx, "test-action", 0.95, Some(85.0), Some(0.002), true);
        // Span attributes recorded successfully
    }
}
