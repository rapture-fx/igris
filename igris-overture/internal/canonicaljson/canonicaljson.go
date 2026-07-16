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

import "github.com/Igris-inertial/system/igris-overture/internal/schema1json"

// Encode serializes v as canonical contract-v1 JSON bytes.
//
// The implementation lives in schema1json so verification, Connected ingest,
// and this compatibility facade cannot drift.
func Encode(v any) ([]byte, error) {
	return schema1json.Encode(v)
}

// DecodeObjectPreserving retains numeric token lexemes and applies the shared
// schema-1 hostile-input parser rules.
func DecodeObjectPreserving(data []byte) (map[string]any, error) {
	return schema1json.DecodeObject(data)
}

// SHA256Hex is the contract-v1 hash rule: SHA-256 over canonical bytes,
// lowercase hex encoded.
func SHA256Hex(data []byte) string {
	return schema1json.SHA256Hex(data)
}

// ContractHash recomputes the contract_hash of an ActionContract v1 body:
// SHA-256 hex of the canonical JSON of every field except contract_hash
// itself. The input map is not modified.
func ContractHash(contract map[string]any) (string, error) {
	return schema1json.ContractHash(contract)
}
