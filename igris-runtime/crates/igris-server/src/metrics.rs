use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

#[derive(Clone)]
pub struct Metrics {
    pub started_at: Instant,
    pub http_requests_total: Arc<AtomicU64>,
    pub http_unauthorized_total: Arc<AtomicU64>,
    pub http_rate_limited_total: Arc<AtomicU64>,
    pub chat_requests_total: Arc<AtomicU64>,
    pub chat_stream_requests_total: Arc<AtomicU64>,
    pub tool_exec_total: Arc<AtomicU64>,
}

impl Metrics {
    pub fn new() -> Self {
        Self {
            started_at: Instant::now(),
            http_requests_total: Arc::new(AtomicU64::new(0)),
            http_unauthorized_total: Arc::new(AtomicU64::new(0)),
            http_rate_limited_total: Arc::new(AtomicU64::new(0)),
            chat_requests_total: Arc::new(AtomicU64::new(0)),
            chat_stream_requests_total: Arc::new(AtomicU64::new(0)),
            tool_exec_total: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn render_prometheus(&self) -> String {
        let up_secs = self.started_at.elapsed().as_secs_f64();
        format!(
            "\
# HELP igris_uptime_seconds Process uptime in seconds.\n\
# TYPE igris_uptime_seconds gauge\n\
igris_uptime_seconds {up_secs}\n\
# HELP igris_http_requests_total Total HTTP requests.\n\
# TYPE igris_http_requests_total counter\n\
igris_http_requests_total {http}\n\
# HELP igris_http_unauthorized_total Total unauthorized requests.\n\
# TYPE igris_http_unauthorized_total counter\n\
igris_http_unauthorized_total {unauth}\n\
# HELP igris_http_rate_limited_total Total rate limited requests.\n\
# TYPE igris_http_rate_limited_total counter\n\
igris_http_rate_limited_total {rl}\n\
# HELP igris_chat_requests_total Total chat completion requests.\n\
# TYPE igris_chat_requests_total counter\n\
igris_chat_requests_total {chat}\n\
# HELP igris_chat_stream_requests_total Total streaming chat completion requests.\n\
# TYPE igris_chat_stream_requests_total counter\n\
igris_chat_stream_requests_total {chat_stream}\n\
# HELP igris_tool_exec_total Total tool executions.\n\
# TYPE igris_tool_exec_total counter\n\
igris_tool_exec_total {tool}\n",
            up_secs = up_secs,
            http = self.http_requests_total.load(Ordering::Relaxed),
            unauth = self.http_unauthorized_total.load(Ordering::Relaxed),
            rl = self.http_rate_limited_total.load(Ordering::Relaxed),
            chat = self.chat_requests_total.load(Ordering::Relaxed),
            chat_stream = self.chat_stream_requests_total.load(Ordering::Relaxed),
            tool = self.tool_exec_total.load(Ordering::Relaxed),
        )
    }
}
