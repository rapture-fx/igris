package verifier

import (
	"encoding/json"
	"fmt"
	"sort"
)

// ResultSchemaID is the portable verification-result schema identifier.
const ResultSchemaID = "igris:protocol:verification-result:1"

// Artifact identifies the verified object inside a portable result.
type Artifact struct {
	ArtifactID     *string `json:"artifact_id"`
	ObjectSchemaID *string `json:"object_schema_id"`
	ObjectType     string  `json:"object_type"`
}

// Issue is one registered portable diagnostic.
type Issue struct {
	Code       string  `json:"code"`
	EventIndex *int    `json:"event_index"`
	Path       *string `json:"path"`
	Severity   string  `json:"severity"`
}

// Result is one igris:protocol:verification-result:1 object. Field names are
// fixed by the frozen machine schema; JSON encoding is deterministic.
type Result struct {
	Algorithm        string          `json:"algorithm"`
	Artifact         Artifact        `json:"artifact"`
	Canonicalization string          `json:"canonicalization"`
	Completeness     string          `json:"completeness"`
	Continuity       string          `json:"continuity"`
	EventsVerified   int             `json:"events_verified"`
	Issues           []Issue         `json:"issues"`
	KeyResolution    string          `json:"key_resolution"`
	ObjectHash       string          `json:"object_hash"`
	Parse            string          `json:"parse"`
	Policy           json.RawMessage `json:"policy"`
	Schema           string          `json:"schema"`
	SchemaID         string          `json:"schema_id"`
	Semantics        string          `json:"semantics"`
	Signature        string          `json:"signature"`
	Specification    string          `json:"specification"`
	Summary          string          `json:"summary"`
	TimeConfidence   string          `json:"time_confidence"`
	Trust            string          `json:"trust"`
}

// issueRegistry fixes the severity and owning-dimension order of every
// registered issue code, from the ratified verification-result draft. The
// dimension rank follows the phase order used for deterministic issue
// ordering: specification, parse, schema, canonicalization, algorithm,
// object_hash, signature, key_resolution, continuity, completeness,
// semantics, trust, time_confidence.
var issueRegistry = map[string]struct {
	severity string
	phase    int
}{
	"specification_conflict":            {"error", 0},
	"malformed":                         {"error", 1},
	"invalid_utf8":                      {"error", 1},
	"duplicate_member":                  {"error", 1},
	"trailing_content":                  {"error", 1},
	"resource_limit":                    {"error", 1},
	"unsupported_schema":                {"error", 2},
	"unknown_field":                     {"error", 2},
	"missing_field":                     {"error", 2},
	"invalid_field":                     {"error", 2},
	"invalid_null":                      {"error", 2},
	"canonicalization_failed":           {"error", 3},
	"unsupported_legacy_representation": {"error", 3},
	"integer_out_of_range":              {"error", 3},
	"invalid_unicode_scalar":            {"error", 3},
	"unsupported_algorithm":             {"error", 4},
	"hash_mismatch":                     {"error", 5},
	"invalid_signature":                 {"error", 6},
	"missing_signature":                 {"error", 6},
	"unknown_key":                       {"error", 7},
	"ambiguous_key":                     {"error", 7},
	"chain_discontinuity":               {"error", 8},
	"partial_chain":                     {"warning", 8},
	"fork_detected":                     {"error", 8},
	"incomplete_chain":                  {"error", 9},
	"completeness_unknown":              {"warning", 9},
	"invalid_transition":                {"error", 10},
	"unknown_decision_reference":        {"error", 10},
	"duplicate_outcome":                 {"error", 10},
	"unresolved_execution":              {"warning", 10},
	"unknown_fields_present":            {"warning", 10},
	"untrusted_key":                     {"warning", 11},
	"revoked_key":                       {"warning", 11},
	"outside_binding_interval":          {"warning", 11},
	"binding_interval_indeterminate":    {"warning", 11},
	"stale_trust_snapshot":              {"warning", 11},
	"trust_unknown":                     {"warning", 11},
	"producer_time_only":                {"warning", 12},
	"time_confidence_unavailable":       {"warning", 12},
}

// RegisteredIssueCodes returns the sorted registry codes.
func RegisteredIssueCodes() []string {
	codes := make([]string, 0, len(issueRegistry))
	for code := range issueRegistry {
		codes = append(codes, code)
	}
	sort.Strings(codes)
	return codes
}

// newIssue builds a registered issue with its fixed portable severity.
func newIssue(code string) Issue {
	entry, ok := issueRegistry[code]
	if !ok {
		panic(fmt.Sprintf("unregistered issue code: %s", code))
	}
	return Issue{Code: code, Severity: entry.severity}
}

// sortIssues applies the registry ordering: event index with null first,
// verification phase, path, then code.
func sortIssues(issues []Issue) {
	sort.SliceStable(issues, func(i, j int) bool {
		a, b := issues[i], issues[j]
		switch {
		case a.EventIndex == nil && b.EventIndex != nil:
			return true
		case a.EventIndex != nil && b.EventIndex == nil:
			return false
		case a.EventIndex != nil && b.EventIndex != nil && *a.EventIndex != *b.EventIndex:
			return *a.EventIndex < *b.EventIndex
		}
		if pa, pb := issueRegistry[a.Code].phase, issueRegistry[b.Code].phase; pa != pb {
			return pa < pb
		}
		ap, bp := "", ""
		if a.Path != nil {
			ap = *a.Path
		}
		if b.Path != nil {
			bp = *b.Path
		}
		if ap != bp {
			return ap < bp
		}
		return a.Code < b.Code
	})
}

// deriveSummary applies the deterministic descriptive classification from the
// verification-result draft. Rows are evaluated in order; the first matching
// row wins. It is descriptive, never an authorization decision.
func deriveSummary(r *Result) string {
	if r.Parse == "malformed" ||
		r.Schema == "invalid" ||
		r.Canonicalization == "invalid" ||
		r.ObjectHash == "mismatch" ||
		r.Signature == "invalid" ||
		r.Continuity == "discontinuous" ||
		r.Semantics == "invalid" {
		return "invalid"
	}
	if r.Schema == "unsupported" ||
		r.Canonicalization == "unsupported" ||
		r.Algorithm == "unsupported" {
		return "unsupported"
	}
	if r.Specification == "conflict" ||
		r.Parse == "resource_limit" ||
		r.KeyResolution == "unknown" || r.KeyResolution == "ambiguous" ||
		r.Trust == "binding_interval_indeterminate" ||
		r.Completeness == "incomplete" ||
		r.Semantics == "unresolved" {
		return "indeterminate"
	}
	switch r.Trust {
	case "untrusted", "revoked", "outside_binding_interval":
		return "valid_but_untrusted"
	case "trusted":
		return "valid_and_trusted"
	default:
		return "valid_but_trust_unknown"
	}
}

// finalize orders issues, truncates them to the bounded profile, derives the
// summary from the recorded dimensions, and returns the result.
func (r *Result) finalize(limits Limits) *Result {
	sortIssues(r.Issues)
	if limits.MaxIssues > 0 && len(r.Issues) > limits.MaxIssues {
		r.Issues = r.Issues[:limits.MaxIssues]
	}
	if r.Issues == nil {
		r.Issues = []Issue{}
	}
	r.Summary = deriveSummary(r)
	return r
}

// baseResult is the post-parse dimension baseline shared by the artifact
// verifiers: specification consistent, parse valid, schema supported,
// canonicalization valid, nothing cryptographic evaluated yet, trust not
// evaluated.
func baseResult(objectType string, schemaID *string) *Result {
	return &Result{
		SchemaID: ResultSchemaID,
		Artifact: Artifact{
			ObjectSchemaID: schemaID,
			ObjectType:     objectType,
		},
		Specification:    "consistent",
		Parse:            "valid",
		Schema:           "supported",
		Canonicalization: "valid",
		Algorithm:        "not_evaluated",
		ObjectHash:       "not_present",
		Signature:        "not_present",
		KeyResolution:    "not_required",
		Continuity:       "not_applicable",
		Completeness:     "not_applicable",
		Semantics:        "not_applicable",
		Trust:            "not_evaluated",
		TimeConfidence:   "not_applicable",
		Policy:           json.RawMessage("null"),
		Issues:           []Issue{},
	}
}

// parseFailureResult maps a bounded-parse rejection to the portable result:
// every later dimension is not_evaluated because nothing after the parse
// phase could be safely established.
func parseFailureResult(objectType string, err *ParseError, limits Limits) *Result {
	r := baseResult(objectType, nil)
	code := "malformed"
	r.Parse = "malformed"
	switch err.Failure {
	case FailInvalidUTF8:
		code = "invalid_utf8"
	case FailDuplicateMember:
		code = "duplicate_member"
	case FailTrailingContent:
		code = "trailing_content"
	case FailResourceLimit:
		code = "resource_limit"
		r.Parse = "resource_limit"
	}
	r.Schema = "not_evaluated"
	r.Canonicalization = "not_evaluated"
	r.ObjectHash = "not_evaluated"
	r.Signature = "not_evaluated"
	r.KeyResolution = "not_evaluated"
	r.Continuity = "not_evaluated"
	r.Completeness = "not_evaluated"
	r.Semantics = "not_evaluated"
	r.TimeConfidence = "not_evaluated"
	r.Issues = append(r.Issues, newIssue(code))
	return r.finalize(limits)
}

// specificationConflictResult reports that applicable normative artifacts
// conflict: every affected phase stops and the summary is indeterminate.
func specificationConflictResult(objectType string, limits Limits) *Result {
	r := baseResult(objectType, nil)
	r.Specification = "conflict"
	r.Schema = "not_evaluated"
	r.Canonicalization = "not_evaluated"
	r.ObjectHash = "not_evaluated"
	r.Signature = "not_evaluated"
	r.KeyResolution = "not_evaluated"
	r.Continuity = "not_evaluated"
	r.Completeness = "not_evaluated"
	r.Semantics = "not_evaluated"
	r.TimeConfidence = "not_evaluated"
	r.Issues = append(r.Issues, newIssue("specification_conflict"))
	return r.finalize(limits)
}

// MarshalDeterministic renders the result as compact JSON with a fixed field
// order. The struct field order is alphabetical, matching the frozen expected
// files, so encoding/json produces identical bytes for identical results.
func (r *Result) MarshalDeterministic() ([]byte, error) {
	return json.Marshal(r)
}
