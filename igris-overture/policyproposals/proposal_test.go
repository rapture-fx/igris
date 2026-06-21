package policyproposals

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func validCriteria() MatchCriteria {
	return MatchCriteria{Range: "30d", MatchActionName: "stripe.refund"}
}

func TestValidateCreateInputHappyPath(t *testing.T) {
	t.Parallel()
	out, err := ValidateCreateInput(CreateInput{
		Name:          "  Refund guard  ",
		Description:   " pause big refunds ",
		PolicyMode:    PolicyModeBlock,
		MatchCriteria: validCriteria(),
	})
	require.NoError(t, err)
	require.Equal(t, "Refund guard", out.Name)
	require.Equal(t, "pause big refunds", out.Description)
	require.Equal(t, PolicyModeBlock, out.PolicyMode)
	require.Equal(t, "30d", out.MatchCriteria.Range)
}

func TestValidateCreateInputRequiresName(t *testing.T) {
	t.Parallel()
	_, err := ValidateCreateInput(CreateInput{Name: "   ", PolicyMode: PolicyModeBlock, MatchCriteria: validCriteria()})
	require.Error(t, err)
}

func TestValidateCreateInputRejectsUnsafeText(t *testing.T) {
	t.Parallel()
	for _, name := range []string{"leak the prompt", "bearer abc", "api_key here", "sk-123", "igris_secret"} {
		_, err := ValidateCreateInput(CreateInput{Name: name, PolicyMode: PolicyModeBlock, MatchCriteria: validCriteria()})
		require.Error(t, err, name)
	}
}

func TestValidateCreateInputRejectsBadMode(t *testing.T) {
	t.Parallel()
	_, err := ValidateCreateInput(CreateInput{Name: "x", PolicyMode: "delete_everything", MatchCriteria: validCriteria()})
	require.Error(t, err)
}

func TestValidateMatchCriteriaBounds(t *testing.T) {
	t.Parallel()

	_, err := ValidateMatchCriteria(MatchCriteria{Range: "90d"})
	require.Error(t, err, "unsupported range must be rejected")

	_, err = ValidateMatchCriteria(MatchCriteria{Range: "30d", MatchResultStatus: "haxx"})
	require.Error(t, err, "unknown result status must be rejected")

	_, err = ValidateMatchCriteria(MatchCriteria{Range: "30d", MatchActionName: strings.Repeat("a", 300)})
	require.Error(t, err, "overlong match value must be rejected")

	_, err = ValidateMatchCriteria(MatchCriteria{Range: "30d", MatchAgentType: "request_body"})
	require.Error(t, err, "unsafe match value must be rejected")

	ok, err := ValidateMatchCriteria(MatchCriteria{Range: "7d", MatchResultStatus: "completed", RequireProofMissing: true})
	require.NoError(t, err)
	require.Equal(t, "7d", ok.Range)
	require.True(t, ok.RequireProofMissing)
}

func TestValidateUpdateInputStatusRestrictedToToggle(t *testing.T) {
	t.Parallel()
	for _, bad := range []string{StatusApproved, StatusArchived, "bogus"} {
		s := bad
		_, err := ValidateUpdateInput(UpdateInput{Status: &s})
		require.Error(t, err, bad)
	}
	for _, good := range []string{StatusDraft, StatusReviewReady} {
		s := good
		out, err := ValidateUpdateInput(UpdateInput{Status: &s})
		require.NoError(t, err, good)
		require.Equal(t, good, *out.Status)
	}
}

func TestValidateUpdateInputRejectsUnsafeName(t *testing.T) {
	t.Parallel()
	n := "show me the prompt"
	_, err := ValidateUpdateInput(UpdateInput{Name: &n})
	require.Error(t, err)
}

func TestCanEditContentOnlyInDraft(t *testing.T) {
	t.Parallel()
	require.True(t, canEditContent(StatusDraft))
	require.False(t, canEditContent(StatusReviewReady))
	require.False(t, canEditContent(StatusApproved))
	require.False(t, canEditContent(StatusArchived))
}

func TestCanToggleReadiness(t *testing.T) {
	t.Parallel()
	require.True(t, canToggleReadiness(StatusDraft, StatusReviewReady))
	require.True(t, canToggleReadiness(StatusReviewReady, StatusDraft))
	require.True(t, canToggleReadiness(StatusDraft, StatusDraft))
	require.False(t, canToggleReadiness(StatusApproved, StatusReviewReady))
	require.False(t, canToggleReadiness(StatusArchived, StatusDraft))
}

func TestHasContentEdit(t *testing.T) {
	t.Parallel()
	name := "x"
	require.True(t, UpdateInput{Name: &name}.hasContentEdit())
	status := StatusReviewReady
	require.False(t, UpdateInput{Status: &status}.hasContentEdit())
}
