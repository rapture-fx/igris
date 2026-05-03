package models

import "fmt"

// RuntimeTaskError preserves structured task responses from the Runtime when
// the request reached Runtime successfully but did not complete. Overture must
// surface this instead of silently falling back to direct provider routing.
type RuntimeTaskError struct {
	StatusCode int
	Payload    map[string]interface{}
	Body       string
}

func (e *RuntimeTaskError) Error() string {
	if e == nil {
		return ""
	}
	if reason := e.Reason(); reason != "" {
		return fmt.Sprintf("runtime_client: runtime task returned status %d: %s", e.StatusCode, reason)
	}
	if status := e.Status(); status != "" {
		return fmt.Sprintf("runtime_client: runtime task returned status %d: %s", e.StatusCode, status)
	}
	if e.Body != "" {
		return fmt.Sprintf("runtime_client: runtime task returned status %d: %s", e.StatusCode, e.Body)
	}
	return fmt.Sprintf("runtime_client: runtime task returned status %d", e.StatusCode)
}

func (e *RuntimeTaskError) Status() string {
	if e == nil {
		return ""
	}
	statusBody, ok := e.Payload["status"].(map[string]interface{})
	if ok {
		status, _ := statusBody["status"].(string)
		return status
	}
	status, _ := e.Payload["status"].(string)
	return status
}

func (e *RuntimeTaskError) Reason() string {
	if e == nil {
		return ""
	}
	statusBody, ok := e.Payload["status"].(map[string]interface{})
	if ok {
		reason, _ := statusBody["reason"].(string)
		if reason != "" {
			return reason
		}
	}
	reason, _ := e.Payload["reason"].(string)
	return reason
}
