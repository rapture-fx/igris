// Byte-level conformance of the PRODUCTION canonicalizer against the
// Python-generated protocol fixtures. This mirrors the test-only reference in
// conformance/contractv1 (which stays unchanged) but exercises the exact code
// path POST /v1/contracts/sync uses to recompute contract hashes.
package canonicaljson

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const fixtureDir = "../../../testdata/igris-contract-v1"

func loadFixtureEvents(t *testing.T) [][]byte {
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

func TestEncodeMatchesPythonCanonicalBytes(t *testing.T) {
	events := loadFixtureEvents(t)
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

		event, err := DecodeObjectPreserving(events[index])
		if err != nil {
			t.Fatalf("decode event %d: %v", index, err)
		}
		payload := make(map[string]any, len(event))
		for k, v := range event {
			if k == "event_hash" || k == "signature" {
				continue
			}
			payload[k] = v
		}
		got, err := Encode(payload)
		if err != nil {
			t.Fatalf("encode: %v", err)
		}
		if !bytes.Equal(got, want) {
			t.Errorf("%s: production canonical bytes differ from Python reference\n got: %s\nwant: %s",
				name, got, want)
		}
	}
}

func TestEncodeDoesNotHTMLEscape(t *testing.T) {
	got, err := Encode(map[string]any{"k": `<b>&amp;</b> "quoted" back\slash`})
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	if !strings.Contains(string(got), "<b>&amp;</b>") {
		t.Fatalf("canonical bytes must contain <b>&amp;</b> unescaped, got %s", got)
	}
	escaped, err := json.Marshal(map[string]any{"k": `<b>&amp;</b> "quoted" back\slash`})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if bytes.Equal(got, escaped) {
		t.Fatal("Encode must differ from Go's default HTML-escaping encoder for <, >, &")
	}
}

func TestContractHashRecomputesFixtureContract(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join(fixtureDir, "action_contract.json"))
	if err != nil {
		t.Fatalf("read contract: %v", err)
	}
	contract, err := DecodeObjectPreserving(raw)
	if err != nil {
		t.Fatalf("decode contract: %v", err)
	}
	stored, _ := contract["contract_hash"].(string)
	if stored == "" {
		t.Fatal("fixture contract has no contract_hash")
	}

	recomputed, err := ContractHash(contract)
	if err != nil {
		t.Fatalf("recompute: %v", err)
	}
	if recomputed != stored {
		t.Fatalf("recomputed contract_hash %s != stored %s", recomputed, stored)
	}
	if _, tampered := contract["contract_hash"]; !tampered {
		t.Fatal("ContractHash must not mutate its input map")
	}

	// A tampered body must produce a different hash (mismatch detection).
	contract["risk"] = "low"
	changed, err := ContractHash(contract)
	if err != nil {
		t.Fatalf("recompute tampered: %v", err)
	}
	if changed == stored {
		t.Fatal("tampering with the contract body must change the recomputed hash")
	}
}

func TestDecodeObjectPreservingRejectsTrailingContent(t *testing.T) {
	if _, err := DecodeObjectPreserving([]byte(`{"a":1} trailing`)); err == nil {
		t.Fatal("trailing content after the JSON object must be rejected")
	}
	if _, err := DecodeObjectPreserving([]byte(`[1,2]`)); err == nil {
		t.Fatal("a non-object body must be rejected")
	}
}

func TestNumbersRoundTripAsLiterals(t *testing.T) {
	decoded, err := DecodeObjectPreserving([]byte(`{"big":12345678901234567890,"int":7,"neg":-1}`))
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	got, err := Encode(decoded)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	want := `{"big":12345678901234567890,"int":7,"neg":-1}`
	if string(got) != want {
		t.Fatalf("numeric literals must round-trip exactly\n got: %s\nwant: %s", got, want)
	}
}
