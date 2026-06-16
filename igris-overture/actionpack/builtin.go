package actionpack

// ListBuiltin returns all built-in Action Packs shipped with Igris.
func ListBuiltin() []Manifest {
	return []Manifest{StarterPack()}
}

// GetBuiltin returns a built-in pack by name, or false when unknown.
func GetBuiltin(name string) (Manifest, bool) {
	for _, pack := range ListBuiltin() {
		if pack.Name == name {
			return pack, true
		}
	}
	return Manifest{}, false
}

// StarterPack is the safe first-run pack for agent onboarding.
func StarterPack() Manifest {
	irreversible := false
	approvalRequired := true
	return Manifest{
		SchemaVersion: SchemaVersion,
		Name:          "starter",
		DisplayName:   "Starter Pack",
		Description:   "Safe mock_demo actions for first-agent onboarding: echo, simulated failure, and approval gate.",
		Actions: []ActionEntry{
			{
				Name:         "demo.echo",
				DisplayName:  "Demo Echo",
				Description:  "Echo input through mock_demo — proves the happy path without external APIs.",
				TargetType:   "mock_demo",
				PolicyPreset: "Read-only",
				ReplayClass:  "read_only",
				TargetMetadata: map[string]interface{}{
					"demo_variant": "echo",
					"pack":         "starter",
				},
				InputSchema: map[string]interface{}{
					"type":     "object",
					"required": []interface{}{"message"},
					"properties": map[string]interface{}{
						"message": map[string]interface{}{"type": "string"},
					},
					"additionalProperties": false,
				},
				IdempotencyGuidance: "Use a stable key per logical echo; retries with the same key return the same run.",
				ExampleInput: map[string]interface{}{
					"message": "hello from starter pack",
				},
			},
			{
				Name:         "demo.fail_once",
				DisplayName:  "Demo Fail Once",
				Description:  "Simulates a failed first attempt for recovery visibility; retry with input.retry=true or a new idempotency key.",
				TargetType:   "mock_demo",
				PolicyPreset: "Safe automation",
				ReplayClass:  "retryable",
				TargetMetadata: map[string]interface{}{
					"demo_variant": "fail_once",
					"pack":         "starter",
				},
				InputSchema: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"message": map[string]interface{}{"type": "string"},
						"retry":   map[string]interface{}{"type": "boolean"},
					},
					"additionalProperties": false,
				},
				IdempotencyGuidance: "First attempt fails by design. Retry with a new idempotency key and input.retry=true to complete.",
				ExampleInput: map[string]interface{}{
					"message": "show me failure visibility",
				},
			},
			{
				Name:             "demo.needs_approval",
				DisplayName:      "Demo Needs Approval",
				Description:      "Pauses at approval_required — proves human-gated policy before execution.",
				TargetType:       "mock_demo",
				PolicyPreset:     "Human-gated",
				ReplayClass:      "non_retryable",
				ApprovalRequired: &approvalRequired,
				Irreversible:     &irreversible,
				TargetMetadata: map[string]interface{}{
					"demo_variant": "needs_approval",
					"pack":         "starter",
				},
				InputSchema: map[string]interface{}{
					"type":     "object",
					"required": []interface{}{"message"},
					"properties": map[string]interface{}{
						"message": map[string]interface{}{"type": "string"},
					},
					"additionalProperties": false,
				},
				IdempotencyGuidance: "Use one key per approval request; do not reuse keys across distinct approval decisions.",
				ExampleInput: map[string]interface{}{
					"message": "request operator approval",
				},
			},
		},
	}
}