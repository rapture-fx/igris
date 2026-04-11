package coordinator

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/google/uuid"
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
		"idem-1",
		failureReason,
		deadlineAt,
		dispatchedAt,
		completedAt,
		nil,
		createdAt,
	}})
	if err != nil {
		t.Fatalf("scanTaskRecord() error = %v", err)
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
		"idem-2",
		nil,
		nil,
		nil,
		nil,
		nil,
		createdAt,
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
