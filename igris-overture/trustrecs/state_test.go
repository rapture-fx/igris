package trustrecs

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestValidateUpsertInputAcknowledge(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	out, err := ValidateUpsertInput(UpsertInput{
		RecommendationID: "  action:high_recovery:stripe.refund  ",
		Status:           StatusAcknowledged,
		Reason:           "  reviewed with the team  ",
	}, now)
	require.NoError(t, err)
	require.Equal(t, "action:high_recovery:stripe.refund", out.RecommendationID)
	require.Equal(t, "reviewed with the team", out.Reason)
	require.Nil(t, out.SnoozedUntil)
}

func TestValidateUpsertInputRejectsUnknownStatus(t *testing.T) {
	t.Parallel()
	_, err := ValidateUpsertInput(UpsertInput{RecommendationID: "x", Status: "deferred"}, time.Now())
	require.ErrorIs(t, err, ErrInvalidStatus)
}

func TestValidateUpsertInputRequiresRecommendationID(t *testing.T) {
	t.Parallel()
	_, err := ValidateUpsertInput(UpsertInput{RecommendationID: "  ", Status: StatusActive}, time.Now())
	require.Error(t, err)
}

func TestValidateUpsertInputSnoozeNeedsFutureUntil(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()

	_, err := ValidateUpsertInput(UpsertInput{RecommendationID: "x", Status: StatusSnoozed}, now)
	require.ErrorIs(t, err, ErrSnoozeRequiresUntil)

	past := now.Add(-time.Hour)
	_, err = ValidateUpsertInput(UpsertInput{RecommendationID: "x", Status: StatusSnoozed, SnoozedUntil: &past}, now)
	require.ErrorIs(t, err, ErrSnoozeRequiresUntil)

	future := now.Add(24 * time.Hour)
	out, err := ValidateUpsertInput(UpsertInput{RecommendationID: "x", Status: StatusSnoozed, SnoozedUntil: &future}, now)
	require.NoError(t, err)
	require.NotNil(t, out.SnoozedUntil)
}

func TestValidateUpsertInputClearsSnoozeForNonSnooze(t *testing.T) {
	t.Parallel()
	future := time.Now().Add(24 * time.Hour)
	out, err := ValidateUpsertInput(UpsertInput{RecommendationID: "x", Status: StatusResolved, SnoozedUntil: &future}, time.Now())
	require.NoError(t, err)
	require.Nil(t, out.SnoozedUntil)
}

func TestValidateUpsertInputRejectsUnsafeReason(t *testing.T) {
	t.Parallel()
	for _, reason := range []string{"leak the prompt", "bearer abc", "api_key here", "sk-123"} {
		_, err := ValidateUpsertInput(UpsertInput{RecommendationID: "x", Status: StatusActive, Reason: reason}, time.Now())
		require.Error(t, err, reason)
	}
}

func TestEffectiveStatus(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	future := now.Add(time.Hour)
	past := now.Add(-time.Hour)

	require.Equal(t, StatusSnoozed, State{Status: StatusSnoozed, SnoozedUntil: &future}.EffectiveStatus(now))
	require.Equal(t, StatusActive, State{Status: StatusSnoozed, SnoozedUntil: &past}.EffectiveStatus(now))
	require.Equal(t, StatusActive, State{Status: StatusSnoozed}.EffectiveStatus(now))
	require.Equal(t, StatusAcknowledged, State{Status: StatusAcknowledged}.EffectiveStatus(now))
	require.Equal(t, StatusResolved, State{Status: StatusResolved}.EffectiveStatus(now))
}
