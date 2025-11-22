package semantic

import (
	"fmt"
)

// SemanticClassifierStub provides a no-op implementation when ONNX is not available
type SemanticClassifierStub struct{}

// NewSemanticClassifierStub creates a stub classifier
func NewSemanticClassifierStub() *SemanticClassifierStub {
	return &SemanticClassifierStub{}
}

// Classify returns a default class for stub mode
func (s *SemanticClassifierStub) Classify(text string) (string, float64, error) {
	return "general", 0.5, fmt.Errorf("semantic routing disabled: ONNX model not loaded")
}

// Close is a no-op for stub
func (s *SemanticClassifierStub) Close() error {
	return nil
}
