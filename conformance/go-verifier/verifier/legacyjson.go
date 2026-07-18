// Package verifier is the standalone Igris schema-1 verification core.
//
// It is implemented directly from the frozen protocol artifacts (RFC 003/007,
// RD-11, the verification-result draft, and the frozen suite-schema-1
// vectors). It deliberately does not import or reuse any maintained
// production verification package and depends only on the Go standard
// library.
package verifier

import (
	"fmt"
	"sort"
	"strings"
	"unicode/utf8"
)

// ValueKind enumerates the schema-1 legacy JSON data model.
type ValueKind int

const (
	KindNull ValueKind = iota
	KindBool
	KindNumber
	KindString
	KindArray
	KindObject
)

// Value is one parsed legacy JSON value. Number tokens keep their exact
// original lexeme so canonical reconstruction can re-emit the signed bytes
// verbatim. Strings that contained lone surrogate escapes are syntactically
// parseable but flagged; canonical reconstruction fails closed on them.
type Value struct {
	Kind      ValueKind
	Bool      bool
	Lexeme    string // exact original number token; empty means lost
	Str       string // decoded string content (lone surrogates as 3-byte encodings)
	BadScalar bool   // string content contains a lone surrogate
	Arr       []*Value
	Members   []Member // object members in input order
}

// Member is one object member with its decoded name.
type Member struct {
	Name          string
	NameBadScalar bool
	Value         *Value
}

// Lookup returns the named member value, or nil.
func (v *Value) Lookup(name string) *Value {
	for i := range v.Members {
		if v.Members[i].Name == name {
			return v.Members[i].Value
		}
	}
	return nil
}

// ParseFailure classifies a bounded parse rejection for verification-result
// mapping.
type ParseFailure int

const (
	FailMalformed ParseFailure = iota
	FailInvalidUTF8
	FailDuplicateMember
	FailTrailingContent
	FailResourceLimit
)

// ParseError is a typed bounded-parser rejection.
type ParseError struct {
	Failure ParseFailure
	Offset  int
	reason  string
}

func (e *ParseError) Error() string {
	return fmt.Sprintf("legacy JSON parse failure at byte %d: %s", e.Offset, e.reason)
}

// CanonFailure classifies a canonical-reconstruction rejection.
type CanonFailure int

const (
	CanonInvalidScalar CanonFailure = iota
	CanonLexemeLost
)

// CanonError is a typed canonical-reconstruction rejection.
type CanonError struct {
	Failure CanonFailure
}

func (e *CanonError) Error() string {
	if e.Failure == CanonLexemeLost {
		return "canonical reconstruction requires a number lexeme that was not preserved"
	}
	return "value contains a code point excluded by the schema-1 canonical profile"
}

type legacyParser struct {
	in     []byte
	pos    int
	depth  int
	limits Limits
}

// ParseLegacyJSON parses exactly one schema-1 legacy JSON value from raw
// bytes. It accepts valid UTF-8 only, rejects duplicate object members by
// decoded name, rejects trailing non-whitespace content, enforces the bounded
// nesting limit, and preserves every accepted number token lexeme.
func ParseLegacyJSON(raw []byte, limits Limits) (*Value, *ParseError) {
	if limits.MaxInputBytes > 0 && len(raw) > limits.MaxInputBytes {
		return nil, &ParseError{Failure: FailResourceLimit, reason: "input exceeds the bounded size limit"}
	}
	if !utf8.Valid(raw) {
		return nil, &ParseError{Failure: FailInvalidUTF8, reason: "input is not valid UTF-8"}
	}
	p := &legacyParser{in: raw, limits: limits}
	p.skipWhitespace()
	value, err := p.parseValue()
	if err != nil {
		return nil, err
	}
	p.skipWhitespace()
	if p.pos != len(p.in) {
		return nil, &ParseError{Failure: FailTrailingContent, Offset: p.pos, reason: "non-whitespace content follows the top-level value"}
	}
	return value, nil
}

func (p *legacyParser) fail(failure ParseFailure, reason string) *ParseError {
	return &ParseError{Failure: failure, Offset: p.pos, reason: reason}
}

func (p *legacyParser) skipWhitespace() {
	for p.pos < len(p.in) {
		switch p.in[p.pos] {
		case ' ', '\t', '\n', '\r':
			p.pos++
		default:
			return
		}
	}
}

func (p *legacyParser) parseValue() (*Value, *ParseError) {
	if p.pos >= len(p.in) {
		return nil, p.fail(FailMalformed, "unexpected end of input")
	}
	switch c := p.in[p.pos]; {
	case c == '{':
		return p.parseObject()
	case c == '[':
		return p.parseArray()
	case c == '"':
		content, bad, err := p.parseString()
		if err != nil {
			return nil, err
		}
		return &Value{Kind: KindString, Str: content, BadScalar: bad}, nil
	case c == 't':
		if err := p.expectLiteral("true"); err != nil {
			return nil, err
		}
		return &Value{Kind: KindBool, Bool: true}, nil
	case c == 'f':
		if err := p.expectLiteral("false"); err != nil {
			return nil, err
		}
		return &Value{Kind: KindBool, Bool: false}, nil
	case c == 'n':
		if err := p.expectLiteral("null"); err != nil {
			return nil, err
		}
		return &Value{Kind: KindNull}, nil
	case c == '-' || (c >= '0' && c <= '9'):
		return p.parseNumber()
	default:
		return nil, p.fail(FailMalformed, "unexpected byte at value position")
	}
}

func (p *legacyParser) expectLiteral(literal string) *ParseError {
	if !strings.HasPrefix(string(p.in[p.pos:]), literal) {
		return p.fail(FailMalformed, "invalid literal")
	}
	p.pos += len(literal)
	return nil
}

func (p *legacyParser) enter() *ParseError {
	p.depth++
	if p.limits.MaxDepth > 0 && p.depth > p.limits.MaxDepth {
		return p.fail(FailResourceLimit, "container nesting exceeds the bounded depth limit")
	}
	return nil
}

func (p *legacyParser) parseObject() (*Value, *ParseError) {
	if err := p.enter(); err != nil {
		return nil, err
	}
	p.pos++ // consume '{'
	object := &Value{Kind: KindObject}
	seen := make(map[string]struct{})
	p.skipWhitespace()
	if p.pos < len(p.in) && p.in[p.pos] == '}' {
		p.pos++
		p.depth--
		return object, nil
	}
	for {
		p.skipWhitespace()
		if p.pos >= len(p.in) || p.in[p.pos] != '"' {
			return nil, p.fail(FailMalformed, "object member name must be a string")
		}
		name, nameBad, err := p.parseString()
		if err != nil {
			return nil, err
		}
		if _, duplicate := seen[name]; duplicate {
			return nil, p.fail(FailDuplicateMember, "duplicate decoded member name")
		}
		seen[name] = struct{}{}
		p.skipWhitespace()
		if p.pos >= len(p.in) || p.in[p.pos] != ':' {
			return nil, p.fail(FailMalformed, "expected ':' after member name")
		}
		p.pos++
		p.skipWhitespace()
		value, err := p.parseValue()
		if err != nil {
			return nil, err
		}
		object.Members = append(object.Members, Member{Name: name, NameBadScalar: nameBad, Value: value})
		p.skipWhitespace()
		if p.pos >= len(p.in) {
			return nil, p.fail(FailMalformed, "unterminated object")
		}
		switch p.in[p.pos] {
		case ',':
			p.pos++
		case '}':
			p.pos++
			p.depth--
			return object, nil
		default:
			return nil, p.fail(FailMalformed, "expected ',' or '}' in object")
		}
	}
}

func (p *legacyParser) parseArray() (*Value, *ParseError) {
	if err := p.enter(); err != nil {
		return nil, err
	}
	p.pos++ // consume '['
	array := &Value{Kind: KindArray, Arr: []*Value{}}
	p.skipWhitespace()
	if p.pos < len(p.in) && p.in[p.pos] == ']' {
		p.pos++
		p.depth--
		return array, nil
	}
	for {
		p.skipWhitespace()
		value, err := p.parseValue()
		if err != nil {
			return nil, err
		}
		array.Arr = append(array.Arr, value)
		p.skipWhitespace()
		if p.pos >= len(p.in) {
			return nil, p.fail(FailMalformed, "unterminated array")
		}
		switch p.in[p.pos] {
		case ',':
			p.pos++
		case ']':
			p.pos++
			p.depth--
			return array, nil
		default:
			return nil, p.fail(FailMalformed, "expected ',' or ']' in array")
		}
	}
}

// parseString decodes one JSON string token. Lone surrogate escapes are
// decoded to their 3-byte code-point encoding and flagged instead of being
// rejected: the frozen suite pins them as a canonicalization failure
// (invalid_unicode_scalar), not a parse failure.
func (p *legacyParser) parseString() (string, bool, *ParseError) {
	p.pos++ // consume opening quote
	var out strings.Builder
	badScalar := false
	for {
		if p.pos >= len(p.in) {
			return "", false, p.fail(FailMalformed, "unterminated string")
		}
		c := p.in[p.pos]
		switch {
		case c == '"':
			p.pos++
			return out.String(), badScalar, nil
		case c == '\\':
			p.pos++
			if p.pos >= len(p.in) {
				return "", false, p.fail(FailMalformed, "unterminated escape sequence")
			}
			switch p.in[p.pos] {
			case '"':
				out.WriteByte('"')
			case '\\':
				out.WriteByte('\\')
			case '/':
				out.WriteByte('/')
			case 'b':
				out.WriteByte('\b')
			case 'f':
				out.WriteByte('\f')
			case 'n':
				out.WriteByte('\n')
			case 'r':
				out.WriteByte('\r')
			case 't':
				out.WriteByte('\t')
			case 'u':
				code, err := p.parseHex4()
				if err != nil {
					return "", false, err
				}
				switch {
				case code >= 0xD800 && code <= 0xDBFF:
					// High surrogate: a valid low-surrogate escape must follow.
					if p.pos+1 < len(p.in) && p.in[p.pos] == '\\' && p.in[p.pos+1] == 'u' {
						savedPos := p.pos
						// Step past the backslash so parseHex4 sees the 'u'
						// exactly as in the primary escape path.
						p.pos++
						low, err := p.parseHex4()
						if err != nil {
							return "", false, err
						}
						if low >= 0xDC00 && low <= 0xDFFF {
							scalar := 0x10000 + (code-0xD800)<<10 + (low - 0xDC00)
							out.WriteRune(rune(scalar))
							continue
						}
						// Not a low surrogate: the first escape is a lone
						// surrogate and the second stands on its own.
						p.pos = savedPos
					}
					writeSurrogateBytes(&out, code)
					badScalar = true
				case code >= 0xDC00 && code <= 0xDFFF:
					writeSurrogateBytes(&out, code)
					badScalar = true
				default:
					out.WriteRune(rune(code))
				}
				continue
			default:
				return "", false, p.fail(FailMalformed, "invalid escape sequence")
			}
			p.pos++
		case c < 0x20:
			return "", false, p.fail(FailMalformed, "raw control character in string")
		default:
			_, size := utf8.DecodeRune(p.in[p.pos:])
			out.Write(p.in[p.pos : p.pos+size])
			p.pos += size
		}
	}
}

// writeSurrogateBytes records a lone surrogate code point using the generic
// 3-byte encoding so decoded-name duplicate comparison stays exact. The bytes
// never reach canonical output: canonical reconstruction rejects flagged
// strings first.
func writeSurrogateBytes(out *strings.Builder, code int) {
	out.WriteByte(byte(0xE0 | (code >> 12)))
	out.WriteByte(byte(0x80 | ((code >> 6) & 0x3F)))
	out.WriteByte(byte(0x80 | (code & 0x3F)))
}

func (p *legacyParser) parseHex4() (int, *ParseError) {
	p.pos++ // consume 'u'
	if p.pos+4 > len(p.in) {
		return 0, p.fail(FailMalformed, "truncated \\u escape")
	}
	code := 0
	for i := 0; i < 4; i++ {
		c := p.in[p.pos+i]
		switch {
		case c >= '0' && c <= '9':
			code = code<<4 | int(c-'0')
		case c >= 'a' && c <= 'f':
			code = code<<4 | int(c-'a'+10)
		case c >= 'A' && c <= 'F':
			code = code<<4 | int(c-'A'+10)
		default:
			return 0, p.fail(FailMalformed, "invalid \\u escape digits")
		}
	}
	p.pos += 4
	return code, nil
}

// parseNumber accepts the strict JSON number grammar
// -?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)? and records the exact
// lexeme. Leading plus, leading zero, incomplete decimals, NaN, Infinity, and
// malformed exponents are all malformed input.
func (p *legacyParser) parseNumber() (*Value, *ParseError) {
	start := p.pos
	if p.in[p.pos] == '-' {
		p.pos++
	}
	if p.pos >= len(p.in) {
		return nil, p.fail(FailMalformed, "truncated number")
	}
	switch {
	case p.in[p.pos] == '0':
		p.pos++
		if p.pos < len(p.in) && p.in[p.pos] >= '0' && p.in[p.pos] <= '9' {
			return nil, p.fail(FailMalformed, "leading zero in number")
		}
	case p.in[p.pos] >= '1' && p.in[p.pos] <= '9':
		for p.pos < len(p.in) && p.in[p.pos] >= '0' && p.in[p.pos] <= '9' {
			p.pos++
		}
	default:
		return nil, p.fail(FailMalformed, "invalid number start")
	}
	if p.pos < len(p.in) && p.in[p.pos] == '.' {
		p.pos++
		if p.pos >= len(p.in) || p.in[p.pos] < '0' || p.in[p.pos] > '9' {
			return nil, p.fail(FailMalformed, "incomplete decimal fraction")
		}
		for p.pos < len(p.in) && p.in[p.pos] >= '0' && p.in[p.pos] <= '9' {
			p.pos++
		}
	}
	if p.pos < len(p.in) && (p.in[p.pos] == 'e' || p.in[p.pos] == 'E') {
		p.pos++
		if p.pos < len(p.in) && (p.in[p.pos] == '+' || p.in[p.pos] == '-') {
			p.pos++
		}
		if p.pos >= len(p.in) || p.in[p.pos] < '0' || p.in[p.pos] > '9' {
			return nil, p.fail(FailMalformed, "malformed exponent")
		}
		for p.pos < len(p.in) && p.in[p.pos] >= '0' && p.in[p.pos] <= '9' {
			p.pos++
		}
	}
	return &Value{Kind: KindNumber, Lexeme: string(p.in[start:p.pos])}, nil
}

// EncodeLegacyCanonical reconstructs the exact schema-1 canonical bytes for a
// parsed value: object keys sorted by Unicode scalar sequence, compact
// separators, raw UTF-8 for all non-ASCII scalars including U+2028/U+2029,
// the fixed short escapes plus lowercase \u00xx for remaining controls, and
// every number emitted as its preserved original lexeme.
func EncodeLegacyCanonical(v *Value) ([]byte, *CanonError) {
	var out []byte
	var encode func(v *Value) *CanonError
	encode = func(v *Value) *CanonError {
		switch v.Kind {
		case KindNull:
			out = append(out, "null"...)
		case KindBool:
			if v.Bool {
				out = append(out, "true"...)
			} else {
				out = append(out, "false"...)
			}
		case KindNumber:
			if v.Lexeme == "" {
				return &CanonError{Failure: CanonLexemeLost}
			}
			out = append(out, v.Lexeme...)
		case KindString:
			if v.BadScalar {
				return &CanonError{Failure: CanonInvalidScalar}
			}
			out = appendCanonicalString(out, v.Str)
		case KindArray:
			out = append(out, '[')
			for i, item := range v.Arr {
				if i > 0 {
					out = append(out, ',')
				}
				if err := encode(item); err != nil {
					return err
				}
			}
			out = append(out, ']')
		case KindObject:
			members := make([]Member, len(v.Members))
			copy(members, v.Members)
			sort.SliceStable(members, func(i, j int) bool {
				return members[i].Name < members[j].Name
			})
			out = append(out, '{')
			for i, member := range members {
				if i > 0 {
					out = append(out, ',')
				}
				if member.NameBadScalar {
					return &CanonError{Failure: CanonInvalidScalar}
				}
				out = appendCanonicalString(out, member.Name)
				out = append(out, ':')
				if err := encode(member.Value); err != nil {
					return err
				}
			}
			out = append(out, '}')
		}
		return nil
	}
	if err := encode(v); err != nil {
		return nil, err
	}
	return out, nil
}

const hexDigits = "0123456789abcdef"

func appendCanonicalString(out []byte, s string) []byte {
	out = append(out, '"')
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c == '"':
			out = append(out, '\\', '"')
		case c == '\\':
			out = append(out, '\\', '\\')
		case c == '\b':
			out = append(out, '\\', 'b')
		case c == '\t':
			out = append(out, '\\', 't')
		case c == '\n':
			out = append(out, '\\', 'n')
		case c == '\f':
			out = append(out, '\\', 'f')
		case c == '\r':
			out = append(out, '\\', 'r')
		case c < 0x20:
			out = append(out, '\\', 'u', '0', '0', hexDigits[c>>4], hexDigits[c&0x0F])
		default:
			// Raw UTF-8 passthrough, including U+2028, U+2029, <, >, &, /.
			out = append(out, c)
		}
	}
	return append(out, '"')
}

// ClearNumberLexemes simulates a host environment that coerced numeric tokens
// and lost their original spellings. It exists only so the conformance
// capability-failure vector can prove the verifier fails closed; production
// verification never calls it.
func ClearNumberLexemes(v *Value) {
	switch v.Kind {
	case KindNumber:
		v.Lexeme = ""
	case KindArray:
		for _, item := range v.Arr {
			ClearNumberLexemes(item)
		}
	case KindObject:
		for i := range v.Members {
			ClearNumberLexemes(v.Members[i].Value)
		}
	}
}
