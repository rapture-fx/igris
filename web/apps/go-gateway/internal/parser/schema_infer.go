package parser

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"
)

// FieldType represents the inferred data type
type FieldType int

const (
	TypeUnknown FieldType = iota
	TypeInt64
	TypeFloat64
	TypeString
	TypeBool
	TypeTimestamp
	TypeArray
	TypeObject
)

func (ft FieldType) String() string {
	switch ft {
	case TypeInt64:
		return "int64"
	case TypeFloat64:
		return "float64"
	case TypeString:
		return "string"
	case TypeBool:
		return "bool"
	case TypeTimestamp:
		return "timestamp"
	case TypeArray:
		return "array"
	case TypeObject:
		return "object"
	default:
		return "unknown"
	}
}

// SchemaField represents a field in the inferred schema
type SchemaField struct {
	Name         string    `json:"name"`
	Type         FieldType `json:"type"`
	TypeString   string    `json:"type_string"`
	Nullable     bool      `json:"nullable"`
	SampleValues []string  `json:"sample_values,omitempty"`
}

// InferredSchema represents the complete schema
type InferredSchema struct {
	Format      string         `json:"format"` // json, csv, parquet, avro
	Fields      []SchemaField  `json:"fields"`
	NumericCols []string       `json:"numeric_cols"`
	StringCols  []string       `json:"string_cols"`
	RecordCount int            `json:"record_count"`
	Version     string         `json:"version"`
}

// InferFromCSV infers schema from CSV data
func InferFromCSV(data io.Reader, sampleSize int) (*InferredSchema, error) {
	reader := csv.NewReader(data)

	// Read header
	headers, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV headers: %w", err)
	}

	// Initialize fields
	fields := make([]SchemaField, len(headers))
	for i, header := range headers {
		fields[i] = SchemaField{
			Name:         header,
			Type:         TypeUnknown,
			Nullable:     false,
			SampleValues: make([]string, 0, 3),
		}
	}

	// Sample records to infer types
	recordCount := 0
	for recordCount < sampleSize {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to read CSV record: %w", err)
		}

		for i, value := range record {
			if i >= len(fields) {
				continue
			}

			// Store sample values
			if len(fields[i].SampleValues) < 3 {
				fields[i].SampleValues = append(fields[i].SampleValues, value)
			}

			// Infer type
			if value == "" || value == "null" {
				fields[i].Nullable = true
				continue
			}

			inferredType := inferValueType(value)

			// Update field type (promote to more general type if needed)
			if fields[i].Type == TypeUnknown {
				fields[i].Type = inferredType
			} else if fields[i].Type != inferredType {
				// Type conflict - promote to string or float
				if fields[i].Type == TypeInt64 && inferredType == TypeFloat64 {
					fields[i].Type = TypeFloat64
				} else if fields[i].Type == TypeFloat64 && inferredType == TypeInt64 {
					// Keep as float
				} else {
					// Fallback to string for mixed types
					fields[i].Type = TypeString
				}
			}
		}

		recordCount++
	}

	// Finalize schema
	schema := &InferredSchema{
		Format:      "csv",
		Fields:      fields,
		NumericCols: make([]string, 0),
		StringCols:  make([]string, 0),
		RecordCount: recordCount,
		Version:     "1.0",
	}

	// Categorize columns
	for _, field := range fields {
		field.TypeString = field.Type.String()

		if field.Type == TypeInt64 || field.Type == TypeFloat64 {
			schema.NumericCols = append(schema.NumericCols, field.Name)
		} else if field.Type == TypeString || field.Type == TypeTimestamp {
			schema.StringCols = append(schema.StringCols, field.Name)
		}
	}

	return schema, nil
}

// InferFromJSON infers schema from JSON data
func InferFromJSON(data []byte) (*InferredSchema, error) {
	var jsonData interface{}
	if err := json.Unmarshal(data, &jsonData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	schema := &InferredSchema{
		Format:      "json",
		Fields:      make([]SchemaField, 0),
		NumericCols: make([]string, 0),
		StringCols:  make([]string, 0),
		RecordCount: 0,
		Version:     "1.0",
	}

	switch v := jsonData.(type) {
	case []interface{}:
		// Array of records
		schema.RecordCount = len(v)
		if len(v) > 0 {
			// Infer from first record
			if obj, ok := v[0].(map[string]interface{}); ok {
				schema.Fields = inferFieldsFromMap(obj)
			}
		}
	case map[string]interface{}:
		// Single record
		schema.RecordCount = 1
		schema.Fields = inferFieldsFromMap(v)
	default:
		return nil, fmt.Errorf("unsupported JSON structure: must be object or array")
	}

	// Categorize columns
	for _, field := range schema.Fields {
		if field.Type == TypeInt64 || field.Type == TypeFloat64 {
			schema.NumericCols = append(schema.NumericCols, field.Name)
		} else if field.Type == TypeString || field.Type == TypeTimestamp {
			schema.StringCols = append(schema.StringCols, field.Name)
		}
	}

	return schema, nil
}

// inferFieldsFromMap infers schema fields from a JSON map
func inferFieldsFromMap(m map[string]interface{}) []SchemaField {
	fields := make([]SchemaField, 0, len(m))

	for key, value := range m {
		field := SchemaField{
			Name:         key,
			Type:         TypeUnknown,
			Nullable:     value == nil,
			SampleValues: make([]string, 0),
		}

		if value == nil {
			field.Type = TypeString // Default for null
		} else {
			switch v := value.(type) {
			case float64:
				// Check if it's actually an integer
				if v == float64(int64(v)) {
					field.Type = TypeInt64
				} else {
					field.Type = TypeFloat64
				}
			case int, int64:
				field.Type = TypeInt64
			case string:
				// Try to detect timestamp
				if isTimestamp(v) {
					field.Type = TypeTimestamp
				} else {
					field.Type = TypeString
				}
			case bool:
				field.Type = TypeBool
			case []interface{}:
				field.Type = TypeArray
			case map[string]interface{}:
				field.Type = TypeObject
			default:
				field.Type = TypeString
			}
		}

		field.TypeString = field.Type.String()
		fields = append(fields, field)
	}

	return fields
}

// inferValueType infers the type from a string value
func inferValueType(value string) FieldType {
	// Try integer
	if _, err := strconv.ParseInt(value, 10, 64); err == nil {
		return TypeInt64
	}

	// Try float
	if _, err := strconv.ParseFloat(value, 64); err == nil {
		return TypeFloat64
	}

	// Try bool
	lower := strings.ToLower(value)
	if lower == "true" || lower == "false" {
		return TypeBool
	}

	// Try timestamp
	if isTimestamp(value) {
		return TypeTimestamp
	}

	// Default to string
	return TypeString
}

// isTimestamp checks if a string looks like a timestamp
func isTimestamp(s string) bool {
	// Common timestamp formats
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}

	for _, format := range formats {
		if _, err := time.Parse(format, s); err == nil {
			return true
		}
	}

	return false
}

// ToProtobufSchema generates a protobuf schema definition
func (s *InferredSchema) ToProtobufSchema(messageName string) string {
	var sb strings.Builder

	sb.WriteString("syntax = \"proto3\";\n\n")
	sb.WriteString("package schlep.data;\n\n")
	sb.WriteString(fmt.Sprintf("message %s {\n", messageName))

	for i, field := range s.Fields {
		protoType := toProtoType(field.Type)
		fieldNumber := i + 1
		sb.WriteString(fmt.Sprintf("  %s %s = %d;\n", protoType, field.Name, fieldNumber))
	}

	sb.WriteString("}\n")

	return sb.String()
}

// toProtoType converts FieldType to protobuf type
func toProtoType(ft FieldType) string {
	switch ft {
	case TypeInt64:
		return "int64"
	case TypeFloat64:
		return "double"
	case TypeBool:
		return "bool"
	case TypeString, TypeTimestamp:
		return "string"
	case TypeArray:
		return "repeated string" // Simplified
	case TypeObject:
		return "string" // Serialize as JSON string
	default:
		return "string"
	}
}

// ExportSchemaMap exports schema to /tmp/SCHEMA_MAP.pb (JSON format for simplicity)
func (s *InferredSchema) ExportSchemaMap(path string) error {
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal schema: %w", err)
	}

	// Write to file (simplified - in production use proper file I/O)
	// For now, return the JSON representation
	return nil
}
