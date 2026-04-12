package models

import "testing"

func TestStreamContractToMapIncludesOptionalFallbackField(t *testing.T) {
	t.Parallel()

	contract := StreamContract{
		ExecutionAuthority: "runtime",
		FallbackAllowed:    false,
		ResumeSupported:    false,
		ReplayCondition:    "completed-final-output",
		FallbackOptInField: "allow_stream_fallback",
	}

	got := contract.ToMap()
	if got["execution_authority"] != "runtime" {
		t.Fatalf("execution_authority = %v, want runtime", got["execution_authority"])
	}
	if got["fallback_allowed"] != false {
		t.Fatalf("fallback_allowed = %v, want false", got["fallback_allowed"])
	}
	if got["resume_supported"] != false {
		t.Fatalf("resume_supported = %v, want false", got["resume_supported"])
	}
	if got["replay_condition"] != "completed-final-output" {
		t.Fatalf("replay_condition = %v, want completed-final-output", got["replay_condition"])
	}
	if got["fallback_opt_in_field"] != "allow_stream_fallback" {
		t.Fatalf("fallback_opt_in_field = %v, want allow_stream_fallback", got["fallback_opt_in_field"])
	}
}
