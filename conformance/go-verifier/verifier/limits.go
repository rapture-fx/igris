package verifier

// Limits is the bounded-work conformance profile from the standalone verifier
// design. The limits bound local parsing and verification work; they are not a
// reinterpretation of signed schema-1 bytes. A limit hit is reported as
// resource_limit where a result can still be constructed safely.
type Limits struct {
	// MaxInputBytes bounds one artifact input (file, stdin, or JSONL chain).
	MaxInputBytes int
	// MaxEventBytes bounds one Evidence event line inside a chain.
	MaxEventBytes int
	// MaxChainEvents bounds the number of events in one chain operation.
	MaxChainEvents int
	// MaxDepth is the deepest accepted container nesting. Depth MaxDepth is
	// accepted; MaxDepth+1 is rejected.
	MaxDepth int
	// MaxKeyBytes bounds public-key material supplied to the verifier.
	MaxKeyBytes int
	// MaxIssues bounds the retained portable issues.
	MaxIssues int
}

// DefaultLimits returns the documented minimum defaults.
func DefaultLimits() Limits {
	return Limits{
		MaxInputBytes:  1 << 20, // 1 MiB
		MaxEventBytes:  64 << 10,
		MaxChainEvents: 500,
		MaxDepth:       64,
		MaxKeyBytes:    4 << 10,
		MaxIssues:      20,
	}
}
