// Package contractv1 holds test-only conformance checks proving that Go can
// reproduce the Embedded SDK's canonical bytes, hashes, and signatures from
// the protocol fixtures in testdata/igris-contract-v1.
//
// This package intentionally contains NO production code and implements NO
// Connected functionality. It exists so the byte-level canonicalization rules
// (sorted keys, compact separators, UTF-8 with no HTML escaping) are pinned
// by an executable test before any Connected endpoint is written. A future
// Connected implementation must reuse these exact rules.
package contractv1

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const fixtureDir = "../../testdata/igris-contract-v1"

// canonicalJSON encodes v exactly like the SDK's canonical form:
// lexicographically sorted keys (Go marshals map keys sorted), compact
// separators, UTF-8 with HTML escaping DISABLED (Python ensure_ascii=false
// emits <, >, & and non-ASCII unescaped; Go's default encoder would emit
// < etc. and break byte, hash, and signature equality).
func canonicalJSON(t *testing.T, v any) []byte {
	t.Helper()
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		t.Fatalf("canonical encode: %v", err)
	}
	return bytes.TrimSuffix(buf.Bytes(), []byte("\n"))
}

// decodePreserving decodes JSON keeping numeric literals intact.
func decodePreserving(t *testing.T, data []byte) map[string]any {
	t.Helper()
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	var out map[string]any
	if err := dec.Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	return out
}

func loadEvents(t *testing.T) [][]byte {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(fixtureDir, "journal.jsonl"))
	if err != nil {
		t.Fatalf("read journal: %v", err)
	}
	var lines [][]byte
	for _, line := range bytes.Split(raw, []byte("\n")) {
		if len(bytes.TrimSpace(line)) > 0 {
			lines = append(lines, line)
		}
	}
	if len(lines) != 5 {
		t.Fatalf("expected 5 fixture events, got %d", len(lines))
	}
	return lines
}

func loadPublicKey(t *testing.T) ed25519.PublicKey {
	t.Helper()
	pemBytes, err := os.ReadFile(filepath.Join(fixtureDir, "verify_key.pem"))
	if err != nil {
		t.Fatalf("read public key: %v", err)
	}
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		t.Fatal("no PEM block in verify_key.pem")
	}
	parsed, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		t.Fatalf("parse public key: %v", err)
	}
	key, ok := parsed.(ed25519.PublicKey)
	if !ok {
		t.Fatalf("verify_key.pem is not Ed25519 (got %T)", parsed)
	}
	return key
}

func unsignedPayload(event map[string]any) map[string]any {
	payload := make(map[string]any, len(event))
	for k, v := range event {
		if k == "event_hash" || k == "signature" {
			continue
		}
		payload[k] = v
	}
	return payload
}

// TestCanonicalBytesMatchPythonReference compares Go-produced canonical bytes
// byte-for-byte with the Python-generated canonical fixture files. Decoded
// JSON equality is NOT sufficient; the protocol is defined in bytes.
func TestCanonicalBytesMatchPythonReference(t *testing.T) {
	events := loadEvents(t)
	refs := map[string]int{
		"decision_approved.canonical.json": 0,
		"outcome_succeeded.canonical.json": 1,
	}
	for name, index := range refs {
		want, err := os.ReadFile(filepath.Join(fixtureDir, "canonical", name))
		if err != nil {
			t.Fatalf("read %s: %v", name, err)
		}
		want = bytes.TrimSuffix(want, []byte("\n"))
		event := decodePreserving(t, events[index])
		got := canonicalJSON(t, unsignedPayload(event))
		if !bytes.Equal(got, want) {
			t.Errorf("%s: Go canonical bytes differ from Python reference\n got: %s\nwant: %s",
				name, got, want)
		}
	}
}

// TestHTMLEscapedEncodingMustDiffer is the negative control: the fixtures
// contain <, >, & precisely so that Go's DEFAULT (HTML-escaping) encoder
// cannot reproduce the canonical bytes. If this test ever fails, the fixture
// coverage regressed and byte-level conformance is no longer being exercised.
func TestHTMLEscapedEncodingMustDiffer(t *testing.T) {
	events := loadEvents(t)
	event := decodePreserving(t, events[0])
	payload := unsignedPayload(event)

	escaped, err := json.Marshal(payload) // default: HTML escaping ON
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	unescaped := canonicalJSON(t, payload)
	if bytes.Equal(escaped, unescaped) {
		t.Fatal("fixture no longer contains HTML-escape-risk characters; " +
			"canonical-byte conformance is not being exercised")
	}
	if !strings.Contains(string(unescaped), "<b>&amp;</b>") {
		t.Fatal("canonical bytes must contain <b>&amp;</b> unescaped")
	}
}

// TestEventHashesAndSignatures recomputes every event hash from Go-produced
// canonical bytes and verifies every Ed25519 signature over the raw digest.
func TestEventHashesAndSignatures(t *testing.T) {
	events := loadEvents(t)
	key := loadPublicKey(t)
	previous := any(nil)
	for i, line := range events {
		event := decodePreserving(t, line)
		canonical := canonicalJSON(t, unsignedPayload(event))
		digest := sha256.Sum256(canonical)

		wantHash, _ := event["event_hash"].(string)
		if got := hex.EncodeToString(digest[:]); got != wantHash {
			t.Fatalf("event %d: recomputed hash %s != stored event_hash %s", i, got, wantHash)
		}

		sig, err := base64.StdEncoding.DecodeString(event["signature"].(string))
		if err != nil {
			t.Fatalf("event %d: signature base64: %v", i, err)
		}
		if !ed25519.Verify(key, digest[:], sig) {
			t.Fatalf("event %d: Ed25519 signature does not verify over the digest", i)
		}

		if got := event["previous_event_hash"]; got != previous {
			t.Fatalf("event %d: previous_event_hash %v != expected chain head %v", i, got, previous)
		}
		previous = wantHash
	}
}

// TestContractHashRecomputation recomputes the ActionContract's contract_hash
// from the contract body (minus contract_hash) and compares it with both the
// embedded value and expected.json — the exact check the first Connected
// slice must perform server-side on every sync request.
func TestContractHashRecomputation(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join(fixtureDir, "action_contract.json"))
	if err != nil {
		t.Fatalf("read contract: %v", err)
	}
	contract := decodePreserving(t, raw)
	stored, _ := contract["contract_hash"].(string)
	delete(contract, "contract_hash")
	digest := sha256.Sum256(canonicalJSON(t, contract))
	recomputed := hex.EncodeToString(digest[:])
	if recomputed != stored {
		t.Fatalf("recomputed contract_hash %s != stored %s", recomputed, stored)
	}

	expectedRaw, err := os.ReadFile(filepath.Join(fixtureDir, "expected.json"))
	if err != nil {
		t.Fatalf("read expected.json: %v", err)
	}
	expected := decodePreserving(t, expectedRaw)
	if want, _ := expected["contract_hash"].(string); want != recomputed {
		t.Fatalf("expected.json contract_hash %s != recomputed %s", want, recomputed)
	}
}
