package verifier

import (
	"strings"
	"testing"
)

// This file is deliberately ASCII-only. Every non-ASCII scalar under test is
// constructed programmatically (string(rune(...)) for raw characters,
// jsonEscape(...) for JSON escape text) so the exact tested bytes are
// unambiguous in review.

// jsonEscape returns the six-character JSON escape text \uXXXX.
func jsonEscape(hex string) string {
	return "\\" + "u" + hex
}

// quoted wraps s in JSON string quotes.
func quoted(s string) string { return `"` + s + `"` }

var (
	rawU2028  = string(rune(0x2028))
	rawU2029  = string(rune(0x2029))
	rawEacute = string(rune(0xE9))
	rawEmoji  = string(rune(0x1F600))
)

func mustParse(t *testing.T, input string) *Value {
	t.Helper()
	value, err := ParseLegacyJSON([]byte(input), DefaultLimits())
	if err != nil {
		t.Fatalf("expected %q to parse, got %v", input, err)
	}
	return value
}

func mustCanonical(t *testing.T, input string) string {
	t.Helper()
	canonical, err := EncodeLegacyCanonical(mustParse(t, input))
	if err != nil {
		t.Fatalf("expected %q to canonicalize, got %v", input, err)
	}
	return string(canonical)
}

func expectParseFailure(t *testing.T, input string, failure ParseFailure) {
	t.Helper()
	_, err := ParseLegacyJSON([]byte(input), DefaultLimits())
	if err == nil {
		t.Fatalf("expected %q to be rejected", input)
	}
	if err.Failure != failure {
		t.Fatalf("expected failure %v for %q, got %v (%v)", failure, input, err.Failure, err)
	}
}

func TestParserRejectsInvalidUTF8(t *testing.T) {
	_, err := ParseLegacyJSON([]byte{'"', 0xFF, 0xFE, '"'}, DefaultLimits())
	if err == nil || err.Failure != FailInvalidUTF8 {
		t.Fatalf("expected invalid UTF-8 rejection, got %v", err)
	}
	// Truncated multi-byte sequence inside an otherwise valid document.
	_, err = ParseLegacyJSON([]byte{'{', '"', 'a', 0xC3, '"', ':', '1', '}'}, DefaultLimits())
	if err == nil || err.Failure != FailInvalidUTF8 {
		t.Fatalf("expected truncated UTF-8 rejection, got %v", err)
	}
}

func TestParserRejectsDuplicateMembers(t *testing.T) {
	expectParseFailure(t, `{"a":1,"a":2}`, FailDuplicateMember)
	// Duplicates are detected by decoded name, not raw spelling: a
	// decodes to "a".
	expectParseFailure(t, `{"`+jsonEscape("0061")+`":1,"a":2}`, FailDuplicateMember)
	expectParseFailure(t, `{"x":{"k":1,"k":1}}`, FailDuplicateMember)
}

func TestParserRejectsTrailingContent(t *testing.T) {
	expectParseFailure(t, `{"a":1} x`, FailTrailingContent)
	expectParseFailure(t, `1 2`, FailTrailingContent)
	expectParseFailure(t, `{} {}`, FailTrailingContent)
	expectParseFailure(t, "true\nfalse", FailTrailingContent)
}

func TestParserRejectsMalformedNumbers(t *testing.T) {
	for _, input := range []string{
		"01", "-01", "1.", ".5", "+1", "1e", "1e+", "1E-", "-", "--1",
		"NaN", "Infinity", "-Infinity", "0x10", "1_000",
	} {
		if _, err := ParseLegacyJSON([]byte(input), DefaultLimits()); err == nil {
			t.Fatalf("expected malformed number %q to be rejected", input)
		}
	}
}

func TestParserPreservesNumberLexemes(t *testing.T) {
	cases := map[string]string{
		"100":                    "100",
		"1e2":                    "1e2",
		"1E+2":                   "1E+2",
		"-0":                     "-0",
		"0.0":                    "0.0",
		"9007199254740993":       "9007199254740993",
		"3.141592653589793238":   "3.141592653589793238",
		"-1.0e-7":                "-1.0e-7",
		"123456789012345678901":  "123456789012345678901",
		"0.10000000000000000001": "0.10000000000000000001",
	}
	for input, wanted := range cases {
		if got := mustCanonical(t, input); got != wanted {
			t.Fatalf("lexeme for %q was normalized to %q", input, got)
		}
	}
	// Distinct spellings of the same numeric value stay distinct.
	if mustCanonical(t, "1e2") == mustCanonical(t, "100") {
		t.Fatal("distinct numeric lexemes were conflated")
	}
}

func TestParserBoundedNesting(t *testing.T) {
	limits := DefaultLimits()
	within := strings.Repeat("[", limits.MaxDepth) + strings.Repeat("]", limits.MaxDepth)
	if _, err := ParseLegacyJSON([]byte(within), limits); err != nil {
		t.Fatalf("depth at the limit must parse, got %v", err)
	}
	beyond := strings.Repeat("[", limits.MaxDepth+1) + strings.Repeat("]", limits.MaxDepth+1)
	_, err := ParseLegacyJSON([]byte(beyond), limits)
	if err == nil || err.Failure != FailResourceLimit {
		t.Fatalf("depth beyond the limit must be a resource limit, got %v", err)
	}
}

func TestParserBoundedInputSize(t *testing.T) {
	limits := DefaultLimits()
	oversized := `"` + strings.Repeat("a", limits.MaxInputBytes) + `"`
	_, err := ParseLegacyJSON([]byte(oversized), limits)
	if err == nil || err.Failure != FailResourceLimit {
		t.Fatalf("oversized input must be a resource limit, got %v", err)
	}
}

func TestCanonicalLineSeparatorsStayRaw(t *testing.T) {
	// The historical Python producer emitted U+2028/U+2029 as raw UTF-8:
	// both raw input and escaped input canonicalize to the raw bytes.
	if got := mustCanonical(t, quoted(rawU2028)); got != quoted(rawU2028) {
		t.Fatalf("raw U+2028 was altered: %q", got)
	}
	if got := mustCanonical(t, quoted(rawU2029)); got != quoted(rawU2029) {
		t.Fatalf("raw U+2029 was altered: %q", got)
	}
	if got := mustCanonical(t, quoted(jsonEscape("2028"))); got != quoted(rawU2028) {
		t.Fatalf("escaped U+2028 must canonicalize to raw UTF-8: %q", got)
	}
	if got := mustCanonical(t, quoted(jsonEscape("2029"))); got != quoted(rawU2029) {
		t.Fatalf("escaped U+2029 must canonicalize to raw UTF-8: %q", got)
	}
}

func TestCanonicalStringEscapes(t *testing.T) {
	backslash := "\\"
	cases := []struct{ input, wanted string }{
		{`"<>&/"`, `"<>&/"`},                                                     // never HTML-escaped
		{quoted(backslash + "/"), `"/"`},                                         // escaped solidus becomes raw
		{quoted(jsonEscape("00e9")), quoted(rawEacute)},                          // BMP escape becomes raw UTF-8
		{quoted(jsonEscape("d83d") + jsonEscape("de00")), quoted(rawEmoji)},      // surrogate pair becomes raw UTF-8
		{quoted(rawEmoji), quoted(rawEmoji)},                                     // raw astral scalar passes through
		{quoted(rawEacute), quoted(rawEacute)},                                   // raw BMP scalar passes through
		{quoted(`a` + backslash + `tb`), quoted(`a` + backslash + `tb`)},         // short escape preserved
		{quoted("a" + jsonEscape("0009") + "b"), quoted(`a` + backslash + `tb`)}, // long tab escape becomes short
		{quoted(jsonEscape("0001")), quoted(jsonEscape("0001"))},                 // control stays escaped
		{quoted(jsonEscape("001F")), quoted(jsonEscape("001f"))},                 // uppercase hex becomes lowercase
		{quoted(jsonEscape("0022")), quoted(backslash + `"`)},                    // escaped quote normalizes
		{quoted(jsonEscape("005C")), quoted(backslash + backslash)},              // escaped backslash normalizes
	}
	for _, c := range cases {
		if got := mustCanonical(t, c.input); got != c.wanted {
			t.Fatalf("canonical of %q: expected %q, got %q", c.input, c.wanted, got)
		}
	}
}

func TestCanonicalSortsKeysByScalar(t *testing.T) {
	input := `{"b":1,"a":2,` + quoted(rawEacute) + `:3,"Z":4}`
	wanted := `{"Z":4,"a":2,"b":1,` + quoted(rawEacute) + `:3}`
	if got := mustCanonical(t, input); got != wanted {
		t.Fatalf("unexpected key order: %q", got)
	}
	// A non-ASCII BMP key sorts after ASCII keys by Unicode scalar value,
	// and an astral key sorts after the BMP key.
	input = `{` + quoted(rawEmoji) + `:1,` + quoted(rawEacute) + `:2,"z":3}`
	wanted = `{"z":3,` + quoted(rawEacute) + `:2,` + quoted(rawEmoji) + `:1}`
	if got := mustCanonical(t, input); got != wanted {
		t.Fatalf("unexpected scalar sort order: %q", got)
	}
}

func TestLoneSurrogateFailsCanonicalizationNotParse(t *testing.T) {
	for _, input := range []string{
		quoted(jsonEscape("d800")),                      // lone high surrogate
		quoted(jsonEscape("dc00")),                      // lone low surrogate
		quoted(jsonEscape("d800") + "\\" + "t"),         // high surrogate then a normal escape
		quoted(jsonEscape("d800") + jsonEscape("d800")), // high surrogate then another high
		quoted(jsonEscape("d800") + "x"),                // high surrogate then a plain character
		`{` + quoted(jsonEscape("dc00")) + `:1}`,        // lone surrogate in a member name
		`["ok",` + quoted(jsonEscape("d800")) + `]`,     // nested inside an array
	} {
		value, parseErr := ParseLegacyJSON([]byte(input), DefaultLimits())
		if parseErr != nil {
			t.Fatalf("lone surrogate input %q must parse syntactically, got %v", input, parseErr)
		}
		_, canonErr := EncodeLegacyCanonical(value)
		if canonErr == nil || canonErr.Failure != CanonInvalidScalar {
			t.Fatalf("lone surrogate input %q must fail canonicalization, got %v", input, canonErr)
		}
	}
}

func TestLostLexemeFailsClosed(t *testing.T) {
	value := mustParse(t, `{"n":1.50}`)
	ClearNumberLexemes(value)
	_, err := EncodeLegacyCanonical(value)
	if err == nil || err.Failure != CanonLexemeLost {
		t.Fatalf("lost lexeme must fail closed, got %v", err)
	}
}

func TestCanonicalDeterminism(t *testing.T) {
	input := `{"z":[1e2,-0,{"b":` + quoted(rawU2028) + `},null,true],"a":"text"}`
	first := mustCanonical(t, input)
	second := mustCanonical(t, input)
	if first != second {
		t.Fatal("canonical reconstruction is not deterministic")
	}
	// Canonical output re-parses to the same canonical bytes (fixed point).
	if again := mustCanonical(t, first); again != first {
		t.Fatalf("canonical output is not a fixed point: %q vs %q", first, again)
	}
}

func TestParserRejectsRawControlAndBadEscapes(t *testing.T) {
	rawControl := `"a` + string(rune(0x01)) + `b"`
	for _, input := range []string{
		rawControl, `"abc`, `{"a"`, `[1,`,
		quoted("\\" + "x41"), quoted("\\" + "u12"), quoted("\\" + "uZZZZ"),
		`tru`, `nul`, `{,}`, `[,]`, `{"a":}`, `{"a" 1}`, "", "   ",
	} {
		if _, err := ParseLegacyJSON([]byte(input), DefaultLimits()); err == nil {
			t.Fatalf("expected %q to be rejected", input)
		}
	}
}
