package ml

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/schlep-engine/go-gateway/internal/observability"
)

// GPUDevice represents a single GPU device
type GPUDevice struct {
	ID              int
	Name            string
	MemoryTotalMB   int64
	MemoryUsedMB    int64
	Utilization     int64 // 0-100
	Temperature     int64 // Celsius
	Available       bool
	ActiveSessions  int32
	TotalInferences int64
	FailureCount    int64
	LastHealthCheck time.Time
	mu              sync.RWMutex
}

// MultiGPUScheduler manages workload distribution across multiple GPUs
type MultiGPUScheduler struct {
	devices        map[int]*GPUDevice
	devicesMutex   sync.RWMutex

	// Scheduling strategy
	strategy       SchedulingStrategy
	roundRobinIdx  int32

	// Load balancing
	enableLoadBalancing bool
	rebalanceInterval   time.Duration

	// Health monitoring
	healthCheckInterval time.Duration
	unhealthyThreshold  int

	// Stats
	totalScheduled int64
	rebalanceCount int64

	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// SchedulingStrategy defines how work is distributed
type SchedulingStrategy string

const (
	StrategyRoundRobin     SchedulingStrategy = "round-robin"
	StrategyLeastUtilized  SchedulingStrategy = "least-utilized"
	StrategyLeastMemory    SchedulingStrategy = "least-memory"
	StrategyWeightedRandom SchedulingStrategy = "weighted-random"
)

// MultiGPUConfig holds multi-GPU scheduler configuration
type MultiGPUConfig struct {
	DeviceIDs             []int
	Strategy              SchedulingStrategy
	EnableLoadBalancing   bool
	RebalanceInterval     time.Duration
	HealthCheckInterval   time.Duration
	UnhealthyThreshold    int
}

// DefaultMultiGPUConfig returns recommended defaults
var DefaultMultiGPUConfig = MultiGPUConfig{
	DeviceIDs:           []int{0},
	Strategy:            StrategyLeastUtilized,
	EnableLoadBalancing: true,
	RebalanceInterval:   30 * time.Second,
	HealthCheckInterval: 10 * time.Second,
	UnhealthyThreshold:  3,
}

// NewMultiGPUScheduler creates a new multi-GPU scheduler
func NewMultiGPUScheduler(config MultiGPUConfig) (*MultiGPUScheduler, error) {
	ctx, cancel := context.WithCancel(context.Background())

	scheduler := &MultiGPUScheduler{
		devices:             make(map[int]*GPUDevice),
		strategy:            config.Strategy,
		enableLoadBalancing: config.EnableLoadBalancing,
		rebalanceInterval:   config.RebalanceInterval,
		healthCheckInterval: config.HealthCheckInterval,
		unhealthyThreshold:  config.UnhealthyThreshold,
		ctx:                 ctx,
		cancel:              cancel,
	}

	// Initialize GPU devices
	for _, deviceID := range config.DeviceIDs {
		device := &GPUDevice{
			ID:              deviceID,
			Name:            fmt.Sprintf("GPU-%d", deviceID),
			Available:       true,
			LastHealthCheck: time.Now(),
		}

		// Query device info
		err := scheduler.queryDeviceInfo(device)
		if err != nil {
			log.Printf("[MultiGPU] Failed to query GPU %d: %v, marking unavailable", deviceID, err)
			device.Available = false
		}

		scheduler.devices[deviceID] = device
		log.Printf("[MultiGPU] Registered GPU %d: %s (Memory: %dMB, Available: %v)",
			deviceID, device.Name, device.MemoryTotalMB, device.Available)
	}

	// Start background monitoring
	scheduler.wg.Add(2)
	go scheduler.healthMonitor()
	go scheduler.loadBalancer()

	availableCount := scheduler.countAvailableDevices()
	log.Printf("[MultiGPU] Scheduler initialized (%d/%d GPUs available, strategy: %s)",
		availableCount, len(config.DeviceIDs), config.Strategy)

	return scheduler, nil
}

// SelectGPU selects the optimal GPU for the next inference
func (s *MultiGPUScheduler) SelectGPU() (int, error) {
	atomic.AddInt64(&s.totalScheduled, 1)

	switch s.strategy {
	case StrategyRoundRobin:
		return s.selectRoundRobin()
	case StrategyLeastUtilized:
		return s.selectLeastUtilized()
	case StrategyLeastMemory:
		return s.selectLeastMemory()
	case StrategyWeightedRandom:
		return s.selectWeightedRandom()
	default:
		return s.selectRoundRobin()
	}
}

// selectRoundRobin distributes work evenly across GPUs
func (s *MultiGPUScheduler) selectRoundRobin() (int, error) {
	s.devicesMutex.RLock()
	defer s.devicesMutex.RUnlock()

	availableDevices := s.getAvailableDevices()
	if len(availableDevices) == 0 {
		return -1, fmt.Errorf("no available GPUs")
	}

	// Increment round-robin index
	idx := int(atomic.AddInt32(&s.roundRobinIdx, 1)) % len(availableDevices)
	selectedDevice := availableDevices[idx]

	atomic.AddInt32(&selectedDevice.ActiveSessions, 1)
	observability.RecordGPUSelection(selectedDevice.ID, "round-robin")

	return selectedDevice.ID, nil
}

// selectLeastUtilized selects GPU with lowest utilization
func (s *MultiGPUScheduler) selectLeastUtilized() (int, error) {
	s.devicesMutex.RLock()
	defer s.devicesMutex.RUnlock()

	availableDevices := s.getAvailableDevices()
	if len(availableDevices) == 0 {
		return -1, fmt.Errorf("no available GPUs")
	}

	var bestDevice *GPUDevice
	minUtilization := int64(101)

	for _, device := range availableDevices {
		device.mu.RLock()
		util := atomic.LoadInt64(&device.Utilization)
		device.mu.RUnlock()

		if util < minUtilization {
			minUtilization = util
			bestDevice = device
		}
	}

	if bestDevice == nil {
		return availableDevices[0].ID, nil
	}

	atomic.AddInt32(&bestDevice.ActiveSessions, 1)
	observability.RecordGPUSelection(bestDevice.ID, "least-utilized")

	return bestDevice.ID, nil
}

// selectLeastMemory selects GPU with most available memory
func (s *MultiGPUScheduler) selectLeastMemory() (int, error) {
	s.devicesMutex.RLock()
	defer s.devicesMutex.RUnlock()

	availableDevices := s.getAvailableDevices()
	if len(availableDevices) == 0 {
		return -1, fmt.Errorf("no available GPUs")
	}

	var bestDevice *GPUDevice
	maxAvailable := int64(-1)

	for _, device := range availableDevices {
		device.mu.RLock()
		used := atomic.LoadInt64(&device.MemoryUsedMB)
		total := device.MemoryTotalMB
		device.mu.RUnlock()

		available := total - used
		if available > maxAvailable {
			maxAvailable = available
			bestDevice = device
		}
	}

	if bestDevice == nil {
		return availableDevices[0].ID, nil
	}

	atomic.AddInt32(&bestDevice.ActiveSessions, 1)
	observability.RecordGPUSelection(bestDevice.ID, "least-memory")

	return bestDevice.ID, nil
}

// selectWeightedRandom selects GPU with weighted random based on inverse utilization
func (s *MultiGPUScheduler) selectWeightedRandom() (int, error) {
	s.devicesMutex.RLock()
	defer s.devicesMutex.RUnlock()

	availableDevices := s.getAvailableDevices()
	if len(availableDevices) == 0 {
		return -1, fmt.Errorf("no available GPUs")
	}

	// Calculate weights (inverse utilization)
	weights := make([]float64, len(availableDevices))
	totalWeight := 0.0

	for i, device := range availableDevices {
		device.mu.RLock()
		util := atomic.LoadInt64(&device.Utilization)
		device.mu.RUnlock()

		// Weight is inverse of utilization (lower util = higher weight)
		weight := 100.0 - float64(util)
		if weight < 1.0 {
			weight = 1.0
		}
		weights[i] = weight
		totalWeight += weight
	}

	// Select random weighted
	r := float64(time.Now().UnixNano()%1000) / 1000.0 * totalWeight
	cumulative := 0.0
	selectedIdx := 0

	for i, weight := range weights {
		cumulative += weight
		if r <= cumulative {
			selectedIdx = i
			break
		}
	}

	selectedDevice := availableDevices[selectedIdx]
	atomic.AddInt32(&selectedDevice.ActiveSessions, 1)
	observability.RecordGPUSelection(selectedDevice.ID, "weighted-random")

	return selectedDevice.ID, nil
}

// ReleaseGPU marks a GPU session as complete
func (s *MultiGPUScheduler) ReleaseGPU(deviceID int) {
	s.devicesMutex.RLock()
	defer s.devicesMutex.RUnlock()

	if device, exists := s.devices[deviceID]; exists {
		atomic.AddInt32(&device.ActiveSessions, -1)
		atomic.AddInt64(&device.TotalInferences, 1)
	}
}

// UpdateGPUMetrics updates metrics for a specific GPU
func (s *MultiGPUScheduler) UpdateGPUMetrics(deviceID int, memoryUsedMB, utilization int64) {
	s.devicesMutex.RLock()
	defer s.devicesMutex.RUnlock()

	if device, exists := s.devices[deviceID]; exists {
		device.mu.Lock()
		atomic.StoreInt64(&device.MemoryUsedMB, memoryUsedMB)
		atomic.StoreInt64(&device.Utilization, utilization)
		device.mu.Unlock()

		observability.RecordGPUMetrics(deviceID, memoryUsedMB, utilization)
	}
}

// RecordGPUFailure records a failure for a GPU
func (s *MultiGPUScheduler) RecordGPUFailure(deviceID int) {
	s.devicesMutex.RLock()
	defer s.devicesMutex.RUnlock()

	if device, exists := s.devices[deviceID]; exists {
		failures := atomic.AddInt64(&device.FailureCount, 1)

		// Mark unavailable if exceeds threshold
		if failures >= int64(s.unhealthyThreshold) && device.Available {
			device.mu.Lock()
			device.Available = false
			device.mu.Unlock()

			log.Printf("[MultiGPU] GPU %d marked unavailable after %d failures", deviceID, failures)
			observability.RecordGPUUnavailable(deviceID)
		}
	}
}

// queryDeviceInfo queries GPU device information
func (s *MultiGPUScheduler) queryDeviceInfo(device *GPUDevice) error {
	// This would use nvidia-smi or CUDA runtime API
	// For now, simulate with reasonable defaults

	device.mu.Lock()
	defer device.mu.Unlock()

	// Simulated values - in production, query via:
	// - nvidia-smi --query-gpu=name,memory.total --format=csv
	// - CUDA Runtime API: cudaGetDeviceProperties()
	device.Name = fmt.Sprintf("NVIDIA Tesla V100 (GPU %d)", device.ID)
	device.MemoryTotalMB = 16384 // 16GB
	device.MemoryUsedMB = 0
	device.Utilization = 0
	device.Temperature = 45

	return nil
}

// healthMonitor performs periodic health checks on all GPUs
func (s *MultiGPUScheduler) healthMonitor() {
	defer s.wg.Done()

	ticker := time.NewTicker(s.healthCheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.performHealthChecks()
		case <-s.ctx.Done():
			return
		}
	}
}

// performHealthChecks checks health of all GPUs
func (s *MultiGPUScheduler) performHealthChecks() {
	s.devicesMutex.RLock()
	deviceList := make([]*GPUDevice, 0, len(s.devices))
	for _, device := range s.devices {
		deviceList = append(deviceList, device)
	}
	s.devicesMutex.RUnlock()

	for _, device := range deviceList {
		device.mu.Lock()
		device.LastHealthCheck = time.Now()

		// Simulate health check - in production, query GPU status
		// If device was unavailable and failures reset, re-enable
		failures := atomic.LoadInt64(&device.FailureCount)
		if !device.Available && failures < int64(s.unhealthyThreshold) {
			device.Available = true
			log.Printf("[MultiGPU] GPU %d recovered, marking available", device.ID)
			observability.RecordGPURecovery(device.ID)
		}

		device.mu.Unlock()
	}
}

// loadBalancer performs periodic load rebalancing
func (s *MultiGPUScheduler) loadBalancer() {
	defer s.wg.Done()

	if !s.enableLoadBalancing {
		return
	}

	ticker := time.NewTicker(s.rebalanceInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.rebalanceLoad()
		case <-s.ctx.Done():
			return
		}
	}
}

// rebalanceLoad checks for load imbalance and logs recommendations
func (s *MultiGPUScheduler) rebalanceLoad() {
	s.devicesMutex.RLock()
	defer s.devicesMutex.RUnlock()

	availableDevices := s.getAvailableDevices()
	if len(availableDevices) < 2 {
		return // Nothing to balance
	}

	// Calculate average utilization
	totalUtil := int64(0)
	for _, device := range availableDevices {
		util := atomic.LoadInt64(&device.Utilization)
		totalUtil += util
	}
	avgUtil := totalUtil / int64(len(availableDevices))

	// Check for imbalance
	imbalanced := false
	for _, device := range availableDevices {
		util := atomic.LoadInt64(&device.Utilization)
		diff := util - avgUtil
		if diff > 20 || diff < -20 { // 20% threshold
			imbalanced = true
			break
		}
	}

	if imbalanced {
		atomic.AddInt64(&s.rebalanceCount, 1)
		log.Printf("[MultiGPU] Load imbalance detected (avg: %d%%), consider rebalancing", avgUtil)
		observability.RecordLoadRebalance()
	}
}

// getAvailableDevices returns list of available GPUs (must hold read lock)
func (s *MultiGPUScheduler) getAvailableDevices() []*GPUDevice {
	available := make([]*GPUDevice, 0)
	for _, device := range s.devices {
		device.mu.RLock()
		isAvailable := device.Available
		device.mu.RUnlock()

		if isAvailable {
			available = append(available, device)
		}
	}
	return available
}

// countAvailableDevices returns count of available GPUs
func (s *MultiGPUScheduler) countAvailableDevices() int {
	s.devicesMutex.RLock()
	defer s.devicesMutex.RUnlock()
	return len(s.getAvailableDevices())
}

// GetDeviceStats returns statistics for a specific GPU
func (s *MultiGPUScheduler) GetDeviceStats(deviceID int) *GPUDeviceStats {
	s.devicesMutex.RLock()
	defer s.devicesMutex.RUnlock()

	device, exists := s.devices[deviceID]
	if !exists {
		return nil
	}

	device.mu.RLock()
	defer device.mu.RUnlock()

	return &GPUDeviceStats{
		DeviceID:        device.ID,
		Name:            device.Name,
		Available:       device.Available,
		MemoryTotalMB:   device.MemoryTotalMB,
		MemoryUsedMB:    atomic.LoadInt64(&device.MemoryUsedMB),
		Utilization:     atomic.LoadInt64(&device.Utilization),
		Temperature:     atomic.LoadInt64(&device.Temperature),
		ActiveSessions:  atomic.LoadInt32(&device.ActiveSessions),
		TotalInferences: atomic.LoadInt64(&device.TotalInferences),
		FailureCount:    atomic.LoadInt64(&device.FailureCount),
		LastHealthCheck: device.LastHealthCheck,
	}
}

// GetAllDeviceStats returns stats for all GPUs
func (s *MultiGPUScheduler) GetAllDeviceStats() []*GPUDeviceStats {
	s.devicesMutex.RLock()
	deviceIDs := make([]int, 0, len(s.devices))
	for id := range s.devices {
		deviceIDs = append(deviceIDs, id)
	}
	s.devicesMutex.RUnlock()

	stats := make([]*GPUDeviceStats, 0, len(deviceIDs))
	for _, id := range deviceIDs {
		if stat := s.GetDeviceStats(id); stat != nil {
			stats = append(stats, stat)
		}
	}

	return stats
}

// GetSchedulerStats returns overall scheduler statistics
func (s *MultiGPUScheduler) GetSchedulerStats() map[string]interface{} {
	return map[string]interface{}{
		"total_devices":       len(s.devices),
		"available_devices":   s.countAvailableDevices(),
		"strategy":            string(s.strategy),
		"total_scheduled":     atomic.LoadInt64(&s.totalScheduled),
		"rebalance_count":     atomic.LoadInt64(&s.rebalanceCount),
		"load_balancing":      s.enableLoadBalancing,
	}
}

// Shutdown gracefully shuts down the scheduler
func (s *MultiGPUScheduler) Shutdown() {
	log.Printf("[MultiGPU] Shutting down...")
	s.cancel()
	s.wg.Wait()
	log.Printf("[MultiGPU] Shutdown complete")
}

// GPUDeviceStats contains statistics for a GPU device
type GPUDeviceStats struct {
	DeviceID        int
	Name            string
	Available       bool
	MemoryTotalMB   int64
	MemoryUsedMB    int64
	Utilization     int64
	Temperature     int64
	ActiveSessions  int32
	TotalInferences int64
	FailureCount    int64
	LastHealthCheck time.Time
}

// String returns a string representation of GPU stats
func (s *GPUDeviceStats) String() string {
	return fmt.Sprintf(
		"GPU[%d] %s: Util=%d%%, Mem=%dMB/%dMB, Temp=%d°C, Sessions=%d, Inferences=%d, Available=%v",
		s.DeviceID,
		s.Name,
		s.Utilization,
		s.MemoryUsedMB,
		s.MemoryTotalMB,
		s.Temperature,
		s.ActiveSessions,
		s.TotalInferences,
		s.Available,
	)
}
