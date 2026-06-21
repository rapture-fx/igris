package api

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuildExecutionIntelligenceSummaryComputesRates(t *testing.T) {
	t.Parallel()

	summary := buildExecutionIntelligenceSummary(10, 7, 2, 1, 3, 4, sql.NullFloat64{Float64: 1250, Valid: true})

	require.Equal(t, int64(10), summary.TotalRuns)
	require.Equal(t, 0.7, summary.SuccessRate)
	require.Equal(t, 0.2, summary.FailureRate)
	require.Equal(t, 0.1, summary.ApprovalRate)
	require.Equal(t, 0.3, summary.HumanInterventionRate)
	require.Equal(t, 0.4, summary.RecoveryRate)
	require.Equal(t, 1250.0, summary.AverageDurationMs)
}

func TestBuildExecutionIntelligenceSummaryHandlesEmptyWindow(t *testing.T) {
	t.Parallel()

	summary := buildExecutionIntelligenceSummary(0, 0, 0, 0, 0, 0, sql.NullFloat64{})

	require.Equal(t, int64(0), summary.TotalRuns)
	require.Equal(t, 0.0, summary.SuccessRate)
	require.Equal(t, 0.0, summary.FailureRate)
	require.Equal(t, 0.0, summary.RecoveryRate)
	require.Equal(t, 0.0, summary.AverageDurationMs)
}

func TestBuildExecutionIntelligenceBreakdownComputesQualityRates(t *testing.T) {
	t.Parallel()

	row := buildExecutionIntelligenceBreakdown(
		"agent-1", "Claude Code", 20, 16, 3, 5, 4,
		12, 9, 15, sql.NullFloat64{Float64: 340, Valid: true},
	)

	require.Equal(t, int64(12), row.EvalRunCount)
	require.Equal(t, int64(9), row.EvalPassedRuns)
	require.Equal(t, int64(15), row.ProofCoveredRuns)
	require.Equal(t, 0.25, row.ApprovalRate)
	require.Equal(t, 0.75, row.EvalPassRate)
	require.Equal(t, 0.75, row.ProofCoverage)
}
