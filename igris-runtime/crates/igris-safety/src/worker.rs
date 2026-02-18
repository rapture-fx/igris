/// Returns `true` when the current process was spawned by a Supervisor with `--worker`.
///
/// Host binaries that link against `igris-safety` should call this at the top of `main`:
///
/// ```rust,ignore
/// if igris_safety::worker::is_worker_mode() {
///     igris_safety::worker::run_worker_loop();
/// }
/// ```
pub fn is_worker_mode() -> bool {
    std::env::args().any(|a| a == "--worker")
}

/// Worker main loop.
///
/// Reads newline-delimited JSON jobs from stdin, executes each one, and writes a
/// JSON result line to stdout. Exits with code 0 when stdin is closed.
///
/// This function never returns — it terminates the process when done.
pub fn run_worker_loop() -> ! {
    use std::io::{BufRead, Write};

    let stdin = std::io::stdin();
    let stdout = std::io::stdout();
    let mut out = stdout.lock();

    for line in stdin.lock().lines() {
        match line {
            Err(_) => break,
            Ok(l) if l.trim().is_empty() => continue,
            Ok(l) => {
                let result = execute_job(&l);
                // Write exactly one JSON line per job.
                if let Err(_) = writeln!(out, "{}", result) {
                    break;
                }
                if let Err(_) = out.flush() {
                    break;
                }
            }
        }
    }

    std::process::exit(0)
}

/// Execute a single job represented as a raw JSON string.
///
/// The job payload is echoed back in a `{ "status": "ok", "result": <payload> }` envelope.
/// Parse errors are returned as `{ "status": "error", "error": "<msg>" }`.
fn execute_job(raw: &str) -> serde_json::Value {
    match serde_json::from_str::<serde_json::Value>(raw) {
        Ok(payload) => serde_json::json!({
            "status": "ok",
            "result": payload,
        }),
        Err(e) => serde_json::json!({
            "status": "error",
            "error": e.to_string(),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_worker_mode_false_in_test() {
        // Unit tests do not pass --worker, so this should be false.
        // (Will be true only when the supervisor spawns us with --worker.)
        let has_worker_flag = std::env::args().any(|a| a == "--worker");
        assert_eq!(is_worker_mode(), has_worker_flag);
    }

    #[test]
    fn test_execute_job_valid_json() {
        let result = execute_job(r#"{"task": "ping"}"#);
        assert_eq!(result["status"], "ok");
        assert_eq!(result["result"]["task"], "ping");
    }

    #[test]
    fn test_execute_job_invalid_json() {
        let result = execute_job("not json");
        assert_eq!(result["status"], "error");
        assert!(result["error"].as_str().is_some());
    }

    #[test]
    fn test_execute_job_roundtrip() {
        let payload = serde_json::json!({"x": 42, "y": [1, 2, 3]});
        let raw = payload.to_string();
        let result = execute_job(&raw);
        assert_eq!(result["status"], "ok");
        assert_eq!(result["result"], payload);
    }
}
