package ml

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Igris-inertial/system/igris-overture/observability"
)

// InferenceJob represents a single inference request
type InferenceJob struct {
	Ctx      context.Context
	Features []float64
	ModelID  string
	Result   chan *InferenceResult
}

// InferenceResult contains the prediction result or error
type InferenceResult struct {
	Response *PredictResponse
	Error    error
	Latency  time.Duration
}

// AdaptivePoolConfig holds configuration for the adaptive worker pool
type AdaptivePoolConfig struct {
	MinWorkers       int           // Minimum number of workers
	MaxWorkers       int           // Maximum number of workers
	ScaleUpThreshold int           // Queue depth to trigger scale up
	ScaleDownDelay   time.Duration // Time to wait before scaling down
	TargetLatency    time.Duration // Target latency for inference
	QueueSize        int           // Size of the job queue
}

// DefaultAdaptivePoolConfig returns recommended defaults
var DefaultAdaptivePoolConfig = AdaptivePoolConfig{
	MinWorkers:       5,
	MaxWorkers:       50,
	ScaleUpThreshold: 10,
	ScaleDownDelay:   30 * time.Second,
	TargetLatency:    40 * time.Millisecond,
	QueueSize:        1000,
}

// AdaptiveInferencePool manages a pool of workers that auto-scale based on load
type AdaptiveInferencePool struct {
	client *CircuitBreakerClient
	config AdaptivePoolConfig

	// Job queue
	jobs chan *InferenceJob

	// Worker management
	workers      int32 // Current number of workers (atomic)
	workersMutex sync.RWMutex
	stopWorkers  chan struct{}
	wg           sync.WaitGroup

	// Metrics
	totalJobs      int64 // Total jobs processed (atomic)
	droppedJobs    int64 // Jobs dropped due to full queue (atomic)
	latencySum     int64 // Sum of latencies in microseconds (atomic)
	latencyCount   int64 // Number of latency measurements (atomic)
	lastScaleDown  time.Time
	scaleDownMutex sync.Mutex

	// Control
	ctx    context.Context
	cancel context.CancelFunc
}

// NewAdaptiveInferencePool creates a new adaptive worker pool
func NewAdaptiveInferencePool(client *CircuitBreakerClient, config AdaptivePoolConfig) *AdaptiveInferencePool {
	ctx, cancel := context.WithCancel(context.Background())

	pool := &AdaptiveInferencePool{
		client:        client,
		config:        config,
		jobs:          make(chan *InferenceJob, config.QueueSize),
		stopWorkers:   make(chan struct{}),
		lastScaleDown: time.Now(),
		ctx:           ctx,
		cancel:        cancel,
	}

	// Start initial workers
	pool.scaleUp(config.MinWorkers)

	// Start monitoring goroutine
	go pool.monitor()

	log.Printf("[AdaptivePool] Initialized with %d workers (min: %d, max: %d)",
		config.MinWorkers, config.MinWorkers, config.MaxWorkers)

	return pool
}

// Submit submits a job to the pool for processing
func (p *AdaptiveInferencePool) Submit(ctx context.Context, features []float64, modelID string) (*InferenceResult, error) {
	job := &InferenceJob{
		Ctx:      ctx,
		Features: features,
		ModelID:  modelID,
		Result:   make(chan *InferenceResult, 1),
	}

	// Try to submit job to queue
	select {
	case p.jobs <- job:
		// Job queued successfully
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
		// Queue is full, drop the job
		atomic.AddInt64(&p.droppedJobs, 1)
		observability.RecordDroppedJob()
		return nil, ErrQueueFull
	}

	// Wait for result
	select {
	case result := <-job.Result:
		return result, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// worker processes jobs from the queue
func (p *AdaptiveInferencePool) worker(id int) {
	defer p.wg.Done()

	log.Printf("[AdaptivePool] Worker %d started", id)

	for {
		select {
		case job := <-p.jobs:
			p.processJob(job)
		case <-p.stopWorkers:
			log.Printf("[AdaptivePool] Worker %d stopping", id)
			return
		case <-p.ctx.Done():
			return
		}
	}
}

// processJob executes a single inference job
func (p *AdaptiveInferencePool) processJob(job *InferenceJob) {
	start := time.Now()

	// Execute prediction through circuit breaker
	resp, err := p.client.Predict(job.Ctx, job.Features, job.ModelID)

	latency := time.Since(start)

	// Record metrics
	atomic.AddInt64(&p.totalJobs, 1)
	atomic.AddInt64(&p.latencySum, latency.Microseconds())
	atomic.AddInt64(&p.latencyCount, 1)

	// Send result
	result := &InferenceResult{
		Response: resp,
		Error:    err,
		Latency:  latency,
	}

	select {
	case job.Result <- result:
	default:
		// Client has disconnected or timed out
		log.Printf("[AdaptivePool] Job result dropped (client gone)")
	}
}

// monitor continuously monitors the pool and adjusts worker count
func (p *AdaptiveInferencePool) monitor() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			p.checkAndScale()
		case <-p.ctx.Done():
			return
		}
	}
}

// checkAndScale evaluates metrics and scales workers up or down
func (p *AdaptiveInferencePool) checkAndScale() {
	queueDepth := len(p.jobs)
	currentWorkers := int(atomic.LoadInt32(&p.workers))
	avgLatency := p.getAverageLatency()

	// Update Prometheus metrics
	observability.RecordInferenceQueueDepth(queueDepth)
	observability.RecordActiveWorkers(currentWorkers)
	if avgLatency > 0 {
		observability.RecordAverageInferenceLatency(avgLatency.Milliseconds())
	}

	// Scale up conditions:
	// 1. Queue depth exceeds threshold
	// 2. Average latency exceeds target
	// 3. Not already at max workers
	shouldScaleUp := (queueDepth > p.config.ScaleUpThreshold ||
		(avgLatency > p.config.TargetLatency && queueDepth > 0)) &&
		currentWorkers < p.config.MaxWorkers

	if shouldScaleUp {
		// Calculate how many workers to add (proportional to queue depth)
		newWorkers := min(queueDepth/5, 10) // Add up to 10 workers at a time
		if newWorkers < 1 {
			newWorkers = 1
		}

		maxNew := p.config.MaxWorkers - currentWorkers
		if newWorkers > maxNew {
			newWorkers = maxNew
		}

		if newWorkers > 0 {
			p.scaleUp(newWorkers)
			log.Printf("[AdaptivePool] Scaled UP: +%d workers (total: %d, queue: %d, latency: %v)",
				newWorkers, atomic.LoadInt32(&p.workers), queueDepth, avgLatency)
		}
		return
	}

	// Scale down conditions:
	// 1. Queue is empty or very small
	// 2. Average latency is well below target
	// 3. Enough time has passed since last scale down
	// 4. Not already at min workers
	p.scaleDownMutex.Lock()
	timeSinceLastScaleDown := time.Since(p.lastScaleDown)
	p.scaleDownMutex.Unlock()

	shouldScaleDown := queueDepth < 2 &&
		avgLatency < p.config.TargetLatency/2 &&
		timeSinceLastScaleDown > p.config.ScaleDownDelay &&
		currentWorkers > p.config.MinWorkers

	if shouldScaleDown {
		// Scale down gradually (remove 20% of excess workers)
		excess := currentWorkers - p.config.MinWorkers
		removeWorkers := max(1, excess/5)

		if removeWorkers > 0 {
			p.scaleDown(removeWorkers)
			log.Printf("[AdaptivePool] Scaled DOWN: -%d workers (total: %d, queue: %d, latency: %v)",
				removeWorkers, atomic.LoadInt32(&p.workers), queueDepth, avgLatency)

			p.scaleDownMutex.Lock()
			p.lastScaleDown = time.Now()
			p.scaleDownMutex.Unlock()
		}
	}
}

// scaleUp adds new workers to the pool
func (p *AdaptiveInferencePool) scaleUp(count int) {
	p.workersMutex.Lock()
	defer p.workersMutex.Unlock()

	currentWorkers := int(atomic.LoadInt32(&p.workers))

	for i := 0; i < count; i++ {
		p.wg.Add(1)
		go p.worker(currentWorkers + i + 1)
	}

	atomic.AddInt32(&p.workers, int32(count))
	observability.RecordWorkerScaling("up", count)
}

// scaleDown removes workers from the pool
func (p *AdaptiveInferencePool) scaleDown(count int) {
	p.workersMutex.Lock()
	defer p.workersMutex.Unlock()

	// Send stop signals
	for i := 0; i < count; i++ {
		select {
		case p.stopWorkers <- struct{}{}:
		default:
			// Channel full, stop trying
			break
		}
	}

	atomic.AddInt32(&p.workers, -int32(count))
	observability.RecordWorkerScaling("down", count)
}

// getAverageLatency calculates the moving average latency
func (p *AdaptiveInferencePool) getAverageLatency() time.Duration {
	count := atomic.LoadInt64(&p.latencyCount)
	if count == 0 {
		return 0
	}

	sum := atomic.LoadInt64(&p.latencySum)
	avgMicros := sum / count

	return time.Duration(avgMicros) * time.Microsecond
}

// GetStats returns current pool statistics
func (p *AdaptiveInferencePool) GetStats() PoolStats {
	return PoolStats{
		Workers:        int(atomic.LoadInt32(&p.workers)),
		QueueDepth:     len(p.jobs),
		TotalJobs:      atomic.LoadInt64(&p.totalJobs),
		DroppedJobs:    atomic.LoadInt64(&p.droppedJobs),
		AverageLatency: p.getAverageLatency(),
	}
}

// Shutdown gracefully stops the pool
func (p *AdaptiveInferencePool) Shutdown(timeout time.Duration) error {
	log.Printf("[AdaptivePool] Shutting down...")

	p.cancel()
	close(p.jobs)

	// Wait for workers to finish with timeout
	done := make(chan struct{})
	go func() {
		p.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		log.Printf("[AdaptivePool] Shutdown complete")
		return nil
	case <-time.After(timeout):
		log.Printf("[AdaptivePool] Shutdown timeout, some workers may not have finished")
		return ErrShutdownTimeout
	}
}

// PoolStats contains statistics about the pool
type PoolStats struct {
	Workers        int
	QueueDepth     int
	TotalJobs      int64
	DroppedJobs    int64
	AverageLatency time.Duration
}

// Errors
var (
	ErrQueueFull        = fmt.Errorf("inference queue is full")
	ErrShutdownTimeout  = fmt.Errorf("shutdown timeout exceeded")
)

// Helper functions
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
