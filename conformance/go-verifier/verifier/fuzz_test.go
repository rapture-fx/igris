package verifier

import (
	"bytes"
	"strings"
	"testing"
)

func fuzzSeeds() []string {
	return []string{
		`{}`, `[]`, `null`, `true`, `-0`, `1e2`, `1E+2`, `0.0`,
		`{"a":1,"a":2}`, `{"a":1} x`, `"\ud800"`, `"\udc00\ud800"`,
		`"😀"`, quoted(string(rune(0x2028))), quoted(string(rune(0x2029))),
		`{"z":[1,2,{"y":null}],"a":"text"}`, `"a\tb"`,
		`{"schema_version":"1","event_type":"decision"}`,
		`{"schema_version":"2"}`, "\xff", "{", strings.Repeat("[", 80),
		`9007199254740993`, `123456789012345678901`, `-1.0e-7`,
	}
}

// FuzzParseLegacyJSON asserts the bounded parser never panics and that
// canonical reconstruction is deterministic and a fixed point: canonical
// bytes re-parse and re-encode to themselves.
func FuzzParseLegacyJSON(f *testing.F) {
	for _, seed := range fuzzSeeds() {
		f.Add([]byte(seed))
	}
	limits := DefaultLimits()
	f.Fuzz(func(t *testing.T, data []byte) {
		value, parseErr := ParseLegacyJSON(data, limits)
		if parseErr != nil {
			return
		}
		canonical, canonErr := EncodeLegacyCanonical(value)
		if canonErr != nil {
			return
		}
		again, canonErr2 := EncodeLegacyCanonical(value)
		if canonErr2 != nil || !bytes.Equal(canonical, again) {
			t.Fatalf("canonical reconstruction is not deterministic for %q", data)
		}
		reparsed, reparseErr := ParseLegacyJSON(canonical, limits)
		if reparseErr != nil {
			t.Fatalf("canonical output must re-parse (%q -> %q): %v", data, canonical, reparseErr)
		}
		fixed, fixedErr := EncodeLegacyCanonical(reparsed)
		if fixedErr != nil || !bytes.Equal(canonical, fixed) {
			t.Fatalf("canonical output is not a fixed point (%q -> %q -> %q)", data, canonical, fixed)
		}
	})
}

// FuzzVerifyArtifacts asserts every verification entry point returns a
// well-formed portable result without panicking, for arbitrary input bytes.
func FuzzVerifyArtifacts(f *testing.F) {
	for _, seed := range fuzzSeeds() {
		f.Add([]byte(seed))
	}
	f.Fuzz(func(t *testing.T, data []byte) {
		for _, artifactType := range []ArtifactType{
			ArtifactLegacyValue, ArtifactActionContract, ArtifactEvidenceEvent, ArtifactEvidenceChain,
		} {
			outcome := Verify(Request{Type: artifactType, Input: data})
			if outcome == nil || outcome.Result == nil {
				t.Fatalf("%s: nil result", artifactType)
			}
			if outcome.Result.SchemaID != ResultSchemaID || outcome.Result.Summary == "" {
				t.Fatalf("%s: malformed result identity", artifactType)
			}
			if _, err := outcome.Result.MarshalDeterministic(); err != nil {
				t.Fatalf("%s: result must encode: %v", artifactType, err)
			}
		}
	})
}
