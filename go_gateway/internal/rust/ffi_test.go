package rust

import (
	"strings"
	"testing"
)

func TestAdd_Basic(t *testing.T) {
	tests := []struct {
		name     string
		x        int
		y        int
		expected int
	}{
		{"positive numbers", 5, 3, 8},
		{"negative numbers", -5, -3, -8},
		{"mixed signs", 10, -3, 7},
		{"zero values", 0, 0, 0},
		{"large numbers", 1000000, 2000000, 3000000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Add(tt.x, tt.y)
			if result != tt.expected {
				t.Errorf("Add(%d, %d) = %d, want %d", tt.x, tt.y, result, tt.expected)
			}
		})
	}
}

func TestAdd_Commutative(t *testing.T) {
	// Addition should be commutative: a + b = b + a
	result1 := Add(7, 13)
	result2 := Add(13, 7)

	if result1 != result2 {
		t.Errorf("Add is not commutative: Add(7, 13) = %d, Add(13, 7) = %d", result1, result2)
	}
}

func TestAdd_Associative(t *testing.T) {
	// Addition should be associative: (a + b) + c = a + (b + c)
	a, b, c := 5, 10, 15

	result1 := Add(Add(a, b), c)
	result2 := Add(a, Add(b, c))

	if result1 != result2 {
		t.Errorf("Add is not associative: (5 + 10) + 15 = %d, 5 + (10 + 15) = %d", result1, result2)
	}
}

func TestHelloFrom_Basic(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		contains string
	}{
		{"simple name", "Alice", "Alice"},
		{"name with spaces", "Bob Smith", "Bob Smith"},
		{"empty string", "", ""},
		{"special characters", "José", "José"},
		{"long name", "Elizabeth Alexandra Mary Windsor", "Elizabeth"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := HelloFrom(tt.input)

			if result == "" && tt.input != "" {
				t.Error("Expected non-empty result for non-empty input")
			}

			if tt.contains != "" && !strings.Contains(result, tt.contains) {
				t.Errorf("HelloFrom(%q) = %q, should contain %q", tt.input, result, tt.contains)
			}
		})
	}
}

func TestHelloFrom_Format(t *testing.T) {
	name := "World"
	result := HelloFrom(name)

	// Result should contain the input name
	if !strings.Contains(result, name) {
		t.Errorf("HelloFrom(%q) = %q, should contain input name", name, result)
	}

	// Result should not be empty
	if result == "" {
		t.Error("HelloFrom should return non-empty string")
	}
}

func TestHelloFrom_DifferentInputs(t *testing.T) {
	result1 := HelloFrom("Alice")
	result2 := HelloFrom("Bob")

	// Different inputs should produce different outputs
	if result1 == result2 {
		t.Error("Different names should produce different greetings")
	}

	// But both should contain their respective names
	if !strings.Contains(result1, "Alice") {
		t.Error("Result should contain input name Alice")
	}

	if !strings.Contains(result2, "Bob") {
		t.Error("Result should contain input name Bob")
	}
}

func TestFFI_MemorySafety(t *testing.T) {
	// Test that FFI doesn't leak memory or cause panics with many calls
	for i := 0; i < 1000; i++ {
		_ = Add(i, i+1)
		_ = HelloFrom("test")
	}
}

func TestFFI_ConcurrentAccess(t *testing.T) {
	// Test thread safety of FFI calls
	done := make(chan bool, 100)

	for i := 0; i < 100; i++ {
		go func(idx int) {
			defer func() {
				if r := recover(); r != nil {
					t.Errorf("Panic in concurrent FFI call: %v", r)
				}
				done <- true
			}()

			result := Add(idx, idx*2)
			expected := idx + (idx * 2)
			if result != expected {
				t.Errorf("Add(%d, %d) = %d, want %d", idx, idx*2, result, expected)
			}

			greeting := HelloFrom("Concurrent")
			if !strings.Contains(greeting, "Concurrent") {
				t.Error("HelloFrom should contain input name")
			}
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < 100; i++ {
		<-done
	}
}

func BenchmarkAdd(b *testing.B) {
	for i := 0; i < b.N; i++ {
		Add(42, 58)
	}
}

func BenchmarkHelloFrom(b *testing.B) {
	for i := 0; i < b.N; i++ {
		HelloFrom("Benchmark")
	}
}

func BenchmarkFFI_Parallel(b *testing.B) {
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			Add(10, 20)
			HelloFrom("Parallel")
		}
	})
}
