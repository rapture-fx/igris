// Async ETL Runner - Queue-driven worker for data processing
// Uses tokio for async runtime and NATS for message queue (optional fallback to in-memory)

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// ETL Job definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ETLJob {
    pub job_id: String,
    pub dataset_id: String,
    pub source_format: String,
    pub target_format: String,
    pub source_path: String,
    pub target_path: String,
    pub created_at: u64,
    pub status: JobStatus,
    pub retry_count: u32,
    pub max_retries: u32,
}

/// Job status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Retrying,
}

impl JobStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            JobStatus::Pending => "pending",
            JobStatus::Running => "running",
            JobStatus::Completed => "completed",
            JobStatus::Failed => "failed",
            JobStatus::Retrying => "retrying",
        }
    }
}

/// ETL Job Result
#[derive(Debug, Serialize, Deserialize)]
pub struct ETLJobResult {
    pub job_id: String,
    pub status: JobStatus,
    pub records_processed: u64,
    pub duration_ms: u64,
    pub error_message: Option<String>,
}

/// In-memory job queue (fallback when NATS is not available)
pub struct InMemoryQueue {
    jobs: Arc<tokio::sync::Mutex<Vec<ETLJob>>>,
}

impl InMemoryQueue {
    pub fn new() -> Self {
        InMemoryQueue {
            jobs: Arc::new(tokio::sync::Mutex::new(Vec::new())),
        }
    }

    pub async fn enqueue(&self, job: ETLJob) -> Result<(), String> {
        let mut jobs = self.jobs.lock().await;
        jobs.push(job);
        Ok(())
    }

    pub async fn dequeue(&self) -> Result<Option<ETLJob>, String> {
        let mut jobs = self.jobs.lock().await;
        Ok(jobs.pop())
    }

    pub async fn size(&self) -> usize {
        let jobs = self.jobs.lock().await;
        jobs.len()
    }
}

/// ETL Runner configuration
#[derive(Debug, Clone)]
pub struct ETLRunnerConfig {
    pub worker_count: usize,
    pub poll_interval_ms: u64,
    pub max_retries: u32,
    pub batch_size: usize,
}

impl Default for ETLRunnerConfig {
    fn default() -> Self {
        ETLRunnerConfig {
            worker_count: 4,
            poll_interval_ms: 1000,
            max_retries: 3,
            batch_size: 100,
        }
    }
}

/// Async ETL Runner
pub struct ETLRunner {
    config: ETLRunnerConfig,
    queue: Arc<InMemoryQueue>,
    running: Arc<tokio::sync::RwLock<bool>>,
}

impl ETLRunner {
    /// Create a new ETL runner
    pub fn new(config: ETLRunnerConfig) -> Self {
        ETLRunner {
            config,
            queue: Arc::new(InMemoryQueue::new()),
            running: Arc::new(tokio::sync::RwLock::new(false)),
        }
    }

    /// Submit a job to the queue
    pub async fn submit_job(&self, job: ETLJob) -> Result<String, String> {
        self.queue.enqueue(job.clone()).await?;
        Ok(job.job_id)
    }

    /// Start the ETL runner workers
    pub async fn start(&self) -> Result<(), String> {
        let mut running = self.running.write().await;
        if *running {
            return Err("ETL Runner already running".to_string());
        }
        *running = true;
        drop(running);

        // Spawn worker tasks
        for worker_id in 0..self.config.worker_count {
            let queue = Arc::clone(&self.queue);
            let running = Arc::clone(&self.running);
            let poll_interval = self.config.poll_interval_ms;
            let max_retries = self.config.max_retries;

            tokio::spawn(async move {
                Self::worker_loop(worker_id, queue, running, poll_interval, max_retries).await;
            });
        }

        Ok(())
    }

    /// Stop the ETL runner
    pub async fn stop(&self) {
        let mut running = self.running.write().await;
        *running = false;
    }

    /// Get queue size
    pub async fn queue_size(&self) -> usize {
        self.queue.size().await
    }

    /// Worker loop
    async fn worker_loop(
        worker_id: usize,
        queue: Arc<InMemoryQueue>,
        running: Arc<tokio::sync::RwLock<bool>>,
        poll_interval_ms: u64,
        max_retries: u32,
    ) {
        println!("[ETL Worker {}] Started", worker_id);

        loop {
            // Check if runner is still running
            {
                let is_running = running.read().await;
                if !*is_running {
                    println!("[ETL Worker {}] Stopped", worker_id);
                    break;
                }
            }

            // Try to dequeue a job
            match queue.dequeue().await {
                Ok(Some(mut job)) => {
                    println!("[ETL Worker {}] Processing job: {}", worker_id, job.job_id);

                    let result = Self::process_job(&mut job, max_retries).await;

                    match result.status {
                        JobStatus::Completed => {
                            println!(
                                "[ETL Worker {}] Job {} completed: {} records in {}ms",
                                worker_id, job.job_id, result.records_processed, result.duration_ms
                            );
                        }
                        JobStatus::Failed => {
                            println!(
                                "[ETL Worker {}] Job {} failed: {:?}",
                                worker_id, job.job_id, result.error_message
                            );
                        }
                        JobStatus::Retrying => {
                            println!(
                                "[ETL Worker {}] Job {} retrying (attempt {}/{})",
                                worker_id, job.job_id, job.retry_count, job.max_retries
                            );
                            // Re-queue the job
                            let _ = queue.enqueue(job).await;
                        }
                        _ => {}
                    }
                }
                Ok(None) => {
                    // No jobs available, sleep
                    tokio::time::sleep(Duration::from_millis(poll_interval_ms)).await;
                }
                Err(e) => {
                    eprintln!("[ETL Worker {}] Queue error: {}", worker_id, e);
                    tokio::time::sleep(Duration::from_millis(poll_interval_ms)).await;
                }
            }
        }
    }

    /// Process a single job
    async fn process_job(job: &mut ETLJob, max_retries: u32) -> ETLJobResult {
        let start_time = SystemTime::now();
        job.status = JobStatus::Running;

        // Simulate ETL processing (in production, call actual data normalizer)
        tokio::time::sleep(Duration::from_millis(100)).await;

        // Simulate success/failure (90% success rate for testing)
        let success = job.retry_count > 0 || rand::random::<f64>() < 0.9;

        let duration_ms = SystemTime::now()
            .duration_since(start_time)
            .unwrap()
            .as_millis() as u64;

        if success {
            job.status = JobStatus::Completed;
            ETLJobResult {
                job_id: job.job_id.clone(),
                status: JobStatus::Completed,
                records_processed: 100, // Simulated
                duration_ms,
                error_message: None,
            }
        } else if job.retry_count < max_retries {
            job.retry_count += 1;
            job.status = JobStatus::Retrying;
            ETLJobResult {
                job_id: job.job_id.clone(),
                status: JobStatus::Retrying,
                records_processed: 0,
                duration_ms,
                error_message: Some(format!("Processing failed, retrying ({}/{})", job.retry_count, max_retries)),
            }
        } else {
            job.status = JobStatus::Failed;
            ETLJobResult {
                job_id: job.job_id.clone(),
                status: JobStatus::Failed,
                records_processed: 0,
                duration_ms,
                error_message: Some("Max retries exceeded".to_string()),
            }
        }
    }
}

/// Helper to generate job ID
pub fn generate_job_id() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();

    format!("etl_{}", timestamp)
}

/// Helper module for random number generation (simple replacement for external dependency)
mod rand {
    use std::collections::hash_map::RandomState;
    use std::hash::{BuildHasher, Hash, Hasher};
    use std::time::SystemTime;

    pub fn random<T: From<f64>>() -> T {
        let state = RandomState::new();
        let mut hasher = state.build_hasher();
        SystemTime::now().hash(&mut hasher);
        let value = (hasher.finish() % 100) as f64 / 100.0;
        T::from(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_queue_operations() {
        let queue = InMemoryQueue::new();

        let job = ETLJob {
            job_id: "test_job_1".to_string(),
            dataset_id: "dataset_1".to_string(),
            source_format: "csv".to_string(),
            target_format: "parquet".to_string(),
            source_path: "/input/data.csv".to_string(),
            target_path: "/output/data.parquet".to_string(),
            created_at: 0,
            status: JobStatus::Pending,
            retry_count: 0,
            max_retries: 3,
        };

        // Enqueue
        queue.enqueue(job.clone()).await.unwrap();
        assert_eq!(queue.size().await, 1);

        // Dequeue
        let dequeued = queue.dequeue().await.unwrap().unwrap();
        assert_eq!(dequeued.job_id, "test_job_1");
        assert_eq!(queue.size().await, 0);
    }

    #[tokio::test]
    async fn test_etl_runner_lifecycle() {
        let config = ETLRunnerConfig {
            worker_count: 2,
            poll_interval_ms: 100,
            max_retries: 2,
            batch_size: 10,
        };

        let runner = ETLRunner::new(config);

        // Start runner
        runner.start().await.unwrap();

        // Submit jobs
        for i in 0..5 {
            let job = ETLJob {
                job_id: format!("job_{}", i),
                dataset_id: format!("dataset_{}", i),
                source_format: "json".to_string(),
                target_format: "parquet".to_string(),
                source_path: format!("/input/data_{}.json", i),
                target_path: format!("/output/data_{}.parquet", i),
                created_at: 0,
                status: JobStatus::Pending,
                retry_count: 0,
                max_retries: 3,
            };

            runner.submit_job(job).await.unwrap();
        }

        // Let workers process jobs
        tokio::time::sleep(Duration::from_secs(2)).await;

        // Stop runner
        runner.stop().await;

        // Queue should be empty or nearly empty
        let remaining = runner.queue_size().await;
        println!("Remaining jobs in queue: {}", remaining);
        assert!(remaining <= 2); // Some jobs might still be processing
    }

    #[test]
    fn test_job_status_conversion() {
        assert_eq!(JobStatus::Pending.as_str(), "pending");
        assert_eq!(JobStatus::Running.as_str(), "running");
        assert_eq!(JobStatus::Completed.as_str(), "completed");
        assert_eq!(JobStatus::Failed.as_str(), "failed");
    }
}
