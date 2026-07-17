package main

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Igris-inertial/system/conformance/go-verifier/verifier"
)

func runCLI(t *testing.T, stdin string, args ...string) (int, string, string) {
	t.Helper()
	var stdout, stderr bytes.Buffer
	code := run(args, strings.NewReader(stdin), &stdout, &stderr)
	return code, stdout.String(), stderr.String()
}

func decodeSingleResult(t *testing.T, stdout string) map[string]any {
	t.Helper()
	var doc map[string]any
	if err := json.Unmarshal([]byte(stdout), &doc); err != nil {
		t.Fatalf("stdout must be exactly one JSON result: %v\n%s", err, stdout)
	}
	if doc["schema_id"] != verifier.ResultSchemaID {
		t.Fatalf("result schema_id mismatch: %v", doc["schema_id"])
	}
	return doc
}

// buildContract returns a schema-1 ActionContract with a correct hash.
func buildContract(t *testing.T) string {
	t.Helper()
	body := `{"schema_version":"1","action_name":"demo.action","module":"demo",` +
		`"qualified_name":"demo.action","risk":"low","approval_mode":"never",` +
		`"execution_mode":"embedded","parameter_descriptors":[],"code_fingerprint":null}`
	value, err := verifier.ParseLegacyJSON([]byte(body), verifier.DefaultLimits())
	if err != nil {
		t.Fatalf("contract body must parse: %v", err)
	}
	canonical, canonErr := verifier.EncodeLegacyCanonical(value)
	if canonErr != nil {
		t.Fatalf("contract body must canonicalize: %v", canonErr)
	}
	digest := sha256.Sum256(canonical)
	return body[:len(body)-1] + `,"contract_hash":"` + hex.EncodeToString(digest[:]) + `"}`
}

// buildSignedEvent returns a signed schema-1 decision event and its hex
// public key.
func buildSignedEvent(t *testing.T) (event string, publicHex string) {
	t.Helper()
	seed := sha256.Sum256([]byte("igris-verify-cli-test-key"))
	private := ed25519.NewKeyFromSeed(seed[:])
	public := private.Public().(ed25519.PublicKey)
	keyID := verifier.TruncatedKeyID(public)
	body := `{"schema_version":"1","event_type":"decision","event_id":"ev-1",` +
		`"action_id":"act-1","action_name":"demo.action",` +
		`"contract_hash":"` + strings.Repeat("ab", 32) + `",` +
		`"timestamp_utc":"2026-07-17T00:00:00Z","key_id":"` + keyID + `",` +
		`"previous_event_hash":null,"decision":"allowed","risk":"low",` +
		`"approval_mode":"never","redacted_input_summary":"[redacted]",` +
		`"input_hash":"` + strings.Repeat("11", 32) + `"}`
	value, err := verifier.ParseLegacyJSON([]byte(body), verifier.DefaultLimits())
	if err != nil {
		t.Fatalf("event body must parse: %v", err)
	}
	canonical, canonErr := verifier.EncodeLegacyCanonical(value)
	if canonErr != nil {
		t.Fatalf("event body must canonicalize: %v", canonErr)
	}
	digest := sha256.Sum256(canonical)
	signature := base64.StdEncoding.EncodeToString(ed25519.Sign(private, digest[:]))
	event = body[:len(body)-1] +
		`,"event_hash":"` + hex.EncodeToString(digest[:]) + `","signature":"` + signature + `"}`
	return event, hex.EncodeToString(public)
}

func writeFile(t *testing.T, dir, name, content string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("fixture write failed: %v", err)
	}
	return path
}

func TestCLIVerifyContractFromFile(t *testing.T) {
	path := writeFile(t, t.TempDir(), "contract.json", buildContract(t))
	code, stdout, _ := runCLI(t, "", "verify", path)
	if code != exitOK {
		t.Fatalf("expected exit 0, got %d", code)
	}
	doc := decodeSingleResult(t, stdout)
	if doc["summary"] != "valid_but_trust_unknown" || doc["object_hash"] != "valid" {
		t.Fatalf("unexpected contract result: %v", doc)
	}
}

func TestCLIVerifyEvidenceFromStdinWithKey(t *testing.T) {
	event, publicHex := buildSignedEvent(t)
	keyPath := writeFile(t, t.TempDir(), "verify_key.hex", publicHex)
	code, stdout, _ := runCLI(t, event, "verify", "-", "--key", keyPath)
	if code != exitOK {
		t.Fatalf("expected exit 0, got %d", code)
	}
	doc := decodeSingleResult(t, stdout)
	if doc["summary"] != "valid_but_trust_unknown" || doc["signature"] != "valid" {
		t.Fatalf("unexpected evidence result: %v", doc)
	}
}

func TestCLIVerifyEvidenceWithoutKeyIsIndeterminate(t *testing.T) {
	event, _ := buildSignedEvent(t)
	path := writeFile(t, t.TempDir(), "evidence.json", event)
	code, stdout, _ := runCLI(t, "", "verify", path)
	if code != exitOK {
		t.Fatalf("artifact indeterminacy is data, not an error exit: %d", code)
	}
	doc := decodeSingleResult(t, stdout)
	if doc["summary"] != "indeterminate" || doc["key_resolution"] != "unknown" {
		t.Fatalf("unexpected keyless result: %v", doc)
	}
}

func TestCLIInvalidArtifactStillExitsZero(t *testing.T) {
	path := writeFile(t, t.TempDir(), "malformed.json", `{"a":1,"a":2}`)
	code, stdout, _ := runCLI(t, "", "verify", path, "--type", "value")
	if code != exitOK {
		t.Fatalf("artifact invalidity is data, not an error exit: %d", code)
	}
	doc := decodeSingleResult(t, stdout)
	if doc["summary"] != "invalid" || doc["parse"] != "malformed" {
		t.Fatalf("unexpected malformed result: %v", doc)
	}
}

func TestCLIUndeterminedTypeIsUnsupported(t *testing.T) {
	path := writeFile(t, t.TempDir(), "opaque.json", `{"unrelated":true}`)
	code, _, stderr := runCLI(t, "", "verify", path)
	if code != exitUnsupported {
		t.Fatalf("expected exit %d for undetermined type, got %d (%s)", exitUnsupported, code, stderr)
	}
}

func TestCLIMissingInputIsIOFailure(t *testing.T) {
	code, _, _ := runCLI(t, "", "verify", filepath.Join(t.TempDir(), "absent.json"))
	if code != exitIO {
		t.Fatalf("expected exit %d for missing input, got %d", exitIO, code)
	}
}

func TestCLIInvalidInvocation(t *testing.T) {
	if code, _, _ := runCLI(t, "", "unknown-command"); code != exitInvocation {
		t.Fatalf("unknown command must exit %d, got %d", exitInvocation, code)
	}
	if code, _, _ := runCLI(t, ""); code != exitInvocation {
		t.Fatalf("empty invocation must exit %d, got %d", exitInvocation, code)
	}
	if code, _, _ := runCLI(t, "", "vectors"); code != exitInvocation {
		t.Fatalf("vectors without --suite must exit %d, got %d", exitInvocation, code)
	}
}

func TestCLIHumanModeNeverEchoesPayload(t *testing.T) {
	secret := "SENSITIVE-CLI-VALUE-77"
	event, _ := buildSignedEvent(t)
	tampered := strings.Replace(event, "[redacted]", secret, 1)
	path := writeFile(t, t.TempDir(), "evidence.json", tampered)
	code, stdout, stderr := runCLI(t, "", "verify", path, "--human")
	if code != exitOK {
		t.Fatalf("expected exit 0, got %d", code)
	}
	if strings.Contains(stdout, secret) || strings.Contains(stderr, secret) {
		t.Fatal("CLI output echoed a payload value")
	}
	if !strings.Contains(stderr, "summary:") {
		t.Fatalf("human mode must explain on stderr: %q", stderr)
	}
}

func TestCLIVectorsModeAgainstFrozenSuite(t *testing.T) {
	suite := filepath.Join("..", "..", "..", "..", "spec", "test-vectors", "suite-schema-1")
	if _, err := os.Stat(filepath.Join(suite, "manifest.json")); err != nil {
		t.Skipf("frozen suite unavailable from this working directory: %v", err)
	}
	code, stdout, stderr := runCLI(t, "", "vectors", "--suite", suite)
	if code != exitOK {
		t.Fatalf("frozen suite must pass, got exit %d\n%s", code, stderr)
	}
	var report map[string]any
	if err := json.Unmarshal([]byte(stdout), &report); err != nil {
		t.Fatalf("vectors report must be JSON: %v", err)
	}
	if report["status"] != "pass" || report["selected"] != float64(120) || report["passed"] != float64(120) {
		t.Fatalf("expected 120/120 pass, got %v", report)
	}
}

func TestCLIVectorsModeCorruptSuite(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, "manifest.json", `{"format":"igris-test-vector-manifest"`)
	if code, _, _ := runCLI(t, "", "vectors", "--suite", dir); code != exitInvocation {
		t.Fatalf("corrupt suite must exit %d", exitInvocation)
	}
}

func TestCLIDeterministicOutput(t *testing.T) {
	path := writeFile(t, t.TempDir(), "contract.json", buildContract(t))
	_, first, _ := runCLI(t, "", "verify", path)
	_, second, _ := runCLI(t, "", "verify", path)
	if first != second {
		t.Fatal("identical inputs must produce identical output bytes")
	}
}
