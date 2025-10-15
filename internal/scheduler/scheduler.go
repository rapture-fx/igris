// Package scheduler implements the Autonomic Scheduler for Phase 12
// Schedules recovery, scaling, maintenance windows, and coordinates with cluster autoscaler
package scheduler

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// ActionType represents scheduled autonomous action types
type ActionType string

const (
	ActionRecovery    ActionType = "recovery"
	ActionScaleUp     ActionType = "scale_up"
	ActionScaleDown   ActionType = "scale_down"
	ActionMaintenance ActionType = "maintenance"
	ActionOptimize    ActionType = "optimize"
)

// ScheduleStatus represents the execution status of a scheduled task
type ScheduleStatus string

const (
	StatusPending   ScheduleStatus = "pending"
	StatusRunning   ScheduleStatus = "running"
	StatusCompleted ScheduleStatus = "completed"
	StatusFailed    ScheduleStatus = "failed"
	StatusCanceled  ScheduleStatus = "canceled"
)

// ScheduledTask represents a scheduled autonomous action
type ScheduledTask struct {
	ID             string         `json:"id"`
	ActionType     ActionType     `json:"action_type"`
	ScheduledAt    time.Time      `json:"scheduled_at"`
	ExecutedAt     *time.Time     `json:"executed_at,omitempty"`
	Status         ScheduleStatus `json:"status"`
	PolicyID       string         `json:"policy_id"`
	TargetResource string         `json:"target_resource"`
	Parameters     map[string]any `json:"parameters"`
	CooldownUntil  *time.Time     `json:"cooldown_until,omitempty"`
	BackoffCount   int            `json:"backoff_count"`
	Result         *TaskResult    `json:"result,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

// TaskResult captures execution outcome
type TaskResult struct {
	Success      bool              `json:"success"`
	ErrorMessage string            `json:"error_message,omitempty"`
	Metrics      map[string]float64 `json:"metrics"`
	AuditID      string            `json:"audit_id"`
}

// BackoffPolicy defines retry backoff behavior
type BackoffPolicy struct {
	InitialDelay time.Duration `json:"initial_delay"`
	MaxDelay     time.Duration `json:"max_delay"`
	Multiplier   float64       `json:"multiplier"`
	MaxRetries   int           `json:"max_retries"`
}

// CooldownWindow defines minimum time between repeated actions
type CooldownWindow struct {
	ActionType ActionType    `json:"action_type"`
	Duration   time.Duration `json:"duration"`
}

// SchedulerConfig configures the autonomous scheduler
type SchedulerConfig struct {
	TickInterval      time.Duration    `json:"tick_interval"`
	MaxConcurrent     int              `json:"max_concurrent"`
	BackoffPolicy     BackoffPolicy    `json:"backoff_policy"`
	CooldownWindows   []CooldownWindow `json:"cooldown_windows"`
	EnableAutoscaler  bool             `json:"enable_autoscaler"`
	RateLimitPerHour  int              `json:"rate_limit_per_hour"`
}

// DefaultSchedulerConfig returns production-ready defaults
func DefaultSchedulerConfig() SchedulerConfig {
	return SchedulerConfig{
		TickInterval:  5 * time.Second,
		MaxConcurrent: 3,
		BackoffPolicy: BackoffPolicy{
			InitialDelay: 30 * time.Second,
			MaxDelay:     10 * time.Minute,
			Multiplier:   2.0,
			MaxRetries:   5,
		},
		CooldownWindows: []CooldownWindow{
			{ActionType: ActionScaleUp, Duration: 10 * time.Minute},
			{ActionType: ActionScaleDown, Duration: 15 * time.Minute},
			{ActionType: ActionRecovery, Duration: 5 * time.Minute},
			{ActionType: ActionMaintenance, Duration: 30 * time.Minute},
			{ActionType: ActionOptimize, Duration: 20 * time.Minute},
		},
		EnableAutoscaler: true,
		RateLimitPerHour: 10,
	}
}

// Scheduler coordinates autonomous actions with policy-driven scheduling
type Scheduler struct {
	config          SchedulerConfig
	tasks           map[string]*ScheduledTask
	tasksMu         sync.RWMutex
	running         bool
	runningMu       sync.RWMutex
	executorFunc    TaskExecutor
	autoscalerFunc  AutoscalerIntegration
	actionHistory   []ActionHistoryEntry
	historyMu       sync.RWMutex
	ctx             context.Context
	cancel          context.CancelFunc
}

// TaskExecutor executes a scheduled task
type TaskExecutor func(ctx context.Context, task *ScheduledTask) (*TaskResult, error)

// AutoscalerIntegration integrates with K8s HPA/VPA
type AutoscalerIntegration func(ctx context.Context, action ActionType, resource string, params map[string]any) error

// ActionHistoryEntry tracks action execution for rate limiting
type ActionHistoryEntry struct {
	Timestamp  time.Time  `json:"timestamp"`
	ActionType ActionType `json:"action_type"`
	TaskID     string     `json:"task_id"`
}

// NewScheduler creates a new autonomous scheduler
func NewScheduler(config SchedulerConfig, executor TaskExecutor, autoscaler AutoscalerIntegration) *Scheduler {
	ctx, cancel := context.WithCancel(context.Background())
	return &Scheduler{
		config:         config,
		tasks:          make(map[string]*ScheduledTask),
		executorFunc:   executor,
		autoscalerFunc: autoscaler,
		actionHistory:  make([]ActionHistoryEntry, 0, 1000),
		ctx:            ctx,
		cancel:         cancel,
	}
}

// Start begins the scheduler tick loop
func (s *Scheduler) Start() error {
	s.runningMu.Lock()
	if s.running {
		s.runningMu.Unlock()
		return fmt.Errorf("scheduler already running")
	}
	s.running = true
	s.runningMu.Unlock()

	go s.schedulerLoop()
	return nil
}

// Stop gracefully stops the scheduler
func (s *Scheduler) Stop() error {
	s.runningMu.Lock()
	defer s.runningMu.Unlock()

	if !s.running {
		return fmt.Errorf("scheduler not running")
	}

	s.cancel()
	s.running = false
	return nil
}

// schedulerLoop is the main tick loop
func (s *Scheduler) schedulerLoop() {
	ticker := time.NewTicker(s.config.TickInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.processPendingTasks()
		}
	}
}

// processPendingTasks evaluates and executes eligible tasks
func (s *Scheduler) processPendingTasks() {
	s.tasksMu.Lock()
	eligible := make([]*ScheduledTask, 0)
	now := time.Now()

	for _, task := range s.tasks {
		if task.Status == StatusPending && task.ScheduledAt.Before(now) {
			if task.CooldownUntil == nil || task.CooldownUntil.Before(now) {
				if s.checkRateLimit(task.ActionType) {
					eligible = append(eligible, task)
				}
			}
		}
	}
	s.tasksMu.Unlock()

	// Execute up to MaxConcurrent tasks
	for i := 0; i < len(eligible) && i < s.config.MaxConcurrent; i++ {
		task := eligible[i]
		go s.executeTask(task)
	}
}

// checkRateLimit verifies hourly action rate limit
func (s *Scheduler) checkRateLimit(actionType ActionType) bool {
	s.historyMu.Lock()
	defer s.historyMu.Unlock()

	cutoff := time.Now().Add(-1 * time.Hour)
	count := 0

	// Clean old entries and count recent actions
	filtered := make([]ActionHistoryEntry, 0)
	for _, entry := range s.actionHistory {
		if entry.Timestamp.After(cutoff) {
			filtered = append(filtered, entry)
			count++
		}
	}
	s.actionHistory = filtered

	return count < s.config.RateLimitPerHour
}

// executeTask runs a single scheduled task
func (s *Scheduler) executeTask(task *ScheduledTask) {
	s.updateTaskStatus(task.ID, StatusRunning)

	ctx, cancel := context.WithTimeout(s.ctx, 5*time.Minute)
	defer cancel()

	result, err := s.executorFunc(ctx, task)
	now := time.Now()

	s.tasksMu.Lock()
	task.ExecutedAt = &now
	task.UpdatedAt = now

	if err != nil || (result != nil && !result.Success) {
		task.Status = StatusFailed
		task.BackoffCount++

		// Calculate backoff cooldown
		if task.BackoffCount <= s.config.BackoffPolicy.MaxRetries {
			backoffDelay := time.Duration(float64(s.config.BackoffPolicy.InitialDelay) *
				float64(task.BackoffCount) * s.config.BackoffPolicy.Multiplier)
			if backoffDelay > s.config.BackoffPolicy.MaxDelay {
				backoffDelay = s.config.BackoffPolicy.MaxDelay
			}
			cooldownUntil := now.Add(backoffDelay)
			task.CooldownUntil = &cooldownUntil
			task.Status = StatusPending // Retry
		}

		if result == nil {
			result = &TaskResult{
				Success:      false,
				ErrorMessage: err.Error(),
				Metrics:      make(map[string]float64),
			}
		}
	} else {
		task.Status = StatusCompleted

		// Apply action-specific cooldown
		for _, cw := range s.config.CooldownWindows {
			if cw.ActionType == task.ActionType {
				cooldownUntil := now.Add(cw.Duration)
				task.CooldownUntil = &cooldownUntil
				break
			}
		}
	}

	task.Result = result
	s.tasksMu.Unlock()

	// Record in action history
	s.historyMu.Lock()
	s.actionHistory = append(s.actionHistory, ActionHistoryEntry{
		Timestamp:  now,
		ActionType: task.ActionType,
		TaskID:     task.ID,
	})
	s.historyMu.Unlock()

	// Notify autoscaler if enabled
	if s.config.EnableAutoscaler && result.Success {
		if task.ActionType == ActionScaleUp || task.ActionType == ActionScaleDown {
			_ = s.autoscalerFunc(ctx, task.ActionType, task.TargetResource, task.Parameters)
		}
	}
}

// ScheduleTask adds a new task to the schedule
func (s *Scheduler) ScheduleTask(task *ScheduledTask) error {
	if task.ID == "" {
		task.ID = fmt.Sprintf("task-%d", time.Now().UnixNano())
	}

	now := time.Now()
	task.CreatedAt = now
	task.UpdatedAt = now
	task.Status = StatusPending

	s.tasksMu.Lock()
	s.tasks[task.ID] = task
	s.tasksMu.Unlock()

	return nil
}

// GetTask retrieves a task by ID
func (s *Scheduler) GetTask(taskID string) (*ScheduledTask, error) {
	s.tasksMu.RLock()
	defer s.tasksMu.RUnlock()

	task, exists := s.tasks[taskID]
	if !exists {
		return nil, fmt.Errorf("task not found: %s", taskID)
	}
	return task, nil
}

// ListTasks returns all tasks matching optional status filter
func (s *Scheduler) ListTasks(statusFilter *ScheduleStatus) []*ScheduledTask {
	s.tasksMu.RLock()
	defer s.tasksMu.RUnlock()

	result := make([]*ScheduledTask, 0, len(s.tasks))
	for _, task := range s.tasks {
		if statusFilter == nil || task.Status == *statusFilter {
			result = append(result, task)
		}
	}
	return result
}

// CancelTask cancels a pending or running task
func (s *Scheduler) CancelTask(taskID string) error {
	s.tasksMu.Lock()
	defer s.tasksMu.Unlock()

	task, exists := s.tasks[taskID]
	if !exists {
		return fmt.Errorf("task not found: %s", taskID)
	}

	if task.Status == StatusCompleted || task.Status == StatusFailed {
		return fmt.Errorf("cannot cancel task in status: %s", task.Status)
	}

	task.Status = StatusCanceled
	task.UpdatedAt = time.Now()
	return nil
}

// updateTaskStatus updates task status atomically
func (s *Scheduler) updateTaskStatus(taskID string, status ScheduleStatus) {
	s.tasksMu.Lock()
	defer s.tasksMu.Unlock()

	if task, exists := s.tasks[taskID]; exists {
		task.Status = status
		task.UpdatedAt = time.Now()
	}
}

// GetMetrics returns current scheduler metrics
func (s *Scheduler) GetMetrics() map[string]any {
	s.tasksMu.RLock()
	defer s.tasksMu.RUnlock()

	statusCounts := make(map[ScheduleStatus]int)
	actionCounts := make(map[ActionType]int)

	for _, task := range s.tasks {
		statusCounts[task.Status]++
		actionCounts[task.ActionType]++
	}

	s.historyMu.RLock()
	actionsLastHour := len(s.actionHistory)
	s.historyMu.RUnlock()

	return map[string]any{
		"total_tasks":       len(s.tasks),
		"status_counts":     statusCounts,
		"action_counts":     actionCounts,
		"actions_last_hour": actionsLastHour,
		"rate_limit":        s.config.RateLimitPerHour,
		"running":           s.running,
	}
}

// ExportTasks serializes all tasks to JSON
func (s *Scheduler) ExportTasks() ([]byte, error) {
	s.tasksMu.RLock()
	defer s.tasksMu.RUnlock()

	tasks := make([]*ScheduledTask, 0, len(s.tasks))
	for _, task := range s.tasks {
		tasks = append(tasks, task)
	}

	return json.Marshal(tasks)
}
