// Package canonicaljson is the production implementation of the Igris
// contract-v1 canonical JSON rules. The protocol is defined in exact UTF-8
// bytes (docs/architecture/igris-progressive-contract-v1.md §12): keys sorted
// lexicographically, compact separators, non-ASCII emitted raw, and `<`, `>`,
// `&` NOT HTML-escaped. Decoded-JSON equality is not conformance; byte
// equality with the Python SDK's output is.
//
// The rules here are pinned twice: byte-for-byte against the Python-generated
// fixtures in testdata/igris-contract-v1 by this package's own tests, and by
// the test-only reference in conformance/contractv1 (which must stay green
// and unchanged). Do not "fix" encoding behavior here without both suites.
package canonicaljson

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
)

// Encode serializes v as canonical contract-v1 JSON bytes.
//
// Go's encoding/json marshals map keys sorted and emits non-ASCII raw; the
// two protocol-critical settings are HTML escaping disabled and the
// encoder's trailing newline stripped.
func Encode(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return nil, fmt.Errorf("canonical encode: %w", err)
	}
	return bytes.TrimSuffix(buf.Bytes(), []byte("\n")), nil
}

// DecodeObjectPreserving decodes a JSON object keeping numeric literals
// intact (json.Number), so re-encoding reproduces the original literal
// instead of a float rendering.
func DecodeObjectPreserving(data []byte) (map[string]any, error) {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	var out map[string]any
	if err := dec.Decode(&out); err != nil {
		return nil, err
	}
	// Reject trailing content after the object so "{}garbage" is not accepted.
	if dec.More() {
		return nil, fmt.Errorf("unexpected trailing content after JSON object")
	}
	return out, nil
}

// SHA256Hex is the contract-v1 hash rule: SHA-256 over canonical bytes,
// lowercase hex encoded.
func SHA256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// ContractHash recomputes the contract_hash of an ActionContract v1 body:
// SHA-256 hex of the canonical JSON of every field except contract_hash
// itself. The input map is not modified.
func ContractHash(contract map[string]any) (string, error) {
	unsigned := make(map[string]any, len(contract))
	for k, v := range contract {
		if k == "contract_hash" {
			continue
		}
		unsigned[k] = v
	}
	canonical, err := Encode(unsigned)
	if err != nil {
		return "", err
	}
	return SHA256Hex(canonical), nil
}
