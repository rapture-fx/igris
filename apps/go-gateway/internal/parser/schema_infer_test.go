package parser

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestInferFromCSV(t *testing.T) {
	csvData := `feature1,feature2,feature3,label,timestamp
1.5,2.3,4.1,positive,2025-10-04T20:00:00Z
2.1,3.4,1.8,negative,2025-10-04T20:01:00Z
3.2,1.9,5.3,positive,2025-10-04T20:02:00Z`

	reader := strings.NewReader(csvData)
	schema, err := InferFromCSV(reader, 10)

	if err != nil {
		t.Fatalf("InferFromCSV failed: %v", err)
	}

	if schema.Format != "csv" {
		t.Errorf("Expected format 'csv', got '%s'", schema.Format)
	}

	if len(schema.Fields) != 5 {
		t.Errorf("Expected 5 fields, got %d", len(schema.Fields))
	}

	// Check feature1 is numeric
	if schema.Fields[0].Name != "feature1" {
		t.Errorf("Expected first field 'feature1', got '%s'", schema.Fields[0].Name)
	}

	if schema.Fields[0].Type != TypeFloat64 {
		t.Errorf("Expected feature1 type Float64, got %s", schema.Fields[0].Type.String())
	}

	// Check label is string
	labelField := schema.Fields[3]
	if labelField.Type != TypeString {
		t.Errorf("Expected label type String, got %s", labelField.Type.String())
	}

	// Check timestamp detection
	timestampField := schema.Fields[4]
	if timestampField.Type != TypeTimestamp {
		t.Errorf("Expected timestamp type Timestamp, got %s", timestampField.Type.String())
	}

	// Check numeric columns
	if len(schema.NumericCols) != 3 {
		t.Errorf("Expected 3 numeric columns, got %d", len(schema.NumericCols))
	}

	t.Logf("✅ CSV Schema: %d fields, %d numeric, %d string",
		len(schema.Fields), len(schema.NumericCols), len(schema.StringCols))
}

func TestInferFromJSON(t *testing.T) {
	jsonData := `{
		"features": [1.5, 2.3, 4.1],
		"model_id": "test_model",
		"timestamp": "2025-10-04T20:00:00Z",
		"score": 0.85
	}`

	schema, err := InferFromJSON([]byte(jsonData))

	if err != nil {
		t.Fatalf("InferFromJSON failed: %v", err)
	}

	if schema.Format != "json" {
		t.Errorf("Expected format 'json', got '%s'", schema.Format)
	}

	if len(schema.Fields) != 4 {
		t.Errorf("Expected 4 fields, got %d", len(schema.Fields))
	}

	t.Logf("✅ JSON Schema: %d fields", len(schema.Fields))
}

func TestInferFromJSONArray(t *testing.T) {
	jsonData := `[
		{"feature1": 1.5, "feature2": 2.3, "label": "A"},
		{"feature1": 2.1, "feature2": 3.4, "label": "B"}
	]`

	schema, err := InferFromJSON([]byte(jsonData))

	if err != nil {
		t.Fatalf("InferFromJSON array failed: %v", err)
	}

	if schema.RecordCount != 2 {
		t.Errorf("Expected 2 records, got %d", schema.RecordCount)
	}

	t.Logf("✅ JSON Array Schema: %d records, %d fields",
		schema.RecordCount, len(schema.Fields))
}

func TestToProtobufSchema(t *testing.T) {
	schema := &InferredSchema{
		Format: "csv",
		Fields: []SchemaField{
			{Name: "feature1", Type: TypeFloat64, TypeString: "float64"},
			{Name: "feature2", Type: TypeFloat64, TypeString: "float64"},
			{Name: "label", Type: TypeString, TypeString: "string"},
		},
		Version: "1.0",
	}

	protoSchema := schema.ToProtobufSchema("TestRecord")

	if !strings.Contains(protoSchema, "message TestRecord") {
		t.Error("Protobuf schema missing message definition")
	}

	if !strings.Contains(protoSchema, "double feature1") {
		t.Error("Protobuf schema missing feature1 field")
	}

	if !strings.Contains(protoSchema, "string label") {
		t.Error("Protobuf schema missing label field")
	}

	t.Logf("✅ Protobuf Schema Generated:\n%s", protoSchema)
}

func TestTypeInference(t *testing.T) {
	tests := []struct {
		value    string
		expected FieldType
	}{
		{"123", TypeInt64},
		{"123.45", TypeFloat64},
		{"true", TypeBool},
		{"false", TypeBool},
		{"2025-10-04T20:00:00Z", TypeTimestamp},
		{"hello", TypeString},
	}

	for _, tt := range tests {
		result := inferValueType(tt.value)
		if result != tt.expected {
			t.Errorf("inferValueType(%q) = %s, expected %s",
				tt.value, result.String(), tt.expected.String())
		}
	}

	t.Log("✅ Type inference tests passed")
}

func BenchmarkInferFromCSV(b *testing.B) {
	csvData := `feature1,feature2,feature3,label
1.5,2.3,4.1,positive
2.1,3.4,1.8,negative
3.2,1.9,5.3,positive`

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		reader := strings.NewReader(csvData)
		_, err := InferFromCSV(reader, 10)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkInferFromJSON(b *testing.B) {
	jsonData := []byte(`{"features": [1.5, 2.3, 4.1], "model_id": "test"}`)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := InferFromJSON(jsonData)
		if err != nil {
			b.Fatal(err)
		}
	}
}
