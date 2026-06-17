package agentmemory

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestAgentMemoryValidateCreateInputAcceptsSummaryOnlyMemory(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	retention := 30
	input, err := ValidateCreateInput(CreateInput{
		TaskID:          &taskID,
		GoalSummary:     "Invoice enterprise customer",
		DecisionSummary: "Usage exceeded contracted threshold",
		EvidenceSummary: []string{"usage=4821", "plan=enterprise"},
		OutcomeSummary:  "Invoice sent",
		RetentionDays:   &retention,
	}, time.Now())

	require.NoError(t, err)
	require.Equal(t, "Invoice enterprise customer", input.GoalSummary)
	require.Equal(t, []string{"usage=4821", "plan=enterprise"}, input.EvidenceSummary)
	require.Equal(t, &retention, input.RetentionDays)
}

func TestAgentMemoryValidateCreateInputRejectsUnsafeEvidenceMemory(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	for _, test := range []struct {
		name  string
		input CreateInput
	}{
		{
			name: "prompt",
			input: CreateInput{
				TaskID:          &taskID,
				GoalSummary:     "store system prompt for later",
				DecisionSummary: "safe",
				OutcomeSummary:  "safe",
			},
		},
		{
			name: "chain of thought",
			input: CreateInput{
				TaskID:          &taskID,
				GoalSummary:     "safe",
				DecisionSummary: "chain of thought: hidden steps",
				OutcomeSummary:  "safe",
			},
		},
		{
			name: "secret marker",
			input: CreateInput{
				TaskID:          &taskID,
				GoalSummary:     "safe",
				DecisionSummary: "safe",
				EvidenceSummary: []string{"api key=sk-live-123"},
				OutcomeSummary:  "safe",
			},
		},
	} {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			_, err := ValidateCreateInput(test.input, time.Now())
			require.Error(t, err)
		})
	}
}

func TestAgentMemoryValidateCreateInputRequiresAttachment(t *testing.T) {
	t.Parallel()

	_, err := ValidateCreateInput(CreateInput{
		GoalSummary:     "safe",
		DecisionSummary: "safe",
		OutcomeSummary:  "safe",
	}, time.Now())
	require.Error(t, err)
}
