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

func TestBuildReceiptReferenceUsesStableFields(t *testing.T) {
	t.Parallel()

	got := BuildReceiptReference(map[string]interface{}{
		"execution_id":     "exec-1",
		"hash":             "receipt-hash-1",
		"runtime_id":       "runtime-1",
		"transaction_id":   "tx-1",
		"transaction_hash": "tx-hash-1",
		"previous_hash":    "prev-hash",
		"signature":        "sig",
	})

	if got["available"] != true {
		t.Fatalf("available = %v, want true", got["available"])
	}
	if got["execution_id"] != "exec-1" {
		t.Fatalf("execution_id = %v, want exec-1", got["execution_id"])
	}
	if got["receipt_hash"] != "receipt-hash-1" {
		t.Fatalf("receipt_hash = %v, want receipt-hash-1", got["receipt_hash"])
	}
	if got["runtime_id"] != "runtime-1" {
		t.Fatalf("runtime_id = %v, want runtime-1", got["runtime_id"])
	}
	if got["transaction_id"] != "tx-1" {
		t.Fatalf("transaction_id = %v, want tx-1", got["transaction_id"])
	}
	if got["transaction_hash"] != "tx-hash-1" {
		t.Fatalf("transaction_hash = %v, want tx-hash-1", got["transaction_hash"])
	}
	if got["previous_hash"] != "prev-hash" {
		t.Fatalf("previous_hash = %v, want prev-hash", got["previous_hash"])
	}
	if got["signature_present"] != true {
		t.Fatalf("signature_present = %v, want true", got["signature_present"])
	}
}
