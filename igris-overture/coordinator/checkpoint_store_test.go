package coordinator

import (
	"testing"
	"time"
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

func ptrTime(value time.Time) *time.Time {
	return &value
}
