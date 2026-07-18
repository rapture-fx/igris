package runner

import (
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"strings"
)

// resultSchema is a focused validator driven by the actual frozen
// verification-result JSON Schema document. It interprets exactly the
// keywords that schema uses (type, const, enum, required, properties,
// additionalProperties, $ref into $defs, oneOf, minimum, maximum, minLength,
// pattern, items) rather than embedding a hand-copied shape.
type resultSchema struct {
	root map[string]any
}

// LoadResultSchema parses the frozen machine schema bytes.
func LoadResultSchema(raw []byte) (*resultSchema, error) {
	var root map[string]any
	if err := json.Unmarshal(raw, &root); err != nil {
		return nil, fmt.Errorf("verification-result schema is not valid JSON: %w", err)
	}
	return &resultSchema{root: root}, nil
}

// Validate checks one decoded result document against the schema.
func (s *resultSchema) Validate(document any) error {
	return s.validate(document, s.root, "")
}

func (s *resultSchema) resolve(node map[string]any) (map[string]any, error) {
	ref, ok := node["$ref"].(string)
	if !ok {
		return node, nil
	}
	const prefix = "#/$defs/"
	if !strings.HasPrefix(ref, prefix) {
		return nil, fmt.Errorf("unsupported $ref: %s", ref)
	}
	defs, _ := s.root["$defs"].(map[string]any)
	target, ok := defs[strings.TrimPrefix(ref, prefix)].(map[string]any)
	if !ok {
		return nil, fmt.Errorf("unresolvable $ref: %s", ref)
	}
	return target, nil
}

func jsonTypeOf(value any) string {
	switch v := value.(type) {
	case nil:
		return "null"
	case bool:
		return "boolean"
	case string:
		return "string"
	case float64:
		if v == math.Trunc(v) {
			return "integer"
		}
		return "number"
	case []any:
		return "array"
	case map[string]any:
		return "object"
	default:
		return "unknown"
	}
}

func typeMatches(declared string, value any) bool {
	actual := jsonTypeOf(value)
	if declared == actual {
		return true
	}
	return declared == "number" && actual == "integer"
}

func (s *resultSchema) validate(value any, rawSchema map[string]any, at string) error {
	schema, err := s.resolve(rawSchema)
	if err != nil {
		return err
	}
	fail := func(format string, args ...any) error {
		return fmt.Errorf("schema violation at %q: %s", at, fmt.Sprintf(format, args...))
	}

	if constValue, ok := schema["const"]; ok {
		if !jsonEqual(constValue, value) {
			return fail("const mismatch")
		}
	}
	if enumValues, ok := schema["enum"].([]any); ok {
		matched := false
		for _, candidate := range enumValues {
			if jsonEqual(candidate, value) {
				matched = true
				break
			}
		}
		if !matched {
			return fail("value not in enum")
		}
	}
	if declaredType, ok := schema["type"]; ok {
		switch t := declaredType.(type) {
		case string:
			if !typeMatches(t, value) {
				return fail("expected type %s, got %s", t, jsonTypeOf(value))
			}
		case []any:
			matched := false
			for _, item := range t {
				if name, ok := item.(string); ok && typeMatches(name, value) {
					matched = true
					break
				}
			}
			if !matched {
				return fail("value type %s not in declared types", jsonTypeOf(value))
			}
		}
	}
	if oneOf, ok := schema["oneOf"].([]any); ok {
		matches := 0
		for _, branch := range oneOf {
			branchSchema, ok := branch.(map[string]any)
			if !ok {
				return fail("unsupported oneOf branch")
			}
			if s.validate(value, branchSchema, at) == nil {
				matches++
			}
		}
		if matches != 1 {
			return fail("oneOf matched %d branches", matches)
		}
	}
	if number, ok := value.(float64); ok {
		if minimum, ok := schema["minimum"].(float64); ok && number < minimum {
			return fail("below minimum")
		}
		if maximum, ok := schema["maximum"].(float64); ok && number > maximum {
			return fail("above maximum")
		}
	}
	if text, ok := value.(string); ok {
		if minLength, ok := schema["minLength"].(float64); ok && float64(len(text)) < minLength {
			return fail("shorter than minLength")
		}
		if pattern, ok := schema["pattern"].(string); ok {
			re, err := regexp.Compile(pattern)
			if err != nil {
				return fail("uncompilable schema pattern")
			}
			if !re.MatchString(text) {
				return fail("pattern mismatch")
			}
		}
	}
	if object, ok := value.(map[string]any); ok {
		if required, ok := schema["required"].([]any); ok {
			for _, name := range required {
				key, _ := name.(string)
				if _, present := object[key]; !present {
					return fail("missing required property %q", key)
				}
			}
		}
		properties, _ := schema["properties"].(map[string]any)
		if additional, declared := schema["additionalProperties"]; declared && additional == false {
			for key := range object {
				if _, known := properties[key]; !known {
					return fail("undeclared property %q", key)
				}
			}
		}
		for key, propertySchema := range properties {
			propertyValue, present := object[key]
			if !present {
				continue
			}
			schemaMap, ok := propertySchema.(map[string]any)
			if !ok {
				return fail("unsupported property schema for %q", key)
			}
			if err := s.validate(propertyValue, schemaMap, at+"/"+key); err != nil {
				return err
			}
		}
	}
	if array, ok := value.([]any); ok {
		if itemsSchema, ok := schema["items"].(map[string]any); ok {
			for index, item := range array {
				if err := s.validate(item, itemsSchema, fmt.Sprintf("%s/%d", at, index)); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// jsonEqual compares two decoded JSON documents structurally via canonical
// re-marshaling (encoding/json sorts object keys).
func jsonEqual(a, b any) bool {
	rawA, errA := json.Marshal(a)
	rawB, errB := json.Marshal(b)
	return errA == nil && errB == nil && string(rawA) == string(rawB)
}
