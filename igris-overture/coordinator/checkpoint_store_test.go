package coordinator

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestTaskProofNeedsRefresh(t *testing.T) {
	t.Parallel()

	now := time.Unix(1_800_000_000, 0).UTC()

	tests := []struct {
		name     string
		proof    *TaskProofState
		expected bool
	}{
		{
			name:     "nil proof does not refresh",
			proof:    nil,
			expected: false,
		},
		{
			name: "missing checked_at refreshes immediately",
			proof: &TaskProofState{
				Status: "pending",
			},
			expected: true,
		},
		{
			name: "pending before interval stays fresh",
			proof: &TaskProofState{
				Status:    "pending",
				CheckedAt: ptrTime(now.Add(-20 * time.Second)),
			},
			expected: false,
		},
		{
			name: "pending after interval refreshes",
			proof: &TaskProofState{
				Status:    "pending",
				CheckedAt: ptrTime(now.Add(-31 * time.Second)),
			},
			expected: true,
		},
		{
			name: "missing before interval stays fresh",
			proof: &TaskProofState{
				Status:    "missing",
				CheckedAt: ptrTime(now.Add(-90 * time.Second)),
			},
			expected: false,
		},
		{
			name: "missing after interval refreshes",
			proof: &TaskProofState{
				Status:    "missing",
				CheckedAt: ptrTime(now.Add(-3 * time.Minute)),
			},
			expected: true,
		},
		{
			name: "present before interval stays fresh",
			proof: &TaskProofState{
				Status:    "present",
				CheckedAt: ptrTime(now.Add(-5 * time.Minute)),
			},
			expected: false,
		},
		{
			name: "present after interval refreshes",
			proof: &TaskProofState{
				Status:    "present",
				CheckedAt: ptrTime(now.Add(-11 * time.Minute)),
			},
			expected: true,
		},
		{
			name: "mismatch before interval stays fresh",
			proof: &TaskProofState{
				Status:    "mismatch",
				CheckedAt: ptrTime(now.Add(-4 * time.Minute)),
			},
			expected: false,
		},
		{
			name: "mismatch after interval refreshes",
			proof: &TaskProofState{
				Status:    "mismatch",
				CheckedAt: ptrTime(now.Add(-6 * time.Minute)),
			},
			expected: true,
		},
		{
			name: "verified before interval stays fresh",
			proof: &TaskProofState{
				Status:    "verified",
				CheckedAt: ptrTime(now.Add(-20 * time.Minute)),
			},
			expected: false,
		},
		{
			name: "verified after interval refreshes",
			proof: &TaskProofState{
				Status:    "verified",
				CheckedAt: ptrTime(now.Add(-31 * time.Minute)),
			},
			expected: true,
		},
		{
			name: "unknown status uses missing interval",
			proof: &TaskProofState{
				Status:    "custom",
				CheckedAt: ptrTime(now.Add(-3 * time.Minute)),
			},
			expected: true,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := TaskProofNeedsRefresh(test.proof, now); got != test.expected {
				t.Fatalf("TaskProofNeedsRefresh() = %v, want %v", got, test.expected)
			}
		})
	}
}

func TestBuildCumulativeRecoveryCheckpointAggregatesMultipleRows(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	checkpoints := []*CheckpointPayload{
		cumulativeCheckpointTestPayload(taskID, 1, "digest-1", []WalEntry{
			cumulativeCheckpointTestEntry(taskID, 0, "aaa0"),
			cumulativeCheckpointTestEntry(taskID, 1, "aaa1"),
		}),
		cumulativeCheckpointTestPayload(taskID, 3, "digest-3", []WalEntry{
			cumulativeCheckpointTestEntry(taskID, 2, "aaa2"),
			cumulativeCheckpointTestEntry(taskID, 3, "aaa3"),
		}),
	}

	got, err := BuildCumulativeRecoveryCheckpoint(taskID, checkpoints)
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Equal(t, uint32(3), got.ResumeToken.LastCommittedStep)
	require.Equal(t, "digest-3", got.ResumeToken.CheckpointDigest)
	require.Len(t, got.WalEntries, 4)
	require.Equal(t, []uint32{0, 1, 2, 3}, []uint32{
		got.WalEntries[0].StepIndex,
		got.WalEntries[1].StepIndex,
		got.WalEntries[2].StepIndex,
		got.WalEntries[3].StepIndex,
	})
}

func TestBuildCumulativeRecoveryCheckpointDeduplicatesSameStep(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	step0 := cumulativeCheckpointTestEntry(taskID, 0, "aaa0")
	step1 := cumulativeCheckpointTestEntry(taskID, 1, "aaa1")
	checkpoints := []*CheckpointPayload{
		cumulativeCheckpointTestPayload(taskID, 0, "digest-0", []WalEntry{step0}),
		cumulativeCheckpointTestPayload(taskID, 1, "digest-1", []WalEntry{step0, step1}),
	}

	got, err := BuildCumulativeRecoveryCheckpoint(taskID, checkpoints)
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Len(t, got.WalEntries, 2)
	require.Equal(t, []uint32{0, 1}, []uint32{got.WalEntries[0].StepIndex, got.WalEntries[1].StepIndex})
}

func TestBuildCumulativeRecoveryCheckpointRejectsConflictingDuplicateStep(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	checkpoints := []*CheckpointPayload{
		cumulativeCheckpointTestPayload(taskID, 0, "digest-0", []WalEntry{
			cumulativeCheckpointTestEntry(taskID, 0, "aaa0"),
		}),
		cumulativeCheckpointTestPayload(taskID, 1, "digest-1", []WalEntry{
			cumulativeCheckpointTestEntry(taskID, 0, "bbbb"),
			cumulativeCheckpointTestEntry(taskID, 1, "aaa1"),
		}),
	}

	got, err := BuildCumulativeRecoveryCheckpoint(taskID, checkpoints)
	require.ErrorIs(t, err, ErrInvalidCumulativeCheckpoint)
	require.Nil(t, got)
}

func TestBuildCumulativeRecoveryCheckpointRejectsMissingStepGap(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	checkpoints := []*CheckpointPayload{
		cumulativeCheckpointTestPayload(taskID, 0, "digest-0", []WalEntry{
			cumulativeCheckpointTestEntry(taskID, 0, "aaa0"),
		}),
		cumulativeCheckpointTestPayload(taskID, 2, "digest-2", []WalEntry{
			cumulativeCheckpointTestEntry(taskID, 2, "aaa2"),
		}),
	}

	got, err := BuildCumulativeRecoveryCheckpoint(taskID, checkpoints)
	require.ErrorIs(t, err, ErrInvalidCumulativeCheckpoint)
	require.Nil(t, got)
}

func cumulativeCheckpointTestPayload(taskID uuid.UUID, lastStep uint32, digest string, entries []WalEntry) *CheckpointPayload {
	return &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: lastStep,
			CheckpointDigest:  digest,
			RuntimeID:         "runtime-test",
		},
		WalEntries: entries,
		Metadata:   json.RawMessage(`{"test":true}`),
		CapturedAt: time.Unix(1_800_000_000+int64(lastStep), 0).UTC(),
	}
}

func cumulativeCheckpointTestEntry(taskID uuid.UUID, step uint32, outputDigest string) WalEntry {
	return WalEntry{
		EntryID:      uuid.New(),
		TaskID:       taskID,
		StepIndex:    step,
		StepType:     map[string]interface{}{"kind": "tool"},
		Status:       "committed",
		InputDigest:  fmt.Sprintf("%064s", "1"),
		OutputDigest: ptrString(fmt.Sprintf("%064s", outputDigest)),
		TimestampMs:  uint64(1_800_000_000 + step),
		RuntimeID:    "runtime-test",
	}
}

func TestTaskProofNeedsReadReconciliation(t *testing.T) {
	t.Parallel()

	now := time.Unix(1_800_000_000, 0).UTC()

	tests := []struct {
		name     string
		proof    *TaskProofState
		expected bool
	}{
		{
			name:     "nil proof does not reconcile",
			proof:    nil,
			expected: false,
		},
		{
			name: "pending stale proof reconciles",
			proof: &TaskProofState{
				Status:    "pending",
				CheckedAt: ptrTime(now.Add(-31 * time.Second)),
			},
			expected: true,
		},
		{
			name: "missing stale proof reconciles",
			proof: &TaskProofState{
				Status:    "missing",
				CheckedAt: ptrTime(now.Add(-3 * time.Minute)),
			},
			expected: true,
		},
		{
			name: "fresh pending proof does not reconcile",
			proof: &TaskProofState{
				Status:    "pending",
				CheckedAt: ptrTime(now.Add(-10 * time.Second)),
			},
			expected: false,
		},
		{
			name: "verified proof does not reconcile on read",
			proof: &TaskProofState{
				Status:    "verified",
				CheckedAt: ptrTime(now.Add(-45 * time.Minute)),
			},
			expected: false,
		},
		{
			name: "mismatch proof does not reconcile on read",
			proof: &TaskProofState{
				Status:    "mismatch",
				CheckedAt: ptrTime(now.Add(-10 * time.Minute)),
			},
			expected: false,
		},
		{
			name: "present proof does not reconcile on read",
			proof: &TaskProofState{
				Status:    "present",
				CheckedAt: ptrTime(now.Add(-20 * time.Minute)),
			},
			expected: false,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := TaskProofNeedsReadReconciliation(test.proof, now); got != test.expected {
				t.Fatalf("TaskProofNeedsReadReconciliation() = %v, want %v", got, test.expected)
			}
		})
	}
}

func TestTaskAllowsRuntimeMutation(t *testing.T) {
	t.Parallel()

	tests := []struct {
		status   TaskRecordStatus
		expected bool
	}{
		{TaskStatusPending, false},
		{TaskStatusDispatched, true},
		{TaskStatusCheckpointed, true},
		{TaskStatusRecovering, true},
		{TaskStatusCompleted, false},
		{TaskStatusFailed, false},
	}

	for _, test := range tests {
		if got := TaskAllowsRuntimeMutation(test.status); got != test.expected {
			t.Fatalf("TaskAllowsRuntimeMutation(%q) = %v, want %v", test.status, got, test.expected)
		}
	}
}

func TestTaskAllowsDispatch(t *testing.T) {
	t.Parallel()

	tests := []struct {
		status   TaskRecordStatus
		expected bool
	}{
		{TaskStatusPending, true},
		{TaskStatusRecovering, true},
		{TaskStatusDispatched, false},
		{TaskStatusCheckpointed, false},
		{TaskStatusCompleted, false},
		{TaskStatusFailed, false},
	}

	for _, test := range tests {
		if got := TaskAllowsDispatch(test.status); got != test.expected {
			t.Fatalf("TaskAllowsDispatch(%q) = %v, want %v", test.status, got, test.expected)
		}
	}
}

func TestTaskAllowsCancellation(t *testing.T) {
	t.Parallel()

	tests := []struct {
		status   TaskRecordStatus
		expected bool
	}{
		{TaskStatusPending, true},
		{TaskStatusDispatched, true},
		{TaskStatusCheckpointed, true},
		{TaskStatusRecovering, true},
		{TaskStatusCompleted, false},
		{TaskStatusFailed, false},
		{TaskStatusCanceled, false},
	}

	for _, test := range tests {
		if got := TaskAllowsCancellation(test.status); got != test.expected {
			t.Fatalf("TaskAllowsCancellation(%q) = %v, want %v", test.status, got, test.expected)
		}
	}
}

func TestTaskAllowsRecoveryRedispatch(t *testing.T) {
	t.Parallel()

	tests := []struct {
		status   TaskRecordStatus
		expected bool
	}{
		{TaskStatusPending, false},
		{TaskStatusDispatched, false},
		{TaskStatusCheckpointed, false},
		{TaskStatusRecovering, true},
		{TaskStatusCompleted, false},
		{TaskStatusFailed, false},
		{TaskStatusCanceled, false},
	}

	for _, test := range tests {
		if got := TaskAllowsRecoveryRedispatch(test.status); got != test.expected {
			t.Fatalf("TaskAllowsRecoveryRedispatch(%q) = %v, want %v", test.status, got, test.expected)
		}
	}
}

func TestTaskDurabilityClassForDefinition(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		definition    json.RawMessage
		expectedClass TaskDurabilityClass
	}{
		{
			name:          "default resumable single inference",
			definition:    json.RawMessage(`{"type":"single_inference","model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}]}`),
			expectedClass: TaskDurabilityClassResumable,
		},
		{
			name:          "streaming single inference is non resumable",
			definition:    json.RawMessage(`{"type":"single_inference","model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}],"stream":true}`),
			expectedClass: TaskDurabilityClassStreamingNonResumable,
		},
		{
			name:          "invalid json falls back to resumable",
			definition:    json.RawMessage(`{"type":`),
			expectedClass: TaskDurabilityClassResumable,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := TaskDurabilityClassForDefinition(test.definition); got != test.expectedClass {
				t.Fatalf("TaskDurabilityClassForDefinition() = %q, want %q", got, test.expectedClass)
			}
		})
	}
}

func TestTaskRecoveryResumeAndSkipReason(t *testing.T) {
	t.Parallel()

	streamingTask := &TaskRecord{
		Status:         TaskStatusRecovering,
		TaskDefinition: json.RawMessage(`{"type":"single_inference","model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}],"stream":true}`),
	}
	if TaskSupportsRecoveryResume(streamingTask) {
		t.Fatal("TaskSupportsRecoveryResume(streamingTask) = true, want false")
	}
	if TaskRecoveryRedispatchEligible(streamingTask) {
		t.Fatal("TaskRecoveryRedispatchEligible(streamingTask) = true, want false")
	}
	if got := TaskRecoverySkipReason(streamingTask); got != "streaming_resume_unsupported" {
		t.Fatalf("TaskRecoverySkipReason(streamingTask) = %q, want streaming_resume_unsupported", got)
	}

	resumableTask := &TaskRecord{
		Status:         TaskStatusRecovering,
		TaskDefinition: json.RawMessage(`{"type":"agent_workflow","steps":[{"step_index":1,"model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}]}]}`),
	}
	if !TaskSupportsRecoveryResume(resumableTask) {
		t.Fatal("TaskSupportsRecoveryResume(resumableTask) = false, want true")
	}
	if !TaskRecoveryRedispatchEligible(resumableTask) {
		t.Fatal("TaskRecoveryRedispatchEligible(resumableTask) = false, want true")
	}
	if got := TaskRecoverySkipReason(resumableTask); got != "" {
		t.Fatalf("TaskRecoverySkipReason(resumableTask) = %q, want empty", got)
	}
}

func TestTaskCheckpointAdvances(t *testing.T) {
	t.Parallel()

	current := &CheckpointPayload{
		ResumeToken: ResumeToken{
			LastCommittedStep: 5,
			CheckpointDigest:  "digest-5",
			RuntimeID:         "runtime-a",
		},
	}

	tests := []struct {
		name     string
		current  *CheckpointPayload
		next     *CheckpointPayload
		expected bool
	}{
		{
			name:     "nil next does not advance",
			current:  current,
			next:     nil,
			expected: false,
		},
		{
			name:    "first checkpoint advances from nil",
			current: nil,
			next: &CheckpointPayload{
				ResumeToken: ResumeToken{LastCommittedStep: 1},
			},
			expected: true,
		},
		{
			name:    "higher step advances",
			current: current,
			next: &CheckpointPayload{
				ResumeToken: ResumeToken{LastCommittedStep: 6},
			},
			expected: true,
		},
		{
			name:    "same step is stale",
			current: current,
			next: &CheckpointPayload{
				ResumeToken: ResumeToken{LastCommittedStep: 5},
			},
			expected: false,
		},
		{
			name:    "lower step regresses",
			current: current,
			next: &CheckpointPayload{
				ResumeToken: ResumeToken{LastCommittedStep: 4},
			},
			expected: false,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := TaskCheckpointAdvances(test.current, test.next); got != test.expected {
				t.Fatalf("TaskCheckpointAdvances() = %v, want %v", got, test.expected)
			}
		})
	}
}

func TestTaskCheckpointWatermarkConsistent(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tests := []struct {
		name     string
		cp       *CheckpointPayload
		expected bool
	}{
		{
			name:     "nil checkpoint is inconsistent",
			cp:       nil,
			expected: false,
		},
		{
			name: "empty wal entries are allowed at zero watermark",
			cp: &CheckpointPayload{
				TaskID:      taskID,
				ResumeToken: ResumeToken{LastCommittedStep: 0},
			},
			expected: true,
		},
		{
			name: "empty wal entries cannot claim committed progress",
			cp: &CheckpointPayload{
				TaskID:      taskID,
				ResumeToken: ResumeToken{LastCommittedStep: 3},
			},
			expected: false,
		},
		{
			name: "wal entries through watermark are consistent",
			cp: &CheckpointPayload{
				TaskID:      taskID,
				ResumeToken: ResumeToken{LastCommittedStep: 5},
				WalEntries: []WalEntry{
					{TaskID: taskID, StepIndex: 4},
					{TaskID: taskID, StepIndex: 5},
				},
			},
			expected: true,
		},
		{
			name: "wal entries below watermark are incomplete",
			cp: &CheckpointPayload{
				TaskID:      taskID,
				ResumeToken: ResumeToken{LastCommittedStep: 5},
				WalEntries: []WalEntry{
					{TaskID: taskID, StepIndex: 3},
					{TaskID: taskID, StepIndex: 4},
				},
			},
			expected: false,
		},
		{
			name: "wal entry above watermark is inconsistent",
			cp: &CheckpointPayload{
				TaskID:      taskID,
				ResumeToken: ResumeToken{LastCommittedStep: 5},
				WalEntries: []WalEntry{
					{TaskID: taskID, StepIndex: 6},
				},
			},
			expected: false,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := TaskCheckpointWatermarkConsistent(test.cp); got != test.expected {
				t.Fatalf("TaskCheckpointWatermarkConsistent() = %v, want %v", got, test.expected)
			}
		})
	}
}

func TestTaskCheckpointEntriesBelongToTask(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	otherTaskID := uuid.New()
	tests := []struct {
		name     string
		cp       *CheckpointPayload
		expected bool
	}{
		{
			name:     "nil checkpoint is inconsistent",
			cp:       nil,
			expected: false,
		},
		{
			name: "checkpoint task id is required",
			cp: &CheckpointPayload{
				ResumeToken: ResumeToken{LastCommittedStep: 3},
			},
			expected: false,
		},
		{
			name: "empty wal entries are scoped by checkpoint task",
			cp: &CheckpointPayload{
				TaskID:      taskID,
				ResumeToken: ResumeToken{LastCommittedStep: 3},
			},
			expected: true,
		},
		{
			name: "matching wal entry task ids are accepted",
			cp: &CheckpointPayload{
				TaskID:      taskID,
				ResumeToken: ResumeToken{LastCommittedStep: 5},
				WalEntries: []WalEntry{
					{TaskID: taskID, StepIndex: 4},
					{TaskID: taskID, StepIndex: 5},
				},
			},
			expected: true,
		},
		{
			name: "missing wal entry task id is rejected",
			cp: &CheckpointPayload{
				TaskID:      taskID,
				ResumeToken: ResumeToken{LastCommittedStep: 5},
				WalEntries: []WalEntry{
					{StepIndex: 5},
				},
			},
			expected: false,
		},
		{
			name: "foreign wal entry task id is rejected",
			cp: &CheckpointPayload{
				TaskID:      taskID,
				ResumeToken: ResumeToken{LastCommittedStep: 5},
				WalEntries: []WalEntry{
					{TaskID: otherTaskID, StepIndex: 5},
				},
			},
			expected: false,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := TaskCheckpointEntriesBelongToTask(test.cp); got != test.expected {
				t.Fatalf("TaskCheckpointEntriesBelongToTask() = %v, want %v", got, test.expected)
			}
		})
	}
}

func TestTaskCheckpointEntriesHaveStableIDs(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tests := []struct {
		name     string
		cp       *CheckpointPayload
		expected bool
	}{
		{
			name:     "nil checkpoint is inconsistent",
			cp:       nil,
			expected: false,
		},
		{
			name: "empty wal entries do not need entry ids",
			cp: &CheckpointPayload{
				TaskID:      taskID,
				ResumeToken: ResumeToken{LastCommittedStep: 3},
			},
			expected: true,
		},
		{
			name: "stable wal entry ids are accepted",
			cp: &CheckpointPayload{
				TaskID:      taskID,
				ResumeToken: ResumeToken{LastCommittedStep: 5},
				WalEntries: []WalEntry{
					{EntryID: uuid.New(), TaskID: taskID, StepIndex: 4},
					{EntryID: uuid.New(), TaskID: taskID, StepIndex: 5},
				},
			},
			expected: true,
		},
		{
			name: "missing wal entry id is rejected",
			cp: &CheckpointPayload{
				TaskID:      taskID,
				ResumeToken: ResumeToken{LastCommittedStep: 5},
				WalEntries: []WalEntry{
					{TaskID: taskID, StepIndex: 5},
				},
			},
			expected: false,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := TaskCheckpointEntriesHaveStableIDs(test.cp); got != test.expected {
				t.Fatalf("TaskCheckpointEntriesHaveStableIDs() = %v, want %v", got, test.expected)
			}
		})
	}
}

func TestWalEntryUnmarshalPreservesBase64DigestBytesAsHex(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	inputDigest := [32]byte{0x01, 0x23, 0x45, 0x67}
	outputDigest := [32]byte{0x89, 0xab, 0xcd, 0xef}
	raw := map[string]any{
		"entry_id":      uuid.New().String(),
		"task_id":       taskID.String(),
		"step_index":    1,
		"step_type":     map[string]any{"ToolCall": map[string]any{"tool_name": "http_request"}},
		"status":        "Committed",
		"input_digest":  base64.StdEncoding.EncodeToString(inputDigest[:]),
		"output_digest": base64.StdEncoding.EncodeToString(outputDigest[:]),
		"timestamp_ms":  uint64(1_900_000_000_000),
		"runtime_id":    "runtime-1",
	}
	data, err := json.Marshal(raw)
	require.NoError(t, err)

	var entry WalEntry
	require.NoError(t, json.Unmarshal(data, &entry))

	require.Equal(t, "0123456700000000000000000000000000000000000000000000000000000000", entry.InputDigest)
	require.NotNil(t, entry.OutputDigest)
	require.Equal(t, "89abcdef00000000000000000000000000000000000000000000000000000000", *entry.OutputDigest)
}

func TestTaskRecoveryCheckpointUsable(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	otherTaskID := uuid.New()
	tests := []struct {
		name     string
		taskID   uuid.UUID
		cp       *CheckpointPayload
		expected bool
	}{
		{
			name:     "nil checkpoint is unusable",
			taskID:   taskID,
			cp:       nil,
			expected: false,
		},
		{
			name:   "checkpoint task must match requested task",
			taskID: taskID,
			cp: &CheckpointPayload{
				TaskID: otherTaskID,
				ResumeToken: ResumeToken{
					LastCommittedStep: 1,
					CheckpointDigest:  "digest-1",
					RuntimeID:         "runtime-1",
				},
				WalEntries: []WalEntry{{EntryID: uuid.New(), TaskID: otherTaskID, StepIndex: 1}},
			},
			expected: false,
		},
		{
			name:   "entry ids must be stable",
			taskID: taskID,
			cp: &CheckpointPayload{
				TaskID: taskID,
				ResumeToken: ResumeToken{
					LastCommittedStep: 1,
					CheckpointDigest:  "digest-1",
					RuntimeID:         "runtime-1",
				},
				WalEntries: []WalEntry{{TaskID: taskID, StepIndex: 1}},
			},
			expected: false,
		},
		{
			name:   "wal entries must reach resume watermark",
			taskID: taskID,
			cp: &CheckpointPayload{
				TaskID: taskID,
				ResumeToken: ResumeToken{
					LastCommittedStep: 2,
					CheckpointDigest:  "digest-2",
					RuntimeID:         "runtime-1",
				},
				WalEntries: []WalEntry{{EntryID: uuid.New(), TaskID: taskID, StepIndex: 1}},
			},
			expected: false,
		},
		{
			name:   "valid recovery checkpoint is usable",
			taskID: taskID,
			cp: &CheckpointPayload{
				TaskID: taskID,
				ResumeToken: ResumeToken{
					LastCommittedStep: 2,
					CheckpointDigest:  "digest-2",
					RuntimeID:         "runtime-1",
				},
				WalEntries: []WalEntry{
					{EntryID: uuid.New(), TaskID: taskID, StepIndex: 1},
					{EntryID: uuid.New(), TaskID: taskID, StepIndex: 2},
				},
			},
			expected: true,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if got := TaskRecoveryCheckpointUsable(test.taskID, test.cp); got != test.expected {
				t.Fatalf("TaskRecoveryCheckpointUsable() = %v, want %v", got, test.expected)
			}
		})
	}
}

func TestTaskTransitionResult(t *testing.T) {
	t.Parallel()

	if err := taskTransitionResult(fakeSQLResult{rows: 1}, nil); err != nil {
		t.Fatalf("taskTransitionResult() unexpected error = %v", err)
	}

	if err := taskTransitionResult(fakeSQLResult{rows: 0}, nil); !errors.Is(err, ErrTaskTransitionRejected) {
		t.Fatalf("taskTransitionResult() error = %v, want ErrTaskTransitionRejected", err)
	}

	expectedErr := errors.New("db failed")
	if err := taskTransitionResult(nil, expectedErr); !errors.Is(err, expectedErr) {
		t.Fatalf("taskTransitionResult() error = %v, want %v", err, expectedErr)
	}
}

func ptrTime(value time.Time) *time.Time {
	return &value
}

func TestExtractProofRefs(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		receipt    json.RawMessage
		wantExecID string
		wantHash   string
		wantOk     bool
	}{
		{
			name:       "receipt_hash takes priority",
			receipt:    json.RawMessage(`{"execution_id":"exec-1","receipt_hash":"hash-1","hash":"fallback"}`),
			wantExecID: "exec-1",
			wantHash:   "hash-1",
			wantOk:     true,
		},
		{
			name:       "falls back to hash",
			receipt:    json.RawMessage(`{"execution_id":"exec-2","hash":"hash-2"}`),
			wantExecID: "exec-2",
			wantHash:   "hash-2",
			wantOk:     true,
		},
		{
			name:    "missing execution id is invalid",
			receipt: json.RawMessage(`{"receipt_hash":"hash-only"}`),
			wantOk:  false,
		},
		{
			name:    "invalid json is rejected",
			receipt: json.RawMessage(`{"execution_id":`),
			wantOk:  false,
		},
		{
			name:    "empty receipt is rejected",
			receipt: nil,
			wantOk:  false,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			execID, hash, ok := extractProofRefs(test.receipt)
			if ok != test.wantOk {
				t.Fatalf("extractProofRefs() ok = %v, want %v", ok, test.wantOk)
			}
			if execID != test.wantExecID {
				t.Fatalf("extractProofRefs() execution_id = %q, want %q", execID, test.wantExecID)
			}
			if hash != test.wantHash {
				t.Fatalf("extractProofRefs() hash = %q, want %q", hash, test.wantHash)
			}
		})
	}
}

func TestBuildTaskProofState(t *testing.T) {
	t.Parallel()

	checkedAt := time.Unix(1_800_000_300, 0).UTC()

	tests := []struct {
		name         string
		executionID  string
		expectedHash string
		storedHash   string
		signature    string
		proofFound   bool
		wantStatus   string
	}{
		{
			name:         "missing when proof is absent",
			executionID:  "exec-missing",
			expectedHash: "hash-a",
			proofFound:   false,
			wantStatus:   "missing",
		},
		{
			name:        "present when no expected hash",
			executionID: "exec-present",
			storedHash:  "hash-b",
			signature:   "sig-b",
			proofFound:  true,
			wantStatus:  "present",
		},
		{
			name:         "verified when expected hash matches",
			executionID:  "exec-verified",
			expectedHash: "hash-c",
			storedHash:   "hash-c",
			signature:    "sig-c",
			proofFound:   true,
			wantStatus:   "verified",
		},
		{
			name:         "mismatch when expected hash differs",
			executionID:  "exec-mismatch",
			expectedHash: "hash-d",
			storedHash:   "hash-other",
			signature:    "sig-d",
			proofFound:   true,
			wantStatus:   "mismatch",
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			state := buildTaskProofState(test.executionID, test.expectedHash, test.storedHash, test.signature, test.proofFound, checkedAt)
			if state.Status != test.wantStatus {
				t.Fatalf("buildTaskProofState() status = %q, want %q", state.Status, test.wantStatus)
			}
			if state.ExecutionID != test.executionID {
				t.Fatalf("buildTaskProofState() execution_id = %q, want %q", state.ExecutionID, test.executionID)
			}
			if state.CheckedAt == nil || !state.CheckedAt.Equal(checkedAt) {
				t.Fatalf("buildTaskProofState() checked_at = %v, want %v", state.CheckedAt, checkedAt)
			}
		})
	}
}

func TestScanTaskRecordHydratesArtifactsAndProof(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	createdAt := time.Unix(1_800_000_100, 0).UTC()
	deadlineAt := createdAt.Add(10 * time.Minute)
	dispatchedAt := createdAt.Add(1 * time.Minute)
	completedAt := createdAt.Add(2 * time.Minute)
	checkedAt := createdAt.Add(3 * time.Minute)
	runtimeID := "runtime-agent-1"
	runtimeEndpoint := "http://runtime.local"
	failureReason := "none"
	failureDetailsBytes := []byte(`{"source":"runtime","operation":"resume","status_code":409,"rejection_type":"checkpoint_mismatch","message":"Checkpoint digest mismatch - WAL state diverged"}`)
	defBytes := []byte(`{"task_type":"single_inference"}`)
	cpBytes := []byte(`{"task_id":"` + taskID.String() + `","resume_token":{"last_committed_step":2,"checkpoint_digest":"abc123","runtime_id":"runtime-agent-1"},"wal_entries":[],"metadata":{"requested_mode":"balanced"}}`)
	envelopeBytes := []byte(`{"provider":"openai","signature":"sig"}`)
	receiptBytes := []byte(`{"execution_id":"exec-1","receipt_hash":"hash-1"}`)

	record, err := scanTaskRecord(fakeTaskRecordScanner{values: []any{
		taskID,
		"tenant-a",
		TaskStatusCompleted,
		runtimeID,
		runtimeEndpoint,
		defBytes,
		cpBytes,
		envelopeBytes,
		receiptBytes,
		sql.NullString{String: "exec-1", Valid: true},
		sql.NullString{String: "hash-1", Valid: true},
		sql.NullString{String: "hash-1", Valid: true},
		sql.NullString{String: "sig-proof", Valid: true},
		sql.NullString{String: "verified", Valid: true},
		sql.NullTime{Time: checkedAt, Valid: true},
		sql.NullBool{Bool: true, Valid: true},      // proof_verified
		sql.NullBool{Bool: true, Valid: true},      // proof_hash_valid
		sql.NullBool{Bool: true, Valid: true},      // proof_signature_matches
		sql.NullBool{Bool: true, Valid: true},      // proof_runtime_key_found
		sql.NullBool{Bool: true, Valid: true},      // proof_chain_link_valid
		sql.NullString{String: "ok", Valid: true},  // proof_verification_reason
		sql.NullTime{Time: checkedAt, Valid: true}, // proof_verified_at
		"idem-1",
		failureReason,
		failureDetailsBytes,
		deadlineAt,
		dispatchedAt,
		completedAt,
		nil,
		createdAt,
		sql.NullString{String: "local_runtime", Valid: true}, // executed_target
		sql.NullString{},                                     // fallback_reason
		uuid.NullUUID{},                                      // registered_agent_id
		sql.NullString{},                                     // registered_agent_name
	}})
	if err != nil {
		t.Fatalf("scanTaskRecord() error = %v", err)
	}

	if record.ExecutedTarget == nil || *record.ExecutedTarget != "local_runtime" {
		t.Fatalf("ExecutedTarget = %v, want local_runtime", record.ExecutedTarget)
	}
	if record.FallbackReason != nil {
		t.Fatalf("FallbackReason = %v, want nil", record.FallbackReason)
	}

	if record.TaskID != taskID {
		t.Fatalf("TaskID = %v, want %v", record.TaskID, taskID)
	}
	if record.RuntimeID == nil || *record.RuntimeID != runtimeID {
		t.Fatalf("RuntimeID = %v, want %q", record.RuntimeID, runtimeID)
	}
	if record.RuntimeEndpoint == nil || *record.RuntimeEndpoint != runtimeEndpoint {
		t.Fatalf("RuntimeEndpoint = %v, want %q", record.RuntimeEndpoint, runtimeEndpoint)
	}
	if string(record.ExecutionEnvelope) != string(envelopeBytes) {
		t.Fatalf("ExecutionEnvelope = %s, want %s", record.ExecutionEnvelope, envelopeBytes)
	}
	if string(record.ExecutionReceipt) != string(receiptBytes) {
		t.Fatalf("ExecutionReceipt = %s, want %s", record.ExecutionReceipt, receiptBytes)
	}
	if record.LastCheckpoint == nil {
		t.Fatal("LastCheckpoint is nil")
	}
	if record.LastCheckpoint.ResumeToken.LastCommittedStep != 2 {
		t.Fatalf("LastCheckpoint.ResumeToken.LastCommittedStep = %d, want 2", record.LastCheckpoint.ResumeToken.LastCommittedStep)
	}
	if record.Proof == nil {
		t.Fatal("Proof is nil")
	}
	if record.Proof.Status != "verified" {
		t.Fatalf("Proof.Status = %q, want verified", record.Proof.Status)
	}
	if record.Proof.CheckedAt == nil || !record.Proof.CheckedAt.Equal(checkedAt) {
		t.Fatalf("Proof.CheckedAt = %v, want %v", record.Proof.CheckedAt, checkedAt)
	}
	if record.Proof.Verified == nil || !*record.Proof.Verified {
		t.Fatalf("Proof.Verified = %v, want true", record.Proof.Verified)
	}
	if record.Proof.ChainLinkValid == nil || !*record.Proof.ChainLinkValid {
		t.Fatalf("Proof.ChainLinkValid = %v, want true", record.Proof.ChainLinkValid)
	}
	if record.Proof.VerificationReason != "ok" {
		t.Fatalf("Proof.VerificationReason = %q, want ok", record.Proof.VerificationReason)
	}
	if record.Proof.VerifiedAt == nil || !record.Proof.VerifiedAt.Equal(checkedAt) {
		t.Fatalf("Proof.VerifiedAt = %v, want %v", record.Proof.VerifiedAt, checkedAt)
	}
	if record.FailureDetails == nil {
		t.Fatal("FailureDetails is nil")
	}
	if record.FailureDetails.Operation != "resume" {
		t.Fatalf("FailureDetails.Operation = %q, want resume", record.FailureDetails.Operation)
	}
	if record.FailureDetails.RejectionType != "checkpoint_mismatch" {
		t.Fatalf("FailureDetails.RejectionType = %q, want checkpoint_mismatch", record.FailureDetails.RejectionType)
	}
}

func TestScanTaskRecordOmitsEmptyProofAndInvalidCheckpoint(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	createdAt := time.Unix(1_800_000_200, 0).UTC()

	record, err := scanTaskRecord(fakeTaskRecordScanner{values: []any{
		taskID,
		"tenant-b",
		TaskStatusPending,
		nil,
		nil,
		[]byte(`{"task_type":"execution_graph"}`),
		[]byte(`{"not-valid-json"`),
		nil,
		nil,
		sql.NullString{},
		sql.NullString{},
		sql.NullString{},
		sql.NullString{},
		sql.NullString{},
		sql.NullTime{},
		sql.NullBool{},   // proof_verified
		sql.NullBool{},   // proof_hash_valid
		sql.NullBool{},   // proof_signature_matches
		sql.NullBool{},   // proof_runtime_key_found
		sql.NullBool{},   // proof_chain_link_valid
		sql.NullString{}, // proof_verification_reason
		sql.NullTime{},   // proof_verified_at
		"idem-2",
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		createdAt,
		sql.NullString{}, // executed_target
		sql.NullString{}, // fallback_reason
		uuid.NullUUID{},  // registered_agent_id
		sql.NullString{}, // registered_agent_name
	}})
	if err != nil {
		t.Fatalf("scanTaskRecord() error = %v", err)
	}

	if record.LastCheckpoint != nil {
		t.Fatalf("LastCheckpoint = %v, want nil for invalid checkpoint JSON", record.LastCheckpoint)
	}
	if record.Proof != nil {
		t.Fatalf("Proof = %+v, want nil when proof fields are empty", record.Proof)
	}
	if record.ExecutionEnvelope != nil {
		t.Fatalf("ExecutionEnvelope = %v, want nil", record.ExecutionEnvelope)
	}
	if record.ExecutionReceipt != nil {
		t.Fatalf("ExecutionReceipt = %v, want nil", record.ExecutionReceipt)
	}
	if record.FailureDetails != nil {
		t.Fatalf("FailureDetails = %+v, want nil", record.FailureDetails)
	}
}

func TestBuildExecutionLineageRecordFromReceipt(t *testing.T) {
	t.Parallel()

	record, err := BuildExecutionLineageRecordFromReceipt(
		json.RawMessage(`{
			"execution_id":"exec-infer-1",
			"transaction_id":"tx-1",
			"transaction_hash":"tx-hash-1",
			"agent_id":"tenant-infer",
			"runtime_id":"runtime-infer-1",
			"cpu_time_ms":12,
			"wall_time_ms":36,
			"memory_peak_mb":48,
			"fs_bytes_written":0,
			"tool_calls":1,
			"violation_occurred":false,
			"hash":"receipt-hash-1",
			"previous_hash":"receipt-hash-0",
			"signature":"receipt-sig-1",
			"timestamp_utc":"2026-05-03T13:00:00Z"
		}`),
		"tenant-infer",
		"",
		"COMPLETED",
		"hello runtime",
	)
	if err != nil {
		t.Fatalf("BuildExecutionLineageRecordFromReceipt() error = %v", err)
	}
	if record == nil {
		t.Fatal("record = nil, want value")
	}
	if record.ExecutionID != "exec-infer-1" {
		t.Fatalf("ExecutionID = %q, want exec-infer-1", record.ExecutionID)
	}
	if record.ReceiptHash != "receipt-hash-1" {
		t.Fatalf("ReceiptHash = %q, want receipt-hash-1", record.ReceiptHash)
	}
	if record.PreviousHash != "receipt-hash-0" {
		t.Fatalf("PreviousHash = %q, want receipt-hash-0 (chain link must be preserved)", record.PreviousHash)
	}
	if record.RuntimeID != "runtime-infer-1" {
		t.Fatalf("RuntimeID = %q, want runtime-infer-1", record.RuntimeID)
	}
	if record.Status != "COMPLETED" {
		t.Fatalf("Status = %q, want COMPLETED", record.Status)
	}
	if record.PromptPreview != "hello runtime" {
		t.Fatalf("PromptPreview = %q, want hello runtime", record.PromptPreview)
	}
}

func TestAIToolAuditRefsExtractsSignedToolReceipt(t *testing.T) {
	t.Parallel()

	envelope := json.RawMessage(`{
		"execution_id":"exec-tool-1",
		"tenant_id":"tenant-ai",
		"model":"github.issues.write",
		"policy_decision_id":"permission-envelope-1",
		"policy_decision_hash":"permission-envelope-hash",
		"governed_action_hash":"tool-action-hash",
		"routing_decision":"tool:github.issues.write",
		"request_hash":"args-hash",
		"response_hash":"result-hash",
		"signature":"runtime-envelope-sig"
	}`)
	receipt := json.RawMessage(`{
		"execution_id":"exec-tool-1",
		"hash":"receipt-hash",
		"signature":"receipt-sig",
		"tool_calls":1,
		"violation_occurred":false
	}`)

	refs, ok := aiToolAuditRefs(envelope, receipt)
	require.True(t, ok)
	require.Equal(t, "exec-tool-1", refs.ExecutionID)
	require.Equal(t, "permission-envelope-1", refs.EnvelopeID)
	require.Equal(t, "tools.github.issues.write", refs.Capability)
	require.Equal(t, "github.issues.write", refs.ToolName)
	require.Equal(t, "tool-action-hash", refs.ToolActionHash)
	require.Equal(t, "receipt-hash", refs.ReceiptHash)
	require.Equal(t, "runtime-envelope-sig", refs.EnvelopeSignature)
}

type fakeTaskRecordScanner struct {
	values []any
}

type fakeSQLResult struct {
	rows int64
}

func (f fakeSQLResult) LastInsertId() (int64, error) {
	return 0, nil
}

func (f fakeSQLResult) RowsAffected() (int64, error) {
	return f.rows, nil
}

func (f fakeTaskRecordScanner) Scan(dest ...any) error {
	if len(dest) != len(f.values) {
		return fmt.Errorf("scan dest mismatch: got %d dests want %d values", len(dest), len(f.values))
	}
	for i, value := range f.values {
		if err := assignScanValue(dest[i], value); err != nil {
			return fmt.Errorf("assign value %d: %w", i, err)
		}
	}
	return nil
}

func assignScanValue(dest any, value any) error {
	dv := reflect.ValueOf(dest)
	if dv.Kind() != reflect.Ptr {
		return fmt.Errorf("destination is not a pointer: %T", dest)
	}

	target := dv.Elem()
	if value == nil {
		target.Set(reflect.Zero(target.Type()))
		return nil
	}

	vv := reflect.ValueOf(value)
	if vv.Type().AssignableTo(target.Type()) {
		target.Set(vv)
		return nil
	}

	if target.Kind() == reflect.Ptr && vv.Type().AssignableTo(target.Type().Elem()) {
		ptr := reflect.New(target.Type().Elem())
		ptr.Elem().Set(vv)
		target.Set(ptr)
		return nil
	}

	return fmt.Errorf("cannot assign %T to %T", value, dest)
}
