package models

import (
	"net/http"
	"testing"
)

func TestBuildFailureResponseGroupsExecutionAndResumeContext(t *testing.T) {
	resp := BuildFailureResponse("runtime resume rejected", map[string]interface{}{
		"source":                      "runtime",
		"operation":                   "resume",
		"status_code":                 http.StatusConflict,
		"rejection_type":              "checkpoint_mismatch",
		"message":                     "Checkpoint digest mismatch",
		"step_index":                  uint32(3),
		"domain":                      "tool",
		"node_id":                     "tool-3",
		"requested_last_step":         uint32(2),
		"local_last_step":             uint32(1),
		"requested_checkpoint_digest": "digest-2",
		"local_checkpoint_digest":     "digest-local",
		"resume_checkpoint_provided":  true,
	})

	if got := resp["reason"]; got != "runtime resume rejected" {
		t.Fatalf("reason = %v, want runtime resume rejected", got)
	}
	if got := resp["type"]; got != "checkpoint_mismatch" {
		t.Fatalf("type = %v, want checkpoint_mismatch", got)
	}
	execution, ok := resp["execution"].(map[string]interface{})
	if !ok {
		t.Fatalf("execution type = %T, want map[string]interface{}", resp["execution"])
	}
	if got := execution["node_id"]; got != "tool-3" {
		t.Fatalf("execution.node_id = %v, want tool-3", got)
	}
	resume, ok := resp["resume"].(map[string]interface{})
	if !ok {
		t.Fatalf("resume type = %T, want map[string]interface{}", resp["resume"])
	}
	if got := resume["requested_checkpoint_digest"]; got != "digest-2" {
		t.Fatalf("resume.requested_checkpoint_digest = %v, want digest-2", got)
	}
	if got := resume["local_last_step"]; got != uint32(1) {
		t.Fatalf("resume.local_last_step = %v, want 1", got)
	}
}

func TestBuildSimpleFailureResponseUsesDetailAsReason(t *testing.T) {
	resp := BuildSimpleFailureResponse(
		"runtime",
		"infer",
		"runtime_security_rejected",
		"upstream security rejection",
		ErrRuntimeSecurity.Error(),
	)

	if got := resp["source"]; got != "runtime" {
		t.Fatalf("source = %v, want runtime", got)
	}
	if got := resp["reason"]; got != ErrRuntimeSecurity.Error() {
		t.Fatalf("reason = %v, want %q", got, ErrRuntimeSecurity.Error())
	}
}
