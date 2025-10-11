package scheduler

import (
	"context"
	"testing"
	"time"
)

func TestScheduler_Lifecycle(t *testing.T) {
	executor := func(ctx context.Context, task *ScheduledTask) (*TaskResult, error) {
		return &TaskResult{Success: true, Metrics: make(map[string]float64)}, nil
	}
	autoscaler := func(ctx context.Context, action ActionType, resource string, params map[string]any) error {
		return nil
	}

	config := DefaultSchedulerConfig()
	config.TickInterval = 100 * time.Millisecond

	scheduler := NewScheduler(config, executor, autoscaler)

	if err := scheduler.Start(); err != nil {
		t.Fatalf("Failed to start scheduler: %v", err)
	}

	// Should fail to start again
	if err := scheduler.Start(); err == nil {
		t.Errorf("Expected error starting already running scheduler")
	}

	if err := scheduler.Stop(); err != nil {
		t.Fatalf("Failed to stop scheduler: %v", err)
	}
}

func TestScheduler_ScheduleAndExecuteTask(t *testing.T) {
	executed := false
	executor := func(ctx context.Context, task *ScheduledTask) (*TaskResult, error) {
		executed = true
		return &TaskResult{Success: true, Metrics: map[string]float64{"duration_ms": 50}}, nil
	}
	autoscaler := func(ctx context.Context, action ActionType, resource string, params map[string]any) error {
		return nil
	}

	config := DefaultSchedulerConfig()
	config.TickInterval = 50 * time.Millisecond
	scheduler := NewScheduler(config, executor, autoscaler)

	task := &ScheduledTask{
		ActionType:     ActionRecovery,
		ScheduledAt:    time.Now(),
		PolicyID:       "policy-123",
		TargetResource: "node-42",
		Parameters:     map[string]any{"action": "restart"},
	}

	if err := scheduler.ScheduleTask(task); err != nil {
		t.Fatalf("Failed to schedule task: %v", err)
	}

	if err := scheduler.Start(); err != nil {
		t.Fatalf("Failed to start scheduler: %v", err)
	}
	defer scheduler.Stop()

	// Wait for execution
	time.Sleep(200 * time.Millisecond)

	if !executed {
		t.Errorf("Task was not executed")
	}

	retrievedTask, err := scheduler.GetTask(task.ID)
	if err != nil {
		t.Fatalf("Failed to get task: %v", err)
	}

	if retrievedTask.Status != StatusCompleted {
		t.Errorf("Expected status %s, got %s", StatusCompleted, retrievedTask.Status)
	}

	if retrievedTask.Result == nil || !retrievedTask.Result.Success {
		t.Errorf("Task result not successful")
	}
}

func TestScheduler_RateLimit(t *testing.T) {
	executionCount := 0
	executor := func(ctx context.Context, task *ScheduledTask) (*TaskResult, error) {
		executionCount++
		return &TaskResult{Success: true, Metrics: make(map[string]float64)}, nil
	}
	autoscaler := func(ctx context.Context, action ActionType, resource string, params map[string]any) error {
		return nil
	}

	config := DefaultSchedulerConfig()
	config.RateLimitPerHour = 3
	config.TickInterval = 50 * time.Millisecond
	scheduler := NewScheduler(config, executor, autoscaler)

	// Schedule 5 tasks immediately
	for i := 0; i < 5; i++ {
		task := &ScheduledTask{
			ActionType:     ActionScaleUp,
			ScheduledAt:    time.Now(),
			PolicyID:       "policy-123",
			TargetResource: "cluster-1",
		}
		scheduler.ScheduleTask(task)
	}

	scheduler.Start()
	defer scheduler.Stop()

	time.Sleep(300 * time.Millisecond)

	if executionCount > 3 {
		t.Errorf("Rate limit violated: executed %d tasks, limit is 3", executionCount)
	}
}

func TestScheduler_Cooldown(t *testing.T) {
	executionCount := 0
	executor := func(ctx context.Context, task *ScheduledTask) (*TaskResult, error) {
		executionCount++
		return &TaskResult{Success: true, Metrics: make(map[string]float64)}, nil
	}
	autoscaler := func(ctx context.Context, action ActionType, resource string, params map[string]any) error {
		return nil
	}

	config := DefaultSchedulerConfig()
	config.CooldownWindows = []CooldownWindow{
		{ActionType: ActionScaleUp, Duration: 200 * time.Millisecond},
	}
	config.TickInterval = 50 * time.Millisecond
	scheduler := NewScheduler(config, executor, autoscaler)

	task1 := &ScheduledTask{
		ActionType:     ActionScaleUp,
		ScheduledAt:    time.Now(),
		PolicyID:       "policy-123",
		TargetResource: "cluster-1",
	}
	task2 := &ScheduledTask{
		ActionType:     ActionScaleUp,
		ScheduledAt:    time.Now().Add(50 * time.Millisecond),
		PolicyID:       "policy-123",
		TargetResource: "cluster-1",
	}

	scheduler.ScheduleTask(task1)
	scheduler.ScheduleTask(task2)

	scheduler.Start()
	defer scheduler.Stop()

	time.Sleep(150 * time.Millisecond)

	if executionCount != 1 {
		t.Errorf("Expected 1 execution due to cooldown, got %d", executionCount)
	}

	time.Sleep(200 * time.Millisecond)

	if executionCount != 2 {
		t.Errorf("Expected 2 executions after cooldown, got %d", executionCount)
	}
}

func TestScheduler_BackoffRetry(t *testing.T) {
	attempts := 0
	executor := func(ctx context.Context, task *ScheduledTask) (*TaskResult, error) {
		attempts++
		if attempts < 3 {
			return &TaskResult{Success: false, ErrorMessage: "temporary failure"}, nil
		}
		return &TaskResult{Success: true, Metrics: make(map[string]float64)}, nil
	}
	autoscaler := func(ctx context.Context, action ActionType, resource string, params map[string]any) error {
		return nil
	}

	config := DefaultSchedulerConfig()
	config.BackoffPolicy.InitialDelay = 50 * time.Millisecond
	config.BackoffPolicy.Multiplier = 1.5
	config.TickInterval = 20 * time.Millisecond
	scheduler := NewScheduler(config, executor, autoscaler)

	task := &ScheduledTask{
		ActionType:     ActionRecovery,
		ScheduledAt:    time.Now(),
		PolicyID:       "policy-123",
		TargetResource: "node-1",
	}

	scheduler.ScheduleTask(task)
	scheduler.Start()
	defer scheduler.Stop()

	time.Sleep(400 * time.Millisecond)

	retrievedTask, _ := scheduler.GetTask(task.ID)
	if retrievedTask.Status != StatusCompleted {
		t.Errorf("Expected task to succeed after retries, got status: %s", retrievedTask.Status)
	}

	if attempts != 3 {
		t.Errorf("Expected 3 attempts, got %d", attempts)
	}
}

func TestScheduler_CancelTask(t *testing.T) {
	executor := func(ctx context.Context, task *ScheduledTask) (*TaskResult, error) {
		time.Sleep(100 * time.Millisecond)
		return &TaskResult{Success: true, Metrics: make(map[string]float64)}, nil
	}
	autoscaler := func(ctx context.Context, action ActionType, resource string, params map[string]any) error {
		return nil
	}

	scheduler := NewScheduler(DefaultSchedulerConfig(), executor, autoscaler)

	task := &ScheduledTask{
		ActionType:     ActionMaintenance,
		ScheduledAt:    time.Now().Add(5 * time.Second),
		PolicyID:       "policy-123",
		TargetResource: "cluster-1",
	}

	scheduler.ScheduleTask(task)

	if err := scheduler.CancelTask(task.ID); err != nil {
		t.Fatalf("Failed to cancel task: %v", err)
	}

	retrievedTask, _ := scheduler.GetTask(task.ID)
	if retrievedTask.Status != StatusCanceled {
		t.Errorf("Expected status %s, got %s", StatusCanceled, retrievedTask.Status)
	}
}

func TestScheduler_ListTasks(t *testing.T) {
	executor := func(ctx context.Context, task *ScheduledTask) (*TaskResult, error) {
		return &TaskResult{Success: true, Metrics: make(map[string]float64)}, nil
	}
	autoscaler := func(ctx context.Context, action ActionType, resource string, params map[string]any) error {
		return nil
	}

	scheduler := NewScheduler(DefaultSchedulerConfig(), executor, autoscaler)

	for i := 0; i < 5; i++ {
		task := &ScheduledTask{
			ActionType:     ActionRecovery,
			ScheduledAt:    time.Now(),
			PolicyID:       "policy-123",
			TargetResource: "node-1",
		}
		scheduler.ScheduleTask(task)
	}

	allTasks := scheduler.ListTasks(nil)
	if len(allTasks) != 5 {
		t.Errorf("Expected 5 tasks, got %d", len(allTasks))
	}

	pendingStatus := StatusPending
	pendingTasks := scheduler.ListTasks(&pendingStatus)
	if len(pendingTasks) != 5 {
		t.Errorf("Expected 5 pending tasks, got %d", len(pendingTasks))
	}
}

func TestScheduler_GetMetrics(t *testing.T) {
	executor := func(ctx context.Context, task *ScheduledTask) (*TaskResult, error) {
		return &TaskResult{Success: true, Metrics: make(map[string]float64)}, nil
	}
	autoscaler := func(ctx context.Context, action ActionType, resource string, params map[string]any) error {
		return nil
	}

	scheduler := NewScheduler(DefaultSchedulerConfig(), executor, autoscaler)

	task := &ScheduledTask{
		ActionType:     ActionScaleUp,
		ScheduledAt:    time.Now(),
		PolicyID:       "policy-123",
		TargetResource: "cluster-1",
	}
	scheduler.ScheduleTask(task)

	metrics := scheduler.GetMetrics()
	if metrics["total_tasks"].(int) != 1 {
		t.Errorf("Expected 1 total task, got %v", metrics["total_tasks"])
	}

	if metrics["running"].(bool) != false {
		t.Errorf("Expected scheduler not running")
	}
}
