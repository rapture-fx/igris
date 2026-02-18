use crate::{
    bounds::Bounds,
    violation::{ViolationKind, ViolationRecord},
};
use ed25519_dalek::SigningKey;
use serde_json::Value;
use std::process::Stdio;
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, ChildStdout, Command},
    time::{timeout, Duration},
};

struct WorkerHandle {
    child: Child,
    pid: u32,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

struct SupervisorConfig {
    bounds: Bounds,
    signing_key: SigningKey,
    log_path: String,
    last_hash: String,
}

/// Supervisor manages a persistent worker process for true process-level containment.
///
/// All user code execution occurs inside the worker process. The supervisor:
/// - Spawns the worker (same binary, `--worker` flag)
/// - Attaches it to a dedicated cgroup (Linux)
/// - Forwards JSON jobs over stdin
/// - Reads JSON results from stdout
/// - Enforces a hard timeout via `tokio::time::timeout`
/// - SIGKILLs the worker on timeout, writes a signed violation record, and respawns
pub struct Supervisor {
    config: SupervisorConfig,
    worker: Option<WorkerHandle>,
}

impl Supervisor {
    pub fn new(bounds: Bounds, signing_key: SigningKey, log_path: String) -> Self {
        Self {
            config: SupervisorConfig {
                bounds,
                signing_key,
                log_path,
                last_hash: String::new(),
            },
            worker: None,
        }
    }

    /// Spawn a fresh worker process and attach it to a cgroup.
    fn spawn_worker(&mut self) -> Result<(), String> {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let mut child = Command::new(exe)
            .arg("--worker")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| e.to_string())?;

        let pid = child.id().ok_or_else(|| "worker exited immediately".to_string())?;
        let stdin = child.stdin.take().ok_or_else(|| "could not get worker stdin".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "could not get worker stdout".to_string())?;
        let stdout = BufReader::new(stdout);

        self.attach_cgroup(pid)?;

        self.worker = Some(WorkerHandle { child, pid, stdin, stdout });
        Ok(())
    }

    /// Add the worker PID to a CPU-quota cgroup (Linux only; no-op on other platforms).
    #[cfg(target_os = "linux")]
    fn attach_cgroup(&self, pid: u32) -> Result<(), String> {
        use cgroups_rs::{hierarchies, CgroupBuilder, CgroupPid};
        let hier = hierarchies::auto();
        let period: i64 = 100_000; // 100 ms in µs
        let quota = (self.config.bounds.max_cpu_percent as i64 * period) / 100;
        let mut builder = CgroupBuilder::new("igris_worker");
        builder.cpu().cpu_quota(quota).cpu_period(period).done();
        let cg = builder.build(hier);
        cg.add_task(CgroupPid::from(pid as u64)).map_err(|e| e.to_string())
    }

    #[cfg(not(target_os = "linux"))]
    fn attach_cgroup(&self, _pid: u32) -> Result<(), String> {
        Ok(())
    }

    /// Send SIGKILL to the current worker. Does nothing if no worker is running.
    fn kill_worker(&self) {
        if let Some(w) = &self.worker {
            #[cfg(unix)]
            {
                use nix::sys::signal::{kill, Signal};
                use nix::unistd::Pid;
                let _ = kill(Pid::from_raw(w.pid as i32), Signal::SIGKILL);
            }
        }
    }

    /// Wait for the worker to exit and clear the handle.
    async fn reap_worker(&mut self) {
        if let Some(mut w) = self.worker.take() {
            let _ = w.child.wait().await;
        }
    }

    /// Write a signed violation record and update the hash chain.
    fn record_violation(&mut self, kind: ViolationKind, context: Value) {
        let record = ViolationRecord::new(
            kind,
            context,
            self.config.last_hash.clone(),
            &self.config.signing_key,
        );
        let _ = record.append_to_log(&self.config.log_path);
        self.config.last_hash = record.hash.clone();
    }

    /// Execute a job in the worker process.
    ///
    /// Sends `job` as a single JSON line to the worker's stdin and reads one JSON line
    /// from stdout. A hard timeout of `bounds.max_tick_ms` is applied.
    ///
    /// On timeout the worker is SIGKILLed, a signed violation record is written, and a
    /// fresh worker is spawned before returning `Err(ViolationKind::Time)`.
    pub async fn execute(&mut self, job: Value) -> Result<Value, ViolationKind> {
        if self.worker.is_none() {
            self.spawn_worker().map_err(|_| ViolationKind::Cpu)?;
        }

        let job_bytes = {
            let mut s = serde_json::to_string(&job).expect("job is serializable");
            s.push('\n');
            s
        };

        let duration = Duration::from_millis(self.config.bounds.max_tick_ms);

        // Borrow stdin/stdout from the worker for the IPC future.
        let ipc_result = {
            let w = self.worker.as_mut().unwrap();
            let stdin = &mut w.stdin;
            let stdout = &mut w.stdout;
            timeout(duration, async {
                stdin.write_all(job_bytes.as_bytes()).await?;
                stdin.flush().await?;
                let mut line = String::new();
                stdout.read_line(&mut line).await?;
                std::io::Result::Ok(line)
            })
            .await
        };

        match ipc_result {
            Ok(Ok(line)) if !line.trim().is_empty() => {
                // Happy path: parse and return the result JSON.
                serde_json::from_str::<Value>(line.trim()).map_err(|_| ViolationKind::Cpu)
            }
            _ => {
                // Timeout or IO error — kill, reap, record, respawn.
                self.kill_worker();
                self.reap_worker().await;
                self.record_violation(ViolationKind::Time, job);
                // Best-effort respawn; ignore failure (caller gets Err).
                let _ = self.spawn_worker();
                Err(ViolationKind::Time)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_supervisor_new() {
        let bounds = Bounds::new(50, 100);
        let secret: [u8; 32] = [0u8; 32];
        let signing_key = SigningKey::from_bytes(&secret);
        let sup = Supervisor::new(bounds, signing_key, "/tmp/test.jsonl".to_string());
        assert!(sup.worker.is_none(), "worker must not be spawned at construction");
    }

    /// Full supervisor round-trip test.
    ///
    /// Requires the test binary to handle `--worker`. Skip in unit-test context with
    /// `#[ignore]`; run via an integration test harness that embeds the worker entry point.
    #[tokio::test]
    #[ignore]
    async fn test_execute_success() {
        let bounds = Bounds::new(80, 500);
        let secret: [u8; 32] = rand::random();
        let signing_key = SigningKey::from_bytes(&secret);
        let mut sup =
            Supervisor::new(bounds, signing_key, "/tmp/igris_sup_test.jsonl".to_string());
        let result = sup.execute(serde_json::json!({"ping": 1})).await;
        assert!(result.is_ok(), "expected Ok result from worker, got {:?}", result);
    }

    /// Timeout violation test — also requires a real worker binary; skipped in unit tests.
    #[tokio::test]
    #[ignore]
    async fn test_execute_timeout_violation() {
        let bounds = Bounds::new(80, 50); // 50 ms — worker must exceed this
        let secret: [u8; 32] = rand::random();
        let signing_key = SigningKey::from_bytes(&secret);
        let log = "/tmp/igris_sup_timeout_test.jsonl".to_string();
        let _ = std::fs::remove_file(&log);
        let mut sup = Supervisor::new(bounds, signing_key, log.clone());
        let result = sup.execute(serde_json::json!({"slow": true})).await;
        assert!(
            matches!(result, Err(ViolationKind::Time)),
            "expected Time violation"
        );
        assert!(std::fs::metadata(&log).is_ok(), "violation log must exist");
        let _ = std::fs::remove_file(&log);
    }
}
