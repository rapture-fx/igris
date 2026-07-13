package api

import (
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestContainmentProofGateReportsUnsupportedAsSkippedNotPassed(t *testing.T) {
	t.Parallel()

	srcBytes, err := os.ReadFile("../../scripts/ci_proof_gate.sh")
	require.NoError(t, err)
	src := string(srcBytes)

	require.Contains(t, src, "containment_capable()")
	require.Contains(t, src, "IGRIS_FORCE_CONTAINMENT_UNSUPPORTED")
	require.Contains(t, src, "IGRIS_REQUIRE_CONTAINMENT")
	require.Contains(t, src, "CONTAINMENT-DEPENDENT PROOFS: UNSUPPORTED / SKIPPED")
	require.Contains(t, src, "These are NOT passed here")
	require.Contains(t, src, "exit 1")

	require.NotContains(t, src, "CONTAINMENT-DEPENDENT PROOFS: PASSED")
	require.NotContains(t, src, "containment guarantee is proven on GitHub-hosted")
}
