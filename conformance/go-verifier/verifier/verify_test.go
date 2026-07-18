package verifier

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
	"testing"
)

// Test artifacts are constructed independently of the frozen vectors: a fresh
// deterministic Ed25519 key signs events whose canonical bytes come from this
// package's own reconstruction. Byte-exactness against the historical
// producer is pinned by the frozen suite, not by these tests; these tests pin
// behavior under tampering, key failures, chain damage, and lifecycle abuse.

func testKey(t *testing.T) (ed25519.PublicKey, ed25519.PrivateKey, string) {
	t.Helper()
	seed := sha256.Sum256([]byte("standalone-verifier-behavior-tests"))
	private := ed25519.NewKeyFromSeed(seed[:])
	public := private.Public().(ed25519.PublicKey)
	return public, private, TruncatedKeyID(public)
}

// signEvent completes an unsigned event body: it computes the schema-1
// canonical bytes, hash, and signature, and returns the full event JSON.
func signEvent(t *testing.T, unsignedBody string, private ed25519.PrivateKey) string {
	t.Helper()
	value, err := ParseLegacyJSON([]byte(unsignedBody), DefaultLimits())
	if err != nil {
		t.Fatalf("unsigned body must parse: %v", err)
	}
	canonical, canonErr := EncodeLegacyCanonical(value)
	if canonErr != nil {
		t.Fatalf("unsigned body must canonicalize: %v", canonErr)
	}
	digest := sha256.Sum256(canonical)
	signature := base64.StdEncoding.EncodeToString(ed25519.Sign(private, digest[:]))
	return unsignedBody[:len(unsignedBody)-1] +
		`,"event_hash":"` + hex.EncodeToString(digest[:]) + `","signature":"` + signature + `"}`
}

func decisionBody(eventID, previous, decision, inputHash, keyID string) string {
	previousJSON := "null"
	if previous != "" {
		previousJSON = `"` + previous + `"`
	}
	return fmt.Sprintf(`{"schema_version":"1","event_type":"decision","event_id":"%s",`+
		`"action_id":"act-1","action_name":"demo.action","contract_hash":"%s",`+
		`"timestamp_utc":"2026-07-17T00:00:00Z","key_id":"%s","previous_event_hash":%s,`+
		`"decision":"%s","risk":"low","approval_mode":"never",`+
		`"redacted_input_summary":"[redacted]","input_hash":"%s"}`,
		eventID, strings.Repeat("ab", 32), keyID, previousJSON, decision, inputHash)
}

func outcomeBody(eventID, previous, decisionEventID, status, keyID string) string {
	previousJSON := "null"
	if previous != "" {
		previousJSON = `"` + previous + `"`
	}
	return fmt.Sprintf(`{"schema_version":"1","event_type":"outcome","event_id":"%s",`+
		`"action_id":"act-1","action_name":"demo.action","contract_hash":"%s",`+
		`"timestamp_utc":"2026-07-17T00:00:01Z","key_id":"%s","previous_event_hash":%s,`+
		`"status":"%s","decision_event_id":"%s"}`,
		eventID, strings.Repeat("ab", 32), keyID, previousJSON, status, decisionEventID)
}

func submittedHash(t *testing.T, event string) string {
	t.Helper()
	value, err := ParseLegacyJSON([]byte(event), DefaultLimits())
	if err != nil {
		t.Fatalf("event must parse: %v", err)
	}
	return value.Lookup("event_hash").Str
}

func verifyEvent(event string, keys []KeyCandidate) *Result {
	return Verify(Request{Type: ArtifactEvidenceEvent, Input: []byte(event), Keys: keys}).Result
}

func verifyChainInput(chain string, keys []KeyCandidate, anchor *ChainAnchor, requiredHead string) *Result {
	return Verify(Request{
		Type:         ArtifactEvidenceChain,
		Input:        []byte(chain),
		Keys:         keys,
		Anchor:       anchor,
		RequiredHead: requiredHead,
	}).Result
}

func hasIssue(r *Result, code string) bool {
	for _, issue := range r.Issues {
		if issue.Code == code {
			return true
		}
	}
	return false
}

const testInputHash = "1111111111111111111111111111111111111111111111111111111111111111"

func TestEvidenceEventValid(t *testing.T) {
	public, private, keyID := testKey(t)
	event := signEvent(t, decisionBody("ev-1", "", "allowed", testInputHash, keyID), private)
	r := verifyEvent(event, []KeyCandidate{{ID: keyID, Key: public}})
	if r.Summary != "valid_but_trust_unknown" {
		t.Fatalf("expected valid_but_trust_unknown, got %s (issues %v)", r.Summary, r.Issues)
	}
	if r.ObjectHash != "valid" || r.Signature != "valid" || r.KeyResolution != "resolved" {
		t.Fatalf("unexpected dimensions: %+v", r)
	}
	if r.EventsVerified != 1 || !hasIssue(r, "trust_unknown") || !hasIssue(r, "producer_time_only") {
		t.Fatalf("unexpected default trust conclusion: %+v", r)
	}
}

func TestEvidenceEventTamperedPayload(t *testing.T) {
	public, private, keyID := testKey(t)
	event := signEvent(t, decisionBody("ev-1", "", "allowed", testInputHash, keyID), private)
	tampered := strings.Replace(event, `"risk":"low"`, `"risk":"high"`, 1)
	r := verifyEvent(tampered, []KeyCandidate{{ID: keyID, Key: public}})
	if r.Summary != "invalid" || r.ObjectHash != "mismatch" || r.Signature != "invalid" {
		t.Fatalf("tampered payload must be invalid: %+v", r)
	}
	if !hasIssue(r, "hash_mismatch") || !hasIssue(r, "invalid_signature") {
		t.Fatalf("expected hash and signature issues: %v", r.Issues)
	}
}

func TestEvidenceEventTamperedSignature(t *testing.T) {
	public, private, keyID := testKey(t)
	event := signEvent(t, decisionBody("ev-1", "", "allowed", testInputHash, keyID), private)
	// Flip one signature character to another base64 alphabet character.
	idx := strings.LastIndex(event, `"signature":"`) + len(`"signature":"`)
	flipped := byte('A')
	if event[idx] == 'A' {
		flipped = 'B'
	}
	tampered := event[:idx] + string(flipped) + event[idx+1:]
	r := verifyEvent(tampered, []KeyCandidate{{ID: keyID, Key: public}})
	if r.Summary != "invalid" || r.Signature != "invalid" {
		t.Fatalf("tampered signature must be invalid: %+v", r)
	}
	if r.ObjectHash != "valid" {
		t.Fatalf("payload hash still matches under signature tampering: %+v", r)
	}
}

func TestEvidenceEventWrongKey(t *testing.T) {
	_, private, keyID := testKey(t)
	event := signEvent(t, decisionBody("ev-1", "", "allowed", testInputHash, keyID), private)
	wrong := sha256.Sum256([]byte("a-different-public-key"))
	r := verifyEvent(event, []KeyCandidate{{ID: keyID, Key: wrong[:]}})
	if r.Summary != "invalid" || r.Signature != "invalid" {
		t.Fatalf("wrong key must fail the signature: %+v", r)
	}
}

func TestEvidenceEventUnknownAndAmbiguousKey(t *testing.T) {
	public, private, keyID := testKey(t)
	event := signEvent(t, decisionBody("ev-1", "", "allowed", testInputHash, keyID), private)

	r := verifyEvent(event, nil)
	if r.Summary != "indeterminate" || r.KeyResolution != "unknown" || !hasIssue(r, "unknown_key") {
		t.Fatalf("missing key must be indeterminate/unknown: %+v", r)
	}
	if r.Signature != "not_evaluated" {
		t.Fatalf("signature must not be evaluated without a key: %+v", r)
	}

	other := sha256.Sum256([]byte("colliding-candidate"))
	r = verifyEvent(event, []KeyCandidate{{ID: keyID, Key: public}, {ID: keyID, Key: other[:]}})
	if r.Summary != "indeterminate" || r.KeyResolution != "ambiguous" || !hasIssue(r, "ambiguous_key") {
		t.Fatalf("colliding keys must be ambiguous: %+v", r)
	}
}

func TestEvidenceEventUnsupportedSchema(t *testing.T) {
	_, private, keyID := testKey(t)
	body := strings.Replace(decisionBody("ev-1", "", "allowed", testInputHash, keyID),
		`"schema_version":"1"`, `"schema_version":"2"`, 1)
	event := signEvent(t, body, private)
	r := verifyEvent(event, nil)
	if r.Summary != "unsupported" || r.Schema != "unsupported" || !hasIssue(r, "unsupported_schema") {
		t.Fatalf("schema 2 must be unsupported, never downgraded: %+v", r)
	}
	if r.ObjectHash != "not_evaluated" || r.Signature != "not_evaluated" {
		t.Fatalf("nothing cryptographic may be evaluated for unsupported schema: %+v", r)
	}
}

func TestEvidenceEventUnknownFieldsDiagnostic(t *testing.T) {
	public, private, keyID := testKey(t)
	body := decisionBody("ev-1", "", "allowed", testInputHash, keyID)
	body = body[:len(body)-1] + `,"vendor_extension":{"note":"extra"}}`
	event := signEvent(t, body, private)
	r := verifyEvent(event, []KeyCandidate{{ID: keyID, Key: public}})
	if r.Summary != "valid_but_trust_unknown" || !hasIssue(r, "unknown_fields_present") {
		t.Fatalf("unknown fields are a warning on a valid event: %+v", r)
	}
}

func TestChainValidGenesis(t *testing.T) {
	public, private, keyID := testKey(t)
	first := signEvent(t, decisionBody("ev-1", "", "allowed", testInputHash, keyID), private)
	second := signEvent(t, outcomeBody("ev-2", submittedHash(t, first), "ev-1", "succeeded", keyID), private)
	r := verifyChainInput(first+"\n"+second+"\n", []KeyCandidate{{ID: keyID, Key: public}}, nil, "")
	if r.Continuity != "valid_genesis" || r.Semantics != "valid" || r.EventsVerified != 2 {
		t.Fatalf("expected a valid genesis chain: %+v", r)
	}
	if r.Completeness != "completeness_unknown" || !hasIssue(r, "completeness_unknown") {
		t.Fatalf("an unwitnessed tail stays completeness_unknown: %+v", r)
	}
}

func TestChainDiscontinuity(t *testing.T) {
	public, private, keyID := testKey(t)
	first := signEvent(t, decisionBody("ev-1", "", "allowed", testInputHash, keyID), private)
	second := signEvent(t, outcomeBody("ev-2", strings.Repeat("cd", 32), "ev-1", "succeeded", keyID), private)
	r := verifyChainInput(first+"\n"+second, []KeyCandidate{{ID: keyID, Key: public}}, nil, "")
	if r.Continuity != "discontinuous" || !hasIssue(r, "chain_discontinuity") {
		t.Fatalf("expected discontinuity: %+v", r)
	}
	if r.Summary != "invalid" {
		t.Fatalf("a discontinuous chain is invalid: %+v", r)
	}
}

func TestChainFork(t *testing.T) {
	public, private, keyID := testKey(t)
	first := signEvent(t, decisionBody("ev-1", "", "allowed", testInputHash, keyID), private)
	// Same event_id re-signed with different content, chained after first.
	fork := signEvent(t, decisionBody("ev-1", submittedHash(t, first), "allowed",
		strings.Repeat("22", 32), keyID), private)
	r := verifyChainInput(first+"\n"+fork, []KeyCandidate{{ID: keyID, Key: public}}, nil, "")
	if !hasIssue(r, "fork_detected") || r.Continuity != "discontinuous" {
		t.Fatalf("expected fork detection: %+v", r)
	}
}

func TestChainOrphanOutcome(t *testing.T) {
	public, private, keyID := testKey(t)
	only := signEvent(t, outcomeBody("ev-9", "", "ev-missing", "succeeded", keyID), private)
	r := verifyChainInput(only, []KeyCandidate{{ID: keyID, Key: public}}, nil, "")
	if r.Semantics != "invalid" || !hasIssue(r, "unknown_decision_reference") {
		t.Fatalf("orphan outcome must be invalid semantics: %+v", r)
	}
}

func TestChainOutcomeAfterDenial(t *testing.T) {
	public, private, keyID := testKey(t)
	denied := signEvent(t, decisionBody("ev-1", "", "denied", testInputHash, keyID), private)
	after := signEvent(t, outcomeBody("ev-2", submittedHash(t, denied), "ev-1", "succeeded", keyID), private)
	r := verifyChainInput(denied+"\n"+after, []KeyCandidate{{ID: keyID, Key: public}}, nil, "")
	if r.Semantics != "invalid" || !hasIssue(r, "invalid_transition") {
		t.Fatalf("outcome after denial must be invalid_transition: %+v", r)
	}
}

func TestChainDuplicateOutcome(t *testing.T) {
	public, private, keyID := testKey(t)
	decision := signEvent(t, decisionBody("ev-1", "", "allowed", testInputHash, keyID), private)
	first := signEvent(t, outcomeBody("ev-2", submittedHash(t, decision), "ev-1", "succeeded", keyID), private)
	second := signEvent(t, outcomeBody("ev-3", submittedHash(t, first), "ev-1", "succeeded", keyID), private)
	r := verifyChainInput(decision+"\n"+first+"\n"+second, []KeyCandidate{{ID: keyID, Key: public}}, nil, "")
	if r.Semantics != "invalid" || !hasIssue(r, "duplicate_outcome") {
		t.Fatalf("second outcome for one decision must be duplicate_outcome: %+v", r)
	}
}

func TestChainAnchoredSegment(t *testing.T) {
	public, private, keyID := testKey(t)
	preceding := strings.Repeat("ef", 32)
	outcome := signEvent(t, outcomeBody("ev-5", preceding, "ev-known", "succeeded", keyID), private)
	anchor := &ChainAnchor{PrecedingHash: preceding, Decisions: map[string]string{"ev-known": "allowed"}}
	r := verifyChainInput(outcome, []KeyCandidate{{ID: keyID, Key: public}}, anchor, "")
	if r.Continuity != "valid_anchored" || r.Semantics != "valid" {
		t.Fatalf("anchored segment must validate: %+v", r)
	}
}

func TestChainRequiredHead(t *testing.T) {
	public, private, keyID := testKey(t)
	decision := signEvent(t, decisionBody("ev-1", "", "allowed", testInputHash, keyID), private)
	keys := []KeyCandidate{{ID: keyID, Key: public}}

	r := verifyChainInput(decision, keys, nil, submittedHash(t, decision))
	if r.Completeness != "complete_to_checkpoint" {
		t.Fatalf("reaching the trusted head proves checkpoint completeness: %+v", r)
	}
	r = verifyChainInput(decision, keys, nil, strings.Repeat("00", 32))
	if r.Completeness != "incomplete" || !hasIssue(r, "incomplete_chain") || r.Summary != "indeterminate" {
		t.Fatalf("missing the trusted head proves incompleteness: %+v", r)
	}
}

func TestContractValidAndTampered(t *testing.T) {
	body := `{"schema_version":"1","action_name":"demo.action","module":"demo",` +
		`"qualified_name":"demo.action","risk":"low","approval_mode":"never",` +
		`"execution_mode":"embedded","parameter_descriptors":[{"name":"x",` +
		`"kind":"POSITIONAL_OR_KEYWORD","has_default":false,"annotation":null}],` +
		`"code_fingerprint":null}`
	value, err := ParseLegacyJSON([]byte(body), DefaultLimits())
	if err != nil {
		t.Fatalf("contract body must parse: %v", err)
	}
	canonical, canonErr := EncodeLegacyCanonical(value)
	if canonErr != nil {
		t.Fatalf("contract body must canonicalize: %v", canonErr)
	}
	digest := sha256.Sum256(canonical)
	contract := body[:len(body)-1] + `,"contract_hash":"` + hex.EncodeToString(digest[:]) + `"}`

	r := Verify(Request{Type: ArtifactActionContract, Input: []byte(contract)}).Result
	if r.Summary != "valid_but_trust_unknown" || r.ObjectHash != "valid" {
		t.Fatalf("valid contract must verify: %+v", r)
	}

	tampered := strings.Replace(contract, `"risk":"low"`, `"risk":"high"`, 1)
	r = Verify(Request{Type: ArtifactActionContract, Input: []byte(tampered)}).Result
	if r.Summary != "invalid" || r.ObjectHash != "mismatch" || !hasIssue(r, "hash_mismatch") {
		t.Fatalf("tampered contract must mismatch: %+v", r)
	}

	unknown := strings.Replace(contract, `"module":"demo"`, `"module":"demo","extra":1`, 1)
	r = Verify(Request{Type: ArtifactActionContract, Input: []byte(unknown)}).Result
	if r.Schema != "invalid" || !hasIssue(r, "unknown_field") {
		t.Fatalf("ActionContract schema 1 is closed: %+v", r)
	}
}

func TestTrustOverlayConclusions(t *testing.T) {
	public, private, keyID := testKey(t)
	event := signEvent(t, decisionBody("ev-1", "", "allowed", testInputHash, keyID), private)
	keys := []KeyCandidate{{ID: keyID, Key: public}}
	cases := []struct {
		overlay TrustOverlay
		trust   string
		summary string
		issue   string
	}{
		{TrustOverlay{KeyResolution: "resolved", KeyTrust: "trusted", RevocationSnapshot: "current",
			BindingEvaluation: "inside", TimeConfidence: "witnessed"}, "trusted", "valid_and_trusted", ""},
		{TrustOverlay{KeyResolution: "resolved", KeyTrust: "trusted", RevocationSnapshot: "revoked",
			BindingEvaluation: "inside", TimeConfidence: "witnessed"}, "revoked", "valid_but_untrusted", "revoked_key"},
		{TrustOverlay{KeyResolution: "resolved", KeyTrust: "untrusted", RevocationSnapshot: "current",
			BindingEvaluation: "inside", TimeConfidence: "witnessed"}, "untrusted", "valid_but_untrusted", "untrusted_key"},
		{TrustOverlay{KeyResolution: "resolved", KeyTrust: "trusted", RevocationSnapshot: "current",
			BindingEvaluation: "outside", TimeConfidence: "witnessed"}, "outside_binding_interval", "valid_but_untrusted", "outside_binding_interval"},
		{TrustOverlay{KeyResolution: "resolved", KeyTrust: "trusted", RevocationSnapshot: "current",
			BindingEvaluation: "indeterminate", TimeConfidence: "unavailable"}, "binding_interval_indeterminate", "indeterminate", "binding_interval_indeterminate"},
	}
	for _, c := range cases {
		r := Verify(Request{Type: ArtifactEvidenceEvent, Input: []byte(event), Keys: keys, Trust: &c.overlay}).Result
		if r.Trust != c.trust || r.Summary != c.summary {
			t.Fatalf("overlay %+v: expected trust=%s summary=%s, got %+v", c.overlay, c.trust, c.summary, r)
		}
		if c.issue != "" && !hasIssue(r, c.issue) {
			t.Fatalf("overlay %+v: expected issue %s, got %v", c.overlay, c.issue, r.Issues)
		}
		if r.Signature != "valid" {
			t.Fatalf("trust overlay must never change the signature fact: %+v", r)
		}
	}
}

func TestLoadPublicKeyRefusals(t *testing.T) {
	limits := DefaultLimits()
	if _, err := LoadPublicKey([]byte("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----"), limits); err == nil {
		t.Fatal("private-key material must be refused")
	}
	if _, err := LoadPublicKey([]byte("not-a-key"), limits); err == nil {
		t.Fatal("malformed key material must be refused")
	}
	if _, err := LoadPublicKey([]byte(strings.Repeat("a", limits.MaxKeyBytes+1)), limits); err == nil {
		t.Fatal("oversized key material must be refused")
	}
	if _, err := LoadPublicKey([]byte(hex.EncodeToString(make([]byte, 16))), limits); err == nil {
		t.Fatal("wrong-length raw key must be refused")
	}
}

func TestResultNeverEchoesPayloadValues(t *testing.T) {
	public, private, keyID := testKey(t)
	secret := "SENSITIVE-VALUE-8c1f"
	body := decisionBody("ev-1", "", "allowed", testInputHash, keyID)
	body = body[:len(body)-1] + `,"vendor_note":"` + secret + `"}`
	event := signEvent(t, body, private)
	tampered := strings.Replace(event, `"risk":"low"`, `"risk":"critical"`, 1)
	for _, input := range []string{event, tampered} {
		r := verifyEvent(input, []KeyCandidate{{ID: keyID, Key: public}})
		encoded, err := r.MarshalDeterministic()
		if err != nil {
			t.Fatalf("result must encode: %v", err)
		}
		if strings.Contains(string(encoded), secret) {
			t.Fatal("portable result echoed a payload value")
		}
	}
}

func TestVerifyNeverPanicsOnHostileInput(t *testing.T) {
	inputs := []string{
		"", "\x00", "{", "[", `{"schema_version":`, strings.Repeat("[", 100000),
		`{"schema_version":"1","event_type":"decision"}`,
		"\xff\xfe\xfd", `{"a":` + strings.Repeat("9", 10000) + `}`,
	}
	for _, input := range inputs {
		for _, artifactType := range []ArtifactType{
			ArtifactLegacyValue, ArtifactActionContract, ArtifactEvidenceEvent, ArtifactEvidenceChain,
		} {
			outcome := Verify(Request{Type: artifactType, Input: []byte(input)})
			if outcome == nil || outcome.Result == nil || outcome.Result.Summary == "" {
				t.Fatalf("hostile input must still produce a result (%q, %s)", input, artifactType)
			}
		}
	}
}
