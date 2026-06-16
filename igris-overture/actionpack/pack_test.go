package actionpack

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateManifestAcceptsStarterPack(t *testing.T) {
	t.Parallel()
	require.NoError(t, ValidateManifest(StarterPack()))
}

func TestValidateManifestRejectsForbiddenFields(t *testing.T) {
	t.Parallel()
	pack := StarterPack()
	pack.Actions[0].TargetMetadata = map[string]interface{}{
		"tenant_id": "other-tenant",
	}
	err := ValidateManifest(pack)
	require.Error(t, err)
	require.Contains(t, err.Error(), "tenant_id")
}

func TestValidateManifestRejectsSecretValues(t *testing.T) {
	t.Parallel()
	pack := StarterPack()
	pack.Actions[0].ExampleInput = map[string]interface{}{
		"message": "igris_super_secret_value",
	}
	err := ValidateManifest(pack)
	require.Error(t, err)
	require.Contains(t, err.Error(), "secret")
}

func TestInstallCreatesRegisteredActions(t *testing.T) {
	t.Parallel()
	creator := &recordingCreator{}
	result, err := Install(t.Context(), creator, "tenant-a", StarterPack())
	require.NoError(t, err)
	require.Len(t, result.Created, 3)
	require.Empty(t, result.Skipped)
	require.Len(t, creator.requests, 3)
	for _, req := range creator.requests {
		require.Equal(t, "mock_demo", req.TargetType)
		require.Empty(t, req.SecretRefs)
		require.NotContains(t, req.TargetMetadata, "tenant_id")
	}
}

func TestInstallSkipsConflicts(t *testing.T) {
	t.Parallel()
	creator := &recordingCreator{conflicts: map[string]struct{}{"demo.echo": {}}}
	result, err := Install(t.Context(), creator, "tenant-a", StarterPack())
	require.NoError(t, err)
	require.Contains(t, result.Skipped, "demo.echo")
	require.Len(t, result.Created, 2)
}

type recordingCreator struct {
	requests  []ActionCreateRequest
	conflicts map[string]struct{}
}

func (r *recordingCreator) CreateAction(_ context.Context, tenantID string, req ActionCreateRequest) (bool, error) {
	if tenantID != "tenant-a" {
		return false, nil
	}
	r.requests = append(r.requests, req)
	if _, ok := r.conflicts[req.Name]; ok {
		return false, nil
	}
	return true, nil
}