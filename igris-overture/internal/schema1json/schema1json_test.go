package schema1json

import (
	"bytes"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func TestCanonicalizeHistoricalStringBytes(t *testing.T) {
	raw := []byte("{\"z\":\"quote\\\" slash/ backslash\\\\ controls\\b\\f\\n\\r\\t " +
		"less< greater> amp& bmp café separators \u2028\u2029 supplementary 😀\",\"a\":1}")
	got, err := Canonicalize(raw)
	if err != nil {
		t.Fatal(err)
	}
	want := []byte("{\"a\":1,\"z\":\"quote\\\" slash/ backslash\\\\ controls\\b\\f\\n\\r\\t " +
		"less< greater> amp& bmp café separators \u2028\u2029 supplementary 😀\"}")
	if !bytes.Equal(got, want) {
		t.Fatalf("canonical bytes mismatch\n got: %q\nwant: %q", got, want)
	}
	if bytes.Contains(got, []byte(`\u2028`)) || bytes.Contains(got, []byte(`\u2029`)) {
		t.Fatalf("U+2028/U+2029 were escaped: %q", got)
	}
	if !bytes.Contains(got, []byte{0xE2, 0x80, 0xA8}) || !bytes.Contains(got, []byte{0xE2, 0x80, 0xA9}) {
		t.Fatalf("raw U+2028/U+2029 UTF-8 missing: %x", got)
	}
}

func TestNumberLexemesRemainDistinct(t *testing.T) {
	for _, lexeme := range []string{"1E+2", "1e2", "100", "-0", "0", "0.0", "123456789012345678901234567890"} {
		raw := []byte(`{"number":` + lexeme + `}`)
		got, err := Canonicalize(raw)
		if err != nil {
			t.Fatalf("%s: %v", lexeme, err)
		}
		if string(got) != string(raw) {
			t.Fatalf("%s became %s", raw, got)
		}
	}
}

func TestParserRejectsUnsafeOrMalformedJSON(t *testing.T) {
	tests := map[string][]byte{
		"duplicate member":         []byte(`{"a":1,"a":2}`),
		"decoded duplicate member": []byte(`{"a":1,"\u0061":2}`),
		"invalid UTF-8":            {'{', '"', 'x', '"', ':', '"', 0xff, '"', '}'},
		"trailing content":         []byte(`{} []`),
		"leading plus":             []byte(`{"n":+1}`),
		"leading zero":             []byte(`{"n":01}`),
		"malformed exponent":       []byte(`{"n":1e}`),
		"lone high surrogate":      []byte(`{"s":"\ud800"}`),
		"lone low surrogate":       []byte(`{"s":"\udc00"}`),
	}
	for name, raw := range tests {
		t.Run(name, func(t *testing.T) {
			if _, err := Parse(raw); err == nil {
				t.Fatalf("Parse(%q) unexpectedly succeeded", raw)
			}
		})
	}
}

func TestParsedHostNumbersFailClosed(t *testing.T) {
	for name, value := range map[string]any{
		"float64": float64(100),
		"int":     100,
	} {
		t.Run(name, func(t *testing.T) {
			_, err := Encode(map[string]any{"number": value})
			if !errors.Is(err, ErrUnsupportedLegacyRepresentation) {
				t.Fatalf("got %v, want ErrUnsupportedLegacyRepresentation", err)
			}
		})
	}
}

func TestValidSurrogatePairDecodesToScalar(t *testing.T) {
	got, err := Canonicalize([]byte(`{"s":"\ud83d\ude00"}`))
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != `{"s":"😀"}` {
		t.Fatalf("got %q", got)
	}
}

func TestDepthBound(t *testing.T) {
	raw := []byte(strings.Repeat("[", maxDepth+2) + strings.Repeat("]", maxDepth+2))
	if _, err := Parse(raw); err == nil {
		t.Fatal("excessive nesting unexpectedly accepted")
	}
}

func TestPreservedJSONNumberValidation(t *testing.T) {
	_, err := Encode(map[string]any{"number": json.Number("01")})
	if err == nil {
		t.Fatal("invalid preserved number unexpectedly accepted")
	}
}
