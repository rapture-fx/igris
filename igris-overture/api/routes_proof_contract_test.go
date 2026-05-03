package api

import (
	"encoding/json"
	"testing"
	"time"
)

func TestExpectedHashFromVerifyRequest(t *testing.T) {
	req := VerifyReceiptRequest{Hash: "hash-a"}
	if got := expectedHashFromVerifyRequest(req); got != "hash-a" {
		t.Fatalf("expectedHashFromVerifyRequest() = %q, want %q", got, "hash-a")
	}

	req = VerifyReceiptRequest{ExpectedHash: "hash-b", Hash: "hash-a"}
	if got := expectedHashFromVerifyRequest(req); got != "hash-b" {
		t.Fatalf("expectedHashFromVerifyRequest() preferred hash = %q, want %q", got, "hash-b")
	}
}

func TestReceiptVerificationStatus(t *testing.T) {
	tests := []struct {
		name        string
		proofStatus string
		hash        string
		want        string
	}{
		{name: "verified proof", proofStatus: "verified", hash: "hash-1", want: "verified"},
		{name: "present receipt", hash: "hash-1", want: "present"},
		{name: "missing receipt", want: "missing"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := receiptVerificationStatus(test.proofStatus, test.hash); got != test.want {
				t.Fatalf("receiptVerificationStatus() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestParsePolicyViolationDetails(t *testing.T) {
	raw, err := json.Marshal(map[string]any{
		"violation_type":     "TICK_TIMEOUT",
		"severity":           "critical",
		"policy_rule":        "max_tick_ms",
		"action_taken":       "terminated",
		"execution_state":    "VIOLATION",
		"bound_violated":     "max_tick_ms",
		"expected":           1000,
		"actual":             1247,
		"containment_result": "contained",
	})
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}

	meta := parsePolicyViolationDetails(raw)
	if meta.ViolationType != "TICK_TIMEOUT" {
		t.Fatalf("ViolationType = %q, want %q", meta.ViolationType, "TICK_TIMEOUT")
	}
	if meta.PolicyRule != "max_tick_ms" {
		t.Fatalf("PolicyRule = %q, want %q", meta.PolicyRule, "max_tick_ms")
	}
	if meta.LimitValue == nil || *meta.LimitValue != 1000 {
		t.Fatalf("LimitValue = %v, want 1000", meta.LimitValue)
	}
	if meta.ObservedValue == nil || *meta.ObservedValue != 1247 {
		t.Fatalf("ObservedValue = %v, want 1247", meta.ObservedValue)
	}
}

func TestBuildReceiptViolationRecordFallback(t *testing.T) {
	record := buildReceiptViolationRecord(time.Unix(0, 0).UTC(), nil)
	if record.ViolationType != "violation_recorded" {
		t.Fatalf("ViolationType = %q, want %q", record.ViolationType, "violation_recorded")
	}
}
