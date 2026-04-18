package models

import "fmt"

// RuntimeStreamError preserves structured non-200 responses from the Runtime
// streaming endpoint so Overture can surface them without flattening the
// payload into a string.
type RuntimeStreamError struct {
	StatusCode int
	Payload    map[string]interface{}
	Body       string
}

func (e *RuntimeStreamError) Error() string {
	if e == nil {
		return ""
	}
	if message := e.Message(); message != "" {
		return fmt.Sprintf("runtime_client: streaming runtime returned status %d: %s", e.StatusCode, message)
	}
	if e.Body != "" {
		return fmt.Sprintf("runtime_client: streaming runtime returned status %d: %s", e.StatusCode, e.Body)
	}
	return fmt.Sprintf("runtime_client: streaming runtime returned status %d", e.StatusCode)
}

func (e *RuntimeStreamError) Type() string {
	if e == nil {
		return ""
	}
	errorBody, ok := e.Payload["error"].(map[string]interface{})
	if !ok {
		return ""
	}
	errorType, _ := errorBody["type"].(string)
	return errorType
}

func (e *RuntimeStreamError) Message() string {
	if e == nil {
		return ""
	}
	errorBody, ok := e.Payload["error"].(map[string]interface{})
	if !ok {
		return ""
	}
	message, _ := errorBody["message"].(string)
	return message
}
