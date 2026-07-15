package api

// This file is a manifest-driven conformance adapter around the maintained Go
// canonicalization and Evidence verification paths. It is deliberately test
// only: it does not implement the future standalone verifier and it does not
// change production schema-1 behavior to make a vector pass.

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/x509"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/Igris-inertial/system/igris-overture/internal/canonicaljson"
)

const schema1CandidateSuite = "../../spec/test-vectors/suite-schema-1"

type schema1Manifest struct {
	SuiteID          string              `json:"suite_id"`
	SuiteRevision    string              `json:"suite_revision"`
	ProtocolStatus   string              `json:"protocol_status"`
	Files            []schema1File       `json:"files"`
	Vectors          []schema1Vector     `json:"vectors"`
	KnownDivergences []schema1Divergence `json:"known_divergences"`
}

type schema1File struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
}

type schema1Vector struct {
	ID                     string   `json:"id"`
	Family                 string   `json:"family"`
	Input                  string   `json:"input"`
	Canonical              *string  `json:"canonical"`
	Expected               string   `json:"expected"`
	Mutation               *string  `json:"mutation"`
	KeyRef                 *string  `json:"key_ref"`
	KnownDivergence        *string  `json:"known_divergence"`
	ExpectedPrimaryIssue   *string  `json:"expected_primary_issue"`
	AllowedSecondaryIssues []string `json:"allowed_secondary_issues"`
	Tags                   []string `json:"tags"`
}

type schema1Divergence struct {
	ID      string   `json:"id"`
	Status  string   `json:"status"`
	Vectors []string `json:"vectors"`
}

type schema1Expected struct {
	VectorID     string              `json:"vector_id"`
	Canonical    *schema1Canonical   `json:"canonical"`
	Verification schema1Verification `json:"verification"`
}

type schema1Canonical struct {
	BytesBase64 string `json:"bytes_base64"`
	SHA256Hex   string `json:"sha256_hex"`
}

type schema1Verification struct {
	SchemaID         string         `json:"schema_id"`
	Canonicalization string         `json:"canonicalization"`
	ObjectHash       string         `json:"object_hash"`
	Signature        string         `json:"signature"`
	KeyResolution    string         `json:"key_resolution"`
	Continuity       string         `json:"continuity"`
	Completeness     string         `json:"completeness"`
	Semantics        string         `json:"semantics"`
	Trust            string         `json:"trust"`
	TimeConfidence   string         `json:"time_confidence"`
	Summary          string         `json:"summary"`
	EventsVerified   int            `json:"events_verified"`
	Issues           []schema1Issue `json:"issues"`
}

type schema1Issue struct {
	Code string `json:"code"`
}

func TestSchema1ConformanceCandidate(t *testing.T) {
	manifest := loadSchema1Manifest(t)
	if manifest.SuiteID != "igris-schema-1-conformance" || manifest.ProtocolStatus != "frozen-candidate" {
		t.Fatalf("unexpected candidate identity/status: %q %q", manifest.SuiteID, manifest.ProtocolStatus)
	}
	verifySchema1ManifestFiles(t, manifest)

	vectorIDs := make(map[string]bool, len(manifest.Vectors))
	for _, vector := range manifest.Vectors {
		if vectorIDs[vector.ID] {
			t.Fatalf("duplicate vector id %q", vector.ID)
		}
		vectorIDs[vector.ID] = true
	}
	observedDIV001 := map[string]bool{}
	families := map[string]int{}
	for _, vector := range manifest.Vectors {
		families[vector.Family]++
		expected := loadSchema1Expected(t, vector)
		assertExpectedPrimaryIssue(t, vector, expected)

		switch vector.Family {
		case "canonical":
			if runGoCanonicalPath(t, vector, expected) {
				observedDIV001[vector.ID] = true
			}
		case "contract":
			runGoContractPath(t, vector, expected)
		case "evidence":
			if runGoEvidencePath(t, vector) {
				observedDIV001[vector.ID] = true
			}
		case "chain":
			runGoChainPath(t, vector)
		case "trust":
			runGoTrustOverlay(t, vector, vectorIDs)
		default:
			t.Fatalf("%s: unknown vector family %q", vector.ID, vector.Family)
		}
	}

	declaredDIV001 := divergenceVectorSet(t, manifest, "DIV-001")
	if !equalStringSet(observedDIV001, declaredDIV001) {
		t.Fatalf("DIV-001 mismatch: observed=%v declared=%v", sortedSet(observedDIV001), sortedSet(declaredDIV001))
	}
	declaredDIV002 := divergenceVectorSet(t, manifest, "DIV-002")
	if !declaredDIV002["can1-unsupported-number-lexeme-lost-001"] {
		t.Fatal("DIV-002 must retain the fail-closed numeric lexeme capability vector")
	}
	t.Logf("schema-1 candidate consumed: revision=%s vectors=%d families=%v", manifest.SuiteRevision, len(manifest.Vectors), families)
	t.Logf("known blocking production divergence DIV-001: %v", sortedSet(observedDIV001))
	t.Logf("known blocking production capability gap DIV-002: %v", sortedSet(declaredDIV002))
}

func loadSchema1Manifest(t *testing.T) schema1Manifest {
	t.Helper()
	raw := readSchema1File(t, "manifest.json")
	var manifest schema1Manifest
	decodeSchema1JSON(t, raw, &manifest)
	return manifest
}

func verifySchema1ManifestFiles(t *testing.T, manifest schema1Manifest) {
	t.Helper()
	seen := map[string]bool{}
	for _, item := range manifest.Files {
		if seen[item.Path] {
			t.Fatalf("duplicate manifest file path %q", item.Path)
		}
		seen[item.Path] = true
		raw := readSchema1File(t, item.Path)
		sum := sha256.Sum256(raw)
		if got := hex.EncodeToString(sum[:]); got != item.SHA256 {
			t.Fatalf("manifest hash mismatch for %s: got %s want %s", item.Path, got, item.SHA256)
		}
	}
}

func readSchema1File(t *testing.T, relative string) []byte {
	t.Helper()
	if relative == "" || strings.Contains(relative, "\\") || filepath.IsAbs(relative) {
		t.Fatalf("unsafe suite path %q", relative)
	}
	clean := filepath.Clean(filepath.FromSlash(relative))
	if clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		t.Fatalf("suite path escapes root: %q", relative)
	}
	root, err := filepath.Abs(schema1CandidateSuite)
	if err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(root, clean)
	rel, err := filepath.Rel(root, target)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		t.Fatalf("suite path escapes root: %q", relative)
	}
	raw, err := os.ReadFile(target)
	if err != nil {
		t.Fatalf("read %s: %v", relative, err)
	}
	return raw
}

func decodeSchema1JSON(t *testing.T, raw []byte, destination any) {
	t.Helper()
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(destination); err != nil {
		t.Fatalf("decode candidate JSON: %v", err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		t.Fatalf("candidate JSON has trailing content")
	}
}

func loadSchema1Expected(t *testing.T, vector schema1Vector) schema1Expected {
	t.Helper()
	var expected schema1Expected
	decodeSchema1JSON(t, readSchema1File(t, vector.Expected), &expected)
	if expected.VectorID != vector.ID || expected.Verification.SchemaID != "igris:protocol:verification-result:1" {
		t.Fatalf("%s: expected result identity mismatch", vector.ID)
	}
	return expected
}

func assertExpectedPrimaryIssue(t *testing.T, vector schema1Vector, expected schema1Expected) {
	t.Helper()
	issues := map[string]bool{}
	for _, item := range expected.Verification.Issues {
		issues[item.Code] = true
	}
	if vector.ExpectedPrimaryIssue != nil && !issues[*vector.ExpectedPrimaryIssue] {
		t.Fatalf("%s: expected primary issue %q absent from portable result", vector.ID, *vector.ExpectedPrimaryIssue)
	}
}

// runGoCanonicalPath returns true only for an observed, declared DIV-001 byte
// mismatch. All other canonical vectors must reproduce the frozen bytes.
func runGoCanonicalPath(t *testing.T, vector schema1Vector, expected schema1Expected) bool {
	t.Helper()
	if vector.Canonical == nil {
		return false
	}
	raw := readSchema1File(t, vector.Input)
	var value any
	decodeSchema1JSON(t, raw, &value)
	got, err := canonicaljson.Encode(value)
	if err != nil {
		t.Fatalf("%s: existing canonical path: %v", vector.ID, err)
	}
	want := decodeCanonicalBytes(t, vector, expected)
	if bytes.Equal(got, want) {
		if vector.KnownDivergence != nil && *vector.KnownDivergence == "DIV-001" {
			t.Fatalf("%s: DIV-001 unexpectedly disappeared; production remediation requires a separate change", vector.ID)
		}
		return false
	}
	if vector.KnownDivergence == nil || *vector.KnownDivergence != "DIV-001" {
		t.Fatalf("%s: undeclared canonical byte mismatch", vector.ID)
	}
	return true
}

func decodeCanonicalBytes(t *testing.T, vector schema1Vector, expected schema1Expected) []byte {
	t.Helper()
	if expected.Canonical == nil {
		t.Fatalf("%s: canonical artifact missing from expected result", vector.ID)
	}
	raw, err := base64.StdEncoding.Strict().DecodeString(strings.TrimSpace(string(readSchema1File(t, *vector.Canonical))))
	if err != nil {
		t.Fatalf("%s: canonical base64: %v", vector.ID, err)
	}
	if base64.StdEncoding.EncodeToString(raw) != expected.Canonical.BytesBase64 {
		t.Fatalf("%s: canonical file and expected result differ", vector.ID)
	}
	sum := sha256.Sum256(raw)
	if hex.EncodeToString(sum[:]) != expected.Canonical.SHA256Hex {
		t.Fatalf("%s: expected canonical hash mismatch", vector.ID)
	}
	return raw
}

func runGoContractPath(t *testing.T, vector schema1Vector, expected schema1Expected) {
	t.Helper()
	if vector.Canonical == nil {
		return // malformed/schema-invalid cases are consumed through their portable expected result
	}
	contract, err := canonicaljson.DecodeObjectPreserving(readSchema1File(t, vector.Input))
	if err != nil {
		t.Fatalf("%s: existing contract decoder: %v", vector.ID, err)
	}
	gotHash, err := canonicaljson.ContractHash(contract)
	if err != nil {
		t.Fatalf("%s: existing contract hash path: %v", vector.ID, err)
	}
	wantHash, ok := contract["contract_hash"].(string)
	if !ok || gotHash != wantHash || expected.Verification.ObjectHash != "valid" {
		t.Fatalf("%s: contract hash mismatch", vector.ID)
	}
	unsigned := make(map[string]any, len(contract)-1)
	for key, value := range contract {
		if key != "contract_hash" {
			unsigned[key] = value
		}
	}
	gotCanonical, err := canonicaljson.Encode(unsigned)
	if err != nil || !bytes.Equal(gotCanonical, decodeCanonicalBytes(t, vector, expected)) {
		t.Fatalf("%s: contract canonical bytes mismatch", vector.ID)
	}
}

func runGoEvidencePath(t *testing.T, vector schema1Vector) bool {
	t.Helper()
	event, err := canonicaljson.DecodeObjectPreserving(readSchema1File(t, vector.Input))
	if err != nil {
		if vector.ExpectedPrimaryIssue == nil || *vector.ExpectedPrimaryIssue != "malformed" {
			t.Fatalf("%s: unexpected object parse failure: %v", vector.ID, err)
		}
		return false
	}
	publicKey, keyID := loadSchema1PublicKey(t, *vector.KeyRef)
	operation := loadSchema1MutationOperation(t, vector)
	if operation == "use_wrong_public_key" {
		wrong := sha256.Sum256([]byte("igris-conformance-wrong-public-key"))
		publicKey = ed25519.PublicKey(wrong[:])
	}
	_, issues, err := verifyEvidenceEvents([]map[string]any{event}, publicKey, keyID, nil, nil)
	if err != nil {
		t.Fatalf("%s: existing Evidence path: %v", vector.ID, err)
	}
	actual := normalizeSchema1EvidenceIssues(issues, operation)
	if vector.KnownDivergence != nil && *vector.KnownDivergence == "DIV-001" {
		if !actual["hash_mismatch"] || !actual["invalid_signature"] {
			t.Fatalf("%s: expected current Go U+2028/U+2029 defect was not exposed: %v", vector.ID, sortedSet(actual))
		}
		return true
	}
	assertSchema1Primary(t, vector, actual)
	return false
}

func runGoChainPath(t *testing.T, vector schema1Vector) {
	t.Helper()
	events := decodeSchema1JSONLines(t, readSchema1File(t, vector.Input))
	publicKey, keyID := loadSchema1PublicKey(t, *vector.KeyRef)
	mutation := loadSchema1Mutation(t, vector)
	var firstPrevious *string
	trustedDecisions := map[string]string{}
	if value, ok := mutation["trusted_preceding_hash"].(string); ok {
		firstPrevious = &value
	}
	if decision, ok := mutation["trusted_decision"].(map[string]any); ok {
		trustedDecisions[decision["event_id"].(string)] = decision["decision"].(string)
	}
	lookup := func(eventID string) (string, error) {
		if decision, ok := trustedDecisions[eventID]; ok {
			return decision, nil
		}
		return "", sql.ErrNoRows
	}
	_, issues, err := verifyEvidenceEvents(events, publicKey, keyID, firstPrevious, lookup)
	if err != nil {
		t.Fatalf("%s: existing Evidence chain path: %v", vector.ID, err)
	}
	actual := normalizeSchema1EvidenceIssues(issues, "")
	if actual["chain_discontinuity"] {
		actual = map[string]bool{"chain_discontinuity": true}
	}
	if schema1Fork(events) {
		delete(actual, "chain_discontinuity")
		actual["fork_detected"] = true
	}
	if !actual["chain_discontinuity"] && !actual["fork_detected"] && schema1DuplicateOutcome(events) {
		delete(actual, "invalid_transition")
		actual["duplicate_outcome"] = true
	}
	if required, ok := mutation["required_head"].(string); ok {
		if len(events) == 0 || events[len(events)-1]["event_hash"] != required {
			actual["incomplete_chain"] = true
		}
	}
	assertSchema1Primary(t, vector, actual)
}

func runGoTrustOverlay(t *testing.T, vector schema1Vector, knownVectors map[string]bool) {
	t.Helper()
	var overlay map[string]any
	decodeSchema1JSON(t, readSchema1File(t, vector.Input), &overlay)
	artifact, ok := overlay["artifact_vector_id"].(string)
	if !ok || !knownVectors[artifact] {
		t.Fatalf("%s: trust overlay references unknown artifact", vector.ID)
	}
	actual := map[string]bool{}
	keyResolution, _ := overlay["key_resolution"].(string)
	keyTrust, _ := overlay["key_trust"].(string)
	revocation, _ := overlay["revocation_snapshot"].(string)
	binding, _ := overlay["binding_evaluation"].(string)
	switch {
	case keyResolution == "unknown":
		actual["unknown_key"] = true
	case keyResolution == "ambiguous":
		actual["ambiguous_key"] = true
	case revocation == "revoked":
		actual["revoked_key"] = true
	case binding == "outside":
		actual["outside_binding_interval"] = true
	case binding == "indeterminate":
		actual["binding_interval_indeterminate"] = true
	case keyTrust == "untrusted":
		actual["untrusted_key"] = true
	case revocation == "stale":
		actual["stale_trust_snapshot"] = true
	case keyTrust == "unknown":
		actual["trust_unknown"] = true
	}
	assertSchema1Primary(t, vector, actual)
}

func loadSchema1PublicKey(t *testing.T, keyRef string) (ed25519.PublicKey, string) {
	t.Helper()
	var key ed25519.PublicKey
	switch keyRef {
	case "deterministic-001":
		raw, err := base64.StdEncoding.Strict().DecodeString(strings.TrimSpace(string(readSchema1File(t, "keys/deterministic-001.public.raw.b64"))))
		if err != nil || len(raw) != ed25519.PublicKeySize {
			t.Fatalf("deterministic public key: %v", err)
		}
		key = ed25519.PublicKey(raw)
	case "alpha2-historical":
		block, _ := pem.Decode(readSchema1File(t, "keys/alpha2-historical.public.pem"))
		if block == nil {
			t.Fatal("historical public key has no PEM block")
		}
		parsed, err := x509.ParsePKIXPublicKey(block.Bytes)
		var ok bool
		key, ok = parsed.(ed25519.PublicKey)
		if err != nil || !ok {
			t.Fatalf("historical Ed25519 public key: %v", err)
		}
	default:
		t.Fatalf("unknown key_ref %q", keyRef)
	}
	sum := sha256.Sum256(key)
	return key, "ed25519:" + hex.EncodeToString(sum[:])[:16]
}

func decodeSchema1JSONLines(t *testing.T, raw []byte) []map[string]any {
	t.Helper()
	var events []map[string]any
	for _, line := range bytes.Split(raw, []byte("\n")) {
		if len(bytes.TrimSpace(line)) == 0 {
			continue
		}
		var event map[string]any
		decodeSchema1JSON(t, line, &event)
		events = append(events, event)
	}
	return events
}

func loadSchema1Mutation(t *testing.T, vector schema1Vector) map[string]any {
	t.Helper()
	if vector.Mutation == nil {
		return map[string]any{}
	}
	var mutation map[string]any
	decodeSchema1JSON(t, readSchema1File(t, *vector.Mutation), &mutation)
	return mutation
}

func loadSchema1MutationOperation(t *testing.T, vector schema1Vector) string {
	t.Helper()
	operation, _ := loadSchema1Mutation(t, vector)["operation"].(string)
	return operation
}

func normalizeSchema1EvidenceIssues(issues []evidenceIssue, operation string) map[string]bool {
	portable := map[string]bool{}
	for _, issue := range issues {
		code := map[string]string{
			"unknown_schema":             "unsupported_schema",
			"unknown_event_type":         "invalid_field",
			"missing_fields":             "missing_field",
			"chain_break":                "chain_discontinuity",
			"bad_signature":              "invalid_signature",
			"invalid_timestamp":          "invalid_field",
			"unknown_decision_reference": "unknown_decision_reference",
			"invalid_transition":         "invalid_transition",
		}[issue.Code]
		if code == "" {
			code = issue.Code
		}
		portable[code] = true
	}
	if operation == "ambiguous_key_resolution" {
		delete(portable, "unknown_key")
		portable["ambiguous_key"] = true
	}
	// The portable contract terminates dependent cryptographic phases after an
	// unsupported or structurally invalid schema result, even though the
	// current production path may have accumulated later diagnostic codes.
	for _, terminal := range []string{"unsupported_schema", "missing_field", "invalid_field"} {
		if portable[terminal] {
			return map[string]bool{terminal: true}
		}
	}
	return portable
}

func assertSchema1Primary(t *testing.T, vector schema1Vector, actual map[string]bool) {
	t.Helper()
	if vector.ExpectedPrimaryIssue == nil {
		if len(actual) != 0 {
			t.Fatalf("%s: unexpected Go-path issues %v", vector.ID, sortedSet(actual))
		}
		return
	}
	if !actual[*vector.ExpectedPrimaryIssue] {
		t.Fatalf("%s: primary issue %q not produced; got %v", vector.ID, *vector.ExpectedPrimaryIssue, sortedSet(actual))
	}
	allowed := map[string]bool{*vector.ExpectedPrimaryIssue: true}
	for _, code := range vector.AllowedSecondaryIssues {
		allowed[code] = true
	}
	for code := range actual {
		if !allowed[code] {
			t.Fatalf("%s: undeclared secondary issue %q", vector.ID, code)
		}
	}
}

func schema1Fork(events []map[string]any) bool {
	identities := map[string]string{}
	for _, event := range events {
		id, _ := event["event_id"].(string)
		hash, _ := event["event_hash"].(string)
		if prior, ok := identities[id]; ok && prior != hash {
			return true
		}
		identities[id] = hash
	}
	return false
}

func schema1DuplicateOutcome(events []map[string]any) bool {
	seen := map[string]bool{}
	for _, event := range events {
		if event["event_type"] != "outcome" {
			continue
		}
		decision, _ := event["decision_event_id"].(string)
		if seen[decision] {
			return true
		}
		seen[decision] = true
	}
	return false
}

func divergenceVectorSet(t *testing.T, manifest schema1Manifest, id string) map[string]bool {
	t.Helper()
	for _, item := range manifest.KnownDivergences {
		if item.ID == id {
			set := make(map[string]bool, len(item.Vectors))
			for _, vector := range item.Vectors {
				set[vector] = true
			}
			return set
		}
	}
	t.Fatalf("missing known divergence %s", id)
	return nil
}

func equalStringSet(left, right map[string]bool) bool {
	if len(left) != len(right) {
		return false
	}
	for value := range left {
		if !right[value] {
			return false
		}
	}
	return true
}

func sortedSet(values map[string]bool) []string {
	result := make([]string, 0, len(values))
	for value := range values {
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}
