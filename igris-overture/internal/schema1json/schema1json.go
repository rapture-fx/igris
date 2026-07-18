// Package schema1json implements the exact historical JSON reconstruction
// profile used by Igris schema 1. It is intentionally separate from future
// canonical JSON profiles: schema-1 signatures commit to Python 0.1.0a2's
// bytes, including raw UTF-8 U+2028/U+2029 and the original JSON number token.
package schema1json

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
	"sort"
	"strconv"
	"unicode/utf8"
)

const maxDepth = 64

var jsonNumberPattern = regexp.MustCompile(`^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$`)

// ErrUnsupportedLegacyRepresentation means the caller supplied a semantic
// host-language value after the original schema-1 representation was lost.
// Verification must fail closed instead of guessing which number token was
// signed.
var ErrUnsupportedLegacyRepresentation = errors.New("unsupported schema-1 legacy representation")

// ErrMaximumDepth identifies the bounded-parser resource limit so API layers
// can preserve their existing validation status without string matching.
var ErrMaximumDepth = errors.New("schema-1 JSON maximum depth exceeded")

// Parse decodes one JSON value while preserving number token lexemes,
// rejecting duplicate object members, invalid UTF-8, lone Unicode surrogates,
// excessive nesting, malformed JSON, and trailing content.
func Parse(data []byte) (any, error) {
	if !utf8.Valid(data) {
		return nil, errors.New("schema-1 JSON is not valid UTF-8")
	}
	if err := validateUnicodeEscapes(data); err != nil {
		return nil, err
	}

	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	value, err := decodeValue(decoder, 0)
	if err != nil {
		return nil, err
	}
	if _, err := decoder.Token(); !errors.Is(err, io.EOF) {
		if err == nil {
			return nil, errors.New("unexpected trailing JSON content")
		}
		return nil, fmt.Errorf("unexpected trailing JSON content: %w", err)
	}
	return value, nil
}

// DecodeObject decodes one schema-1 JSON object with Parse's safety and
// lexical-preservation guarantees.
func DecodeObject(data []byte) (map[string]any, error) {
	value, err := Parse(data)
	if err != nil {
		return nil, err
	}
	object, ok := value.(map[string]any)
	if !ok {
		return nil, errors.New("schema-1 JSON value is not an object")
	}
	return object, nil
}

func decodeValue(decoder *json.Decoder, depth int) (any, error) {
	if depth > maxDepth {
		return nil, fmt.Errorf("%w: limit %d", ErrMaximumDepth, maxDepth)
	}
	token, err := decoder.Token()
	if err != nil {
		return nil, err
	}

	switch value := token.(type) {
	case json.Delim:
		switch value {
		case '{':
			object := make(map[string]any)
			for decoder.More() {
				keyToken, err := decoder.Token()
				if err != nil {
					return nil, err
				}
				key, ok := keyToken.(string)
				if !ok {
					return nil, errors.New("schema-1 object member name is not a string")
				}
				if _, duplicate := object[key]; duplicate {
					return nil, fmt.Errorf("duplicate schema-1 object member %q", key)
				}
				member, err := decodeValue(decoder, depth+1)
				if err != nil {
					return nil, err
				}
				object[key] = member
			}
			end, err := decoder.Token()
			if err != nil || end != json.Delim('}') {
				return nil, errors.New("malformed schema-1 JSON object")
			}
			return object, nil
		case '[':
			array := make([]any, 0)
			for decoder.More() {
				member, err := decodeValue(decoder, depth+1)
				if err != nil {
					return nil, err
				}
				array = append(array, member)
			}
			end, err := decoder.Token()
			if err != nil || end != json.Delim(']') {
				return nil, errors.New("malformed schema-1 JSON array")
			}
			return array, nil
		default:
			return nil, errors.New("unexpected schema-1 JSON delimiter")
		}
	case json.Number:
		if !jsonNumberPattern.MatchString(string(value)) {
			return nil, fmt.Errorf("invalid schema-1 JSON number %q", value)
		}
		return value, nil
	case string, bool, nil:
		return value, nil
	default:
		return nil, fmt.Errorf("unexpected schema-1 JSON token %T", token)
	}
}

// Encode reconstructs the exact historical schema-1 JSON bytes. Numeric host
// values are deliberately unsupported because their original token lexemes
// are unrecoverable; callers must parse raw input with Parse or DecodeObject.
func Encode(value any) ([]byte, error) {
	var out bytes.Buffer
	if err := encodeValue(&out, value, 0); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

// Canonicalize parses untrusted JSON and reconstructs exact schema-1 bytes.
func Canonicalize(data []byte) ([]byte, error) {
	value, err := Parse(data)
	if err != nil {
		return nil, err
	}
	return Encode(value)
}

func encodeValue(out *bytes.Buffer, value any, depth int) error {
	if depth > maxDepth {
		return fmt.Errorf("%w: limit %d", ErrMaximumDepth, maxDepth)
	}
	switch typed := value.(type) {
	case nil:
		out.WriteString("null")
	case bool:
		if typed {
			out.WriteString("true")
		} else {
			out.WriteString("false")
		}
	case string:
		if err := writeString(out, typed); err != nil {
			return err
		}
	case json.Number:
		lexeme := string(typed)
		if !jsonNumberPattern.MatchString(lexeme) {
			return fmt.Errorf("invalid preserved schema-1 JSON number %q", lexeme)
		}
		out.WriteString(lexeme)
	case map[string]any:
		keys := make([]string, 0, len(typed))
		for key := range typed {
			if !utf8.ValidString(key) {
				return errors.New("schema-1 object key is not valid UTF-8")
			}
			keys = append(keys, key)
		}
		sort.Strings(keys)
		out.WriteByte('{')
		for index, key := range keys {
			if index > 0 {
				out.WriteByte(',')
			}
			if err := writeString(out, key); err != nil {
				return err
			}
			out.WriteByte(':')
			if err := encodeValue(out, typed[key], depth+1); err != nil {
				return err
			}
		}
		out.WriteByte('}')
	case []any:
		out.WriteByte('[')
		for index, member := range typed {
			if index > 0 {
				out.WriteByte(',')
			}
			if err := encodeValue(out, member, depth+1); err != nil {
				return err
			}
		}
		out.WriteByte(']')
	default:
		return fmt.Errorf("%w: cannot encode %T", ErrUnsupportedLegacyRepresentation, value)
	}
	return nil
}

func writeString(out *bytes.Buffer, value string) error {
	if !utf8.ValidString(value) {
		return errors.New("schema-1 string is not valid UTF-8")
	}
	out.WriteByte('"')
	for _, character := range value {
		switch character {
		case '"':
			out.WriteString(`\"`)
		case '\\':
			out.WriteString(`\\`)
		case '\b':
			out.WriteString(`\b`)
		case '\f':
			out.WriteString(`\f`)
		case '\n':
			out.WriteString(`\n`)
		case '\r':
			out.WriteString(`\r`)
		case '\t':
			out.WriteString(`\t`)
		default:
			if character < 0x20 {
				fmt.Fprintf(out, `\u%04x`, character)
			} else {
				out.WriteRune(character)
			}
		}
	}
	out.WriteByte('"')
	return nil
}

func validateUnicodeEscapes(data []byte) error {
	for index := 0; index < len(data); index++ {
		if data[index] != '"' {
			continue
		}
		for index++; index < len(data); index++ {
			switch data[index] {
			case '"':
				goto stringDone
			case '\\':
				if index+1 >= len(data) {
					return errors.New("unterminated schema-1 JSON escape")
				}
				if data[index+1] != 'u' {
					index++
					continue
				}
				first, err := unicodeEscape(data, index)
				if err != nil {
					return err
				}
				if first >= 0xD800 && first <= 0xDBFF {
					secondStart := index + 6
					if secondStart+5 >= len(data) || data[secondStart] != '\\' || data[secondStart+1] != 'u' {
						return errors.New("unpaired high surrogate in schema-1 JSON string")
					}
					second, err := unicodeEscape(data, secondStart)
					if err != nil || second < 0xDC00 || second > 0xDFFF {
						return errors.New("unpaired high surrogate in schema-1 JSON string")
					}
					index = secondStart + 5
				} else if first >= 0xDC00 && first <= 0xDFFF {
					return errors.New("unpaired low surrogate in schema-1 JSON string")
				} else {
					index += 5
				}
			default:
				if data[index] < 0x20 {
					return errors.New("unescaped control character in schema-1 JSON string")
				}
			}
		}
		return errors.New("unterminated schema-1 JSON string")
	stringDone:
	}
	return nil
}

func unicodeEscape(data []byte, slash int) (uint64, error) {
	if slash+5 >= len(data) || data[slash] != '\\' || data[slash+1] != 'u' {
		return 0, errors.New("malformed schema-1 Unicode escape")
	}
	value, err := strconv.ParseUint(string(data[slash+2:slash+6]), 16, 16)
	if err != nil {
		return 0, errors.New("malformed schema-1 Unicode escape")
	}
	return value, nil
}

// SHA256Hex returns lowercase SHA-256 over exact bytes.
func SHA256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// ContractHash reconstructs the ActionContract schema-1 unsigned body.
func ContractHash(contract map[string]any) (string, error) {
	unsigned := make(map[string]any, len(contract))
	for key, value := range contract {
		if key != "contract_hash" {
			unsigned[key] = value
		}
	}
	canonical, err := Encode(unsigned)
	if err != nil {
		return "", err
	}
	return SHA256Hex(canonical), nil
}
