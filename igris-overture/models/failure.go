package models

// BuildFailureResponse returns the normalized public failure schema shared by
// task APIs and inference/runtime error surfaces. It accepts flat details for
// compatibility and groups execution/resume context into stable sub-objects.
func BuildFailureResponse(reason string, details map[string]interface{}) map[string]interface{} {
	resp := map[string]interface{}{}
	if reason != "" {
		resp["reason"] = reason
	}
	if details == nil {
		if len(resp) == 0 {
			return nil
		}
		return resp
	}

	copyIfPresent(resp, details, "source")
	copyIfPresent(resp, details, "operation")
	copyAs(resp, details, "rejection_type", "type")
	copyIfPresent(resp, details, "message")
	copyIfPresent(resp, details, "status_code")

	execution := map[string]interface{}{}
	copyIfPresent(execution, details, "step_index")
	copyIfPresent(execution, details, "domain")
	copyIfPresent(execution, details, "node_id")
	if len(execution) > 0 {
		resp["execution"] = execution
	}

	resume := map[string]interface{}{}
	copyIfPresent(resume, details, "requested_last_step")
	copyIfPresent(resume, details, "local_last_step")
	copyIfPresent(resume, details, "requested_checkpoint_digest")
	copyIfPresent(resume, details, "local_checkpoint_digest")
	copyIfPresent(resume, details, "resume_checkpoint_provided")
	if len(resume) > 0 {
		resp["resume"] = resume
	}

	if len(resp) == 0 {
		return nil
	}
	return resp
}

func BuildSimpleFailureResponse(source, operation, failureType, message, detail string) map[string]interface{} {
	reason := detail
	if reason == "" {
		reason = message
	}
	return map[string]interface{}{
		"reason":    reason,
		"source":    source,
		"operation": operation,
		"type":      failureType,
		"message":   message,
	}
}

func copyIfPresent(dst map[string]interface{}, src map[string]interface{}, key string) {
	if value, ok := src[key]; ok {
		dst[key] = value
	}
}

func copyAs(dst map[string]interface{}, src map[string]interface{}, srcKey, dstKey string) {
	if value, ok := src[srcKey]; ok {
		dst[dstKey] = value
	}
}
