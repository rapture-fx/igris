package verifier

import (
	"regexp"
	"time"
)

// Frozen schema-1 shape rules, implemented from RFC 002/003 and the frozen
// suite vectors. Schema `1` ActionContract is a closed schema; Evidence
// schema `1` is open (unknown fields are cryptographically included and
// reported as a semantic diagnostic, never rejected).

var (
	actionNameRe = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_.:-]{0,127}$`)
	hex64Re      = regexp.MustCompile(`^[0-9a-f]{64}$`)
)

var contractFields = map[string]struct{}{
	"schema_version":        {},
	"action_name":           {},
	"module":                {},
	"qualified_name":        {},
	"risk":                  {},
	"approval_mode":         {},
	"execution_mode":        {},
	"parameter_descriptors": {},
	"code_fingerprint":      {},
	"contract_hash":         {},
}

var descriptorFields = map[string]struct{}{
	"name":        {},
	"kind":        {},
	"has_default": {},
	"annotation":  {},
}

var parameterKinds = map[string]struct{}{
	"POSITIONAL_ONLY":       {},
	"POSITIONAL_OR_KEYWORD": {},
	"VAR_POSITIONAL":        {},
	"KEYWORD_ONLY":          {},
	"VAR_KEYWORD":           {},
}

var riskValues = map[string]struct{}{
	"low": {}, "medium": {}, "high": {}, "critical": {},
}

var approvalValues = map[string]struct{}{
	"required": {}, "never": {},
}

var eventSharedFields = []string{
	"schema_version",
	"event_type",
	"event_id",
	"action_id",
	"action_name",
	"contract_hash",
	"timestamp_utc",
	"key_id",
	"previous_event_hash",
	"event_hash",
	"signature",
}

var decisionFields = []string{
	"decision",
	"risk",
	"approval_mode",
	"redacted_input_summary",
	"input_hash",
}

var outcomeFields = []string{
	"status",
	"decision_event_id",
}

var eventOptionalFields = []string{
	"metadata",
	"observed_result_type",
	"redacted_output_hash",
	"exception_type",
	"sanitized_error_summary",
}

// registeredEventVocabulary is the complete registered schema-1 event field
// vocabulary used for the unknown_fields_present diagnostic.
var registeredEventVocabulary = func() map[string]struct{} {
	vocabulary := make(map[string]struct{})
	for _, groups := range [][]string{eventSharedFields, decisionFields, outcomeFields, eventOptionalFields} {
		for _, name := range groups {
			vocabulary[name] = struct{}{}
		}
	}
	return vocabulary
}()

func isString(v *Value) bool { return v != nil && v.Kind == KindString }

func stringValue(v *Value) (string, bool) {
	if isString(v) {
		return v.Str, true
	}
	return "", false
}

// validTimestamp checks the schema-1 producer timestamp claim: an RFC 3339
// UTC instant ending in Z, with optional fractional seconds.
func validTimestamp(value string) bool {
	if len(value) == 0 || value[len(value)-1] != 'Z' {
		return false
	}
	_, err := time.Parse(time.RFC3339Nano, value)
	return err == nil
}

// schemaCheck is one typed schema-dispatch outcome.
type schemaCheck struct {
	issue          string  // "" means the shape is valid
	objectSchemaID *string // submitted schema identifier when safely read
}

func submittedSchemaID(object *Value) *string {
	if raw := object.Lookup("schema_version"); isString(raw) {
		id := raw.Str
		return &id
	}
	return nil
}

// contractSchemaIssue validates the closed ActionContract schema-1 shape.
// Precedence: unsupported schema, missing field, unknown field, invalid
// field.
func contractSchemaIssue(object *Value) schemaCheck {
	schemaID := submittedSchemaID(object)
	if schemaID == nil || *schemaID != "1" {
		return schemaCheck{issue: "unsupported_schema", objectSchemaID: schemaID}
	}
	check := schemaCheck{objectSchemaID: schemaID}
	present := make(map[string]*Value, len(object.Members))
	for i := range object.Members {
		present[object.Members[i].Name] = object.Members[i].Value
	}
	for name := range contractFields {
		if _, ok := present[name]; !ok {
			check.issue = "missing_field"
			return check
		}
	}
	for name := range present {
		if _, ok := contractFields[name]; !ok {
			check.issue = "unknown_field"
			return check
		}
	}
	check.issue = "invalid_field"
	for _, name := range []string{"action_name", "module", "qualified_name", "risk", "approval_mode", "execution_mode"} {
		if !isString(present[name]) {
			return check
		}
	}
	if !actionNameRe.MatchString(present["action_name"].Str) {
		return check
	}
	if _, ok := riskValues[present["risk"].Str]; !ok {
		return check
	}
	if _, ok := approvalValues[present["approval_mode"].Str]; !ok {
		return check
	}
	if present["execution_mode"].Str != "embedded" {
		return check
	}
	if fingerprint := present["code_fingerprint"]; fingerprint.Kind != KindNull {
		if !isString(fingerprint) || !hex64Re.MatchString(fingerprint.Str) {
			return check
		}
	}
	if !isString(present["contract_hash"]) || !hex64Re.MatchString(present["contract_hash"].Str) {
		return check
	}
	descriptors := present["parameter_descriptors"]
	if descriptors.Kind != KindArray {
		return check
	}
	for _, descriptor := range descriptors.Arr {
		if descriptor.Kind != KindObject || len(descriptor.Members) != len(descriptorFields) {
			return check
		}
		for i := range descriptor.Members {
			if _, ok := descriptorFields[descriptor.Members[i].Name]; !ok {
				return check
			}
		}
		if !isString(descriptor.Lookup("name")) {
			return check
		}
		kind, ok := stringValue(descriptor.Lookup("kind"))
		if !ok {
			return check
		}
		if _, registered := parameterKinds[kind]; !registered {
			return check
		}
		if hasDefault := descriptor.Lookup("has_default"); hasDefault.Kind != KindBool {
			return check
		}
		if annotation := descriptor.Lookup("annotation"); annotation.Kind != KindNull && !isString(annotation) {
			return check
		}
	}
	check.issue = ""
	return check
}

// evidenceSchemaIssue validates the schema-1 Evidence event shape under the
// strictest documented common semantic profile pinned by the frozen vectors.
// Unknown extra fields are not schema errors: schema `1` Evidence is open.
func evidenceSchemaIssue(object *Value) schemaCheck {
	schemaID := submittedSchemaID(object)
	if schemaID == nil || *schemaID != "1" {
		return schemaCheck{issue: "unsupported_schema", objectSchemaID: schemaID}
	}
	check := schemaCheck{objectSchemaID: schemaID}
	present := make(map[string]*Value, len(object.Members))
	for i := range object.Members {
		present[object.Members[i].Name] = object.Members[i].Value
	}
	eventTypeValue, hasEventType := present["event_type"]
	if !hasEventType {
		check.issue = "missing_field"
		return check
	}
	eventType, ok := stringValue(eventTypeValue)
	if !ok || (eventType != "decision" && eventType != "outcome") {
		// An unregistered event type under supported schema 1 is
		// invalid_field, never a separate unsupported alias.
		check.issue = "invalid_field"
		return check
	}
	required := append([]string{}, eventSharedFields...)
	if eventType == "decision" {
		required = append(required, decisionFields...)
	} else {
		required = append(required, outcomeFields...)
	}
	for _, name := range required {
		if _, ok := present[name]; !ok {
			check.issue = "missing_field"
			return check
		}
	}
	check.issue = "invalid_field"
	for _, name := range []string{
		"schema_version", "event_type", "event_id", "action_id", "action_name",
		"contract_hash", "timestamp_utc", "key_id", "event_hash", "signature",
	} {
		if !isString(present[name]) {
			return check
		}
	}
	if !actionNameRe.MatchString(present["action_name"].Str) {
		return check
	}
	if !hex64Re.MatchString(present["contract_hash"].Str) || !hex64Re.MatchString(present["event_hash"].Str) {
		return check
	}
	if previous := present["previous_event_hash"]; previous.Kind != KindNull {
		if !isString(previous) || !hex64Re.MatchString(previous.Str) {
			return check
		}
	}
	if !validTimestamp(present["timestamp_utc"].Str) {
		return check
	}
	if eventType == "decision" {
		decision, _ := stringValue(present["decision"])
		if decision != "allowed" && decision != "denied" {
			return check
		}
		risk, _ := stringValue(present["risk"])
		if _, ok := riskValues[risk]; !ok {
			return check
		}
		approval, _ := stringValue(present["approval_mode"])
		if _, ok := approvalValues[approval]; !ok {
			return check
		}
		if !isString(present["redacted_input_summary"]) || !isString(present["input_hash"]) {
			return check
		}
	} else {
		status, _ := stringValue(present["status"])
		if status != "succeeded" && status != "failed" {
			return check
		}
		if !isString(present["decision_event_id"]) {
			return check
		}
	}
	check.issue = ""
	return check
}

// eventHasUnknownFields reports whether the event carries fields outside the
// registered schema-1 vocabulary. They stay in the signed payload; this is a
// diagnostic, not a rejection.
func eventHasUnknownFields(object *Value) bool {
	for i := range object.Members {
		if _, ok := registeredEventVocabulary[object.Members[i].Name]; !ok {
			return true
		}
	}
	return false
}

// unsignedEventPayload returns the event minus exactly event_hash and
// signature, preserving every other member including unknown fields.
func unsignedEventPayload(object *Value) *Value {
	payload := &Value{Kind: KindObject}
	for i := range object.Members {
		name := object.Members[i].Name
		if name == "event_hash" || name == "signature" {
			continue
		}
		payload.Members = append(payload.Members, object.Members[i])
	}
	return payload
}

// contractBodyWithoutHash returns the contract minus exactly contract_hash.
func contractBodyWithoutHash(object *Value) *Value {
	body := &Value{Kind: KindObject}
	for i := range object.Members {
		if object.Members[i].Name == "contract_hash" {
			continue
		}
		body.Members = append(body.Members, object.Members[i])
	}
	return body
}
