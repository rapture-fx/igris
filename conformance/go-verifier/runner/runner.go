package runner

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/Igris-inertial/system/conformance/go-verifier/verifier"
)

// RunnerName identifies this runner in machine-readable reports.
const RunnerName = "standalone-go-verifier"

// Failure is one bounded conformance mismatch. Detail contains registered
// enum values and field names only, never payload bytes or key material.
type Failure struct {
	ID     string `json:"id"`
	Reason string `json:"reason"`
	Detail string `json:"detail,omitempty"`
}

// Report is the machine-readable conformance run summary.
type Report struct {
	Runner           string          `json:"runner"`
	SuiteID          string          `json:"suite_id"`
	SuiteRevision    string          `json:"suite_revision"`
	Status           string          `json:"status"`
	Selected         int             `json:"selected"`
	Passed           int             `json:"passed"`
	Families         map[string]int  `json:"families"`
	Failures         []Failure       `json:"failures"`
	KnownDivergences json.RawMessage `json:"declared_known_divergences"`
}

// Filter selects a subset of vectors.
type Filter struct {
	VectorID   string
	Family     string
	Capability string
}

type mutationRecord struct {
	BaseVector           string `json:"base_vector"`
	Operation            string `json:"operation"`
	RecomputeHash        bool   `json:"recompute_hash"`
	TrustedPrecedingHash string `json:"trusted_preceding_hash"`
	TrustedDecision      *struct {
		Decision string `json:"decision"`
		EventID  string `json:"event_id"`
	} `json:"trusted_decision"`
	RequiredHead string `json:"required_head"`
}

type trustOverlayInput struct {
	ArtifactVectorID   string `json:"artifact_vector_id"`
	BindingEvaluation  string `json:"binding_evaluation"`
	KeyResolution      string `json:"key_resolution"`
	KeyTrust           string `json:"key_trust"`
	RevocationSnapshot string `json:"revocation_snapshot"`
	TimeConfidence     string `json:"time_confidence"`
}

// deterministicWrongKey and deterministicCollidingKey are fixed synthetic
// 32-byte values for the use_wrong_public_key and ambiguous_key_resolution
// runner directives. Any distinct 32 bytes produce the pinned results; the
// derivation is fixed only for determinism.
func deterministicWrongKey() []byte {
	sum := sha256.Sum256([]byte("standalone-go-verifier-wrong-public-key"))
	return sum[:]
}

func deterministicCollidingKey() []byte {
	sum := sha256.Sum256([]byte("standalone-go-verifier-colliding-key-candidate"))
	return sum[:]
}

// Run executes the selected vectors of the frozen candidate against the
// standalone verifier and returns the machine-readable report.
func Run(suitePath string, filter Filter) (*Report, error) {
	registered := make(map[string]struct{})
	for _, code := range verifier.RegisteredIssueCodes() {
		registered[code] = struct{}{}
	}
	manifest, err := LoadManifest(suitePath, registered)
	if err != nil {
		return nil, err
	}
	schemaBytes, err := manifest.ReadSuiteFile("schemas/verification-result-1.schema.json")
	if err != nil {
		return nil, err
	}
	schema, err := LoadResultSchema(schemaBytes)
	if err != nil {
		return nil, &SuiteError{Reason: err.Error()}
	}

	var selected []*Vector
	for i := range manifest.Vectors {
		vector := &manifest.Vectors[i]
		if filter.VectorID != "" && vector.ID != filter.VectorID {
			continue
		}
		if filter.Family != "" && vector.Family != filter.Family {
			continue
		}
		if filter.Capability != "" && !containsString(vector.Capabilities, filter.Capability) {
			continue
		}
		selected = append(selected, vector)
	}
	if len(selected) == 0 {
		return nil, &SuiteError{Reason: "selection matched no vectors"}
	}

	report := &Report{
		Runner:           RunnerName,
		SuiteID:          manifest.SuiteID,
		SuiteRevision:    manifest.SuiteRevision,
		Families:         map[string]int{},
		Failures:         []Failure{},
		KnownDivergences: manifest.KnownDivergences,
	}
	for _, vector := range selected {
		report.Families[vector.Family]++
		if failure := runVector(manifest, schema, vector); failure != nil {
			report.Failures = append(report.Failures, *failure)
		}
	}
	report.Selected = len(selected)
	report.Passed = len(selected) - len(report.Failures)
	if len(report.Failures) == 0 {
		report.Status = "pass"
	} else {
		report.Status = "fail"
	}
	return report, nil
}

func containsString(items []string, wanted string) bool {
	for _, item := range items {
		if item == wanted {
			return true
		}
	}
	return false
}

func loadMutation(manifest *Manifest, vector *Vector) (*mutationRecord, error) {
	if vector.Mutation == nil || *vector.Mutation == "" {
		return nil, nil
	}
	raw, err := manifest.ReadSuiteFile(*vector.Mutation)
	if err != nil {
		return nil, err
	}
	mutation := &mutationRecord{}
	if err := json.Unmarshal(raw, mutation); err != nil {
		return nil, &SuiteError{Reason: fmt.Sprintf("%s: mutation record is not valid JSON", vector.ID)}
	}
	return mutation, nil
}

func keyCandidates(manifest *Manifest, vector *Vector, mutation *mutationRecord) ([]verifier.KeyCandidate, error) {
	if vector.KeyRef == nil || *vector.KeyRef == "" {
		return nil, nil
	}
	var keyFile string
	switch *vector.KeyRef {
	case "alpha2-historical":
		keyFile = "keys/alpha2-historical.public.pem"
	case "deterministic-001":
		keyFile = "keys/deterministic-001.public.raw.b64"
	default:
		return nil, &SuiteError{Reason: fmt.Sprintf("%s: unknown key_ref %q", vector.ID, *vector.KeyRef)}
	}
	raw, err := manifest.ReadSuiteFile(keyFile)
	if err != nil {
		return nil, err
	}
	public, loadErr := verifier.LoadPublicKey(raw, verifier.DefaultLimits())
	if loadErr != nil {
		return nil, &SuiteError{Reason: fmt.Sprintf("%s: %v", vector.ID, loadErr)}
	}
	declaredID := verifier.TruncatedKeyID(public)
	candidates := []verifier.KeyCandidate{{ID: declaredID, Key: public}}
	if mutation != nil {
		switch mutation.Operation {
		case "use_wrong_public_key":
			candidates = []verifier.KeyCandidate{{ID: declaredID, Key: deterministicWrongKey()}}
		case "ambiguous_key_resolution":
			candidates = append(candidates, verifier.KeyCandidate{ID: declaredID, Key: deterministicCollidingKey()})
		}
	}
	return candidates, nil
}

func runVector(manifest *Manifest, schema *resultSchema, vector *Vector) *Failure {
	fail := func(reason, detail string) *Failure {
		return &Failure{ID: vector.ID, Reason: reason, Detail: detail}
	}
	expectedRaw, err := manifest.ReadSuiteFile(vector.Expected)
	if err != nil {
		return fail("expected file unavailable", err.Error())
	}
	var expected map[string]any
	if err := json.Unmarshal(expectedRaw, &expected); err != nil {
		return fail("expected file is not valid JSON", "")
	}
	if expected["vector_id"] != vector.ID {
		return fail("expected file vector_id mismatch", "")
	}
	expectedVerification, ok := expected["verification"].(map[string]any)
	if !ok {
		return fail("expected verification object missing", "")
	}
	if err := schema.Validate(expectedVerification); err != nil {
		return fail("expected verification violates the result schema", err.Error())
	}

	mutation, err := loadMutation(manifest, vector)
	if err != nil {
		return fail("mutation record unavailable", err.Error())
	}
	outcome, failure := evaluateVector(manifest, vector, mutation)
	if failure != nil {
		return failure
	}

	actualDoc, err := decodeResult(outcome.Result)
	if err != nil {
		return fail("actual result could not be decoded", err.Error())
	}
	if err := schema.Validate(actualDoc); err != nil {
		return fail("actual result violates the result schema", err.Error())
	}
	if !jsonEqual(actualDoc, any(expectedVerification)) {
		return fail("verification result mismatch", diffResults(expectedVerification, actualDoc))
	}
	if failure := compareByteFacts(manifest, vector, expected, outcome); failure != nil {
		return failure
	}
	return nil
}

func decodeResult(result *verifier.Result) (map[string]any, error) {
	raw, err := result.MarshalDeterministic()
	if err != nil {
		return nil, err
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, err
	}
	return doc, nil
}

// compareByteFacts enforces the exact canonical bytes and computed hashes a
// vector declares, both against the committed canonical file and against the
// expected-file metadata.
func compareByteFacts(manifest *Manifest, vector *Vector, expected map[string]any, outcome *verifier.Outcome) *Failure {
	fail := func(reason, detail string) *Failure {
		return &Failure{ID: vector.ID, Reason: reason, Detail: detail}
	}
	if vector.Canonical != nil && *vector.Canonical != "" {
		recordedRaw, err := manifest.ReadSuiteFile(*vector.Canonical)
		if err != nil {
			return fail("canonical file unavailable", err.Error())
		}
		recorded, err := base64.StdEncoding.Strict().DecodeString(strings.TrimSpace(string(recordedRaw)))
		if err != nil {
			return fail("canonical file is not valid base64", "")
		}
		if outcome.Canonical == nil {
			return fail("canonical bytes were not produced", "")
		}
		if string(outcome.Canonical) != string(recorded) {
			return fail("canonical byte mismatch", fmt.Sprintf("expected %d bytes, produced %d bytes", len(recorded), len(outcome.Canonical)))
		}
		metadata, ok := expected["canonical"].(map[string]any)
		if !ok {
			return fail("expected canonical metadata absent", "")
		}
		if metadata["bytes_base64"] != base64.StdEncoding.EncodeToString(outcome.Canonical) {
			return fail("expected canonical base64 mismatch", "")
		}
		digest := sha256.Sum256(outcome.Canonical)
		if metadata["sha256_hex"] != fmt.Sprintf("%x", digest[:]) {
			return fail("expected canonical hash mismatch", "")
		}
	}
	// The expected file's top-level hash fields are vector provenance
	// metadata: they record the artifact's submitted hash even when
	// verification correctly stops before hashing or finds a mismatch. The
	// recomputed hash equals them only when the object_hash dimension
	// verified; a wrongly skipped or wrongly passing computation is already a
	// verification-result dimension mismatch above.
	if outcome.Result.ObjectHash == "valid" && outcome.ObjectHash != "" {
		for _, field := range []string{"object_hash", "event_hash"} {
			declared, ok := expected[field].(string)
			if !ok || declared == "" {
				continue
			}
			if outcome.ObjectHash != declared {
				return fail("computed "+field+" mismatch", "")
			}
		}
	}
	if declared, ok := expected["chain_head"].(string); ok && declared != "" && outcome.ChainHead != "" {
		if outcome.ChainHead != declared {
			return fail("chain head mismatch", "")
		}
	}
	return nil
}

func evaluateVector(manifest *Manifest, vector *Vector, mutation *mutationRecord) (*verifier.Outcome, *Failure) {
	fail := func(reason, detail string) *Failure {
		return &Failure{ID: vector.ID, Reason: reason, Detail: detail}
	}
	request := verifier.Request{Limits: verifier.DefaultLimits()}

	switch vector.Family {
	case "canonical":
		input, err := manifest.ReadSuiteFile(vector.Input)
		if err != nil {
			return nil, fail("input unavailable", err.Error())
		}
		request.Type = verifier.ArtifactLegacyValue
		request.Input = input
		if vector.ExpectedPrimaryIssue != nil && *vector.ExpectedPrimaryIssue == "specification_conflict" {
			request.DeclareSpecificationConflict = true
		}
		if mutation != nil && mutation.Operation == "drop_numeric_lexemes" {
			request.DropNumericLexemes = true
		}
	case "contract":
		input, err := manifest.ReadSuiteFile(vector.Input)
		if err != nil {
			return nil, fail("input unavailable", err.Error())
		}
		request.Type = verifier.ArtifactActionContract
		request.Input = input
	case "evidence":
		input, err := manifest.ReadSuiteFile(vector.Input)
		if err != nil {
			return nil, fail("input unavailable", err.Error())
		}
		request.Type = verifier.ArtifactEvidenceEvent
		request.Input = input
		keys, keyErr := keyCandidates(manifest, vector, mutation)
		if keyErr != nil {
			return nil, fail("key material unavailable", keyErr.Error())
		}
		request.Keys = keys
	case "chain":
		input, err := manifest.ReadSuiteFile(vector.Input)
		if err != nil {
			return nil, fail("input unavailable", err.Error())
		}
		request.Type = verifier.ArtifactEvidenceChain
		request.Input = input
		keys, keyErr := keyCandidates(manifest, vector, mutation)
		if keyErr != nil {
			return nil, fail("key material unavailable", keyErr.Error())
		}
		request.Keys = keys
		if mutation != nil {
			if mutation.Operation == "verify_partial_segment" && mutation.TrustedPrecedingHash != "" {
				anchor := &verifier.ChainAnchor{PrecedingHash: mutation.TrustedPrecedingHash, Decisions: map[string]string{}}
				if mutation.TrustedDecision != nil {
					anchor.Decisions[mutation.TrustedDecision.EventID] = mutation.TrustedDecision.Decision
				}
				request.Anchor = anchor
			}
			if mutation.Operation == "require_checkpoint_head" && mutation.RequiredHead != "" {
				request.RequiredHead = mutation.RequiredHead
			}
		}
	case "trust":
		overlayRaw, err := manifest.ReadSuiteFile(vector.Input)
		if err != nil {
			return nil, fail("trust overlay unavailable", err.Error())
		}
		overlay := &trustOverlayInput{}
		if err := json.Unmarshal(overlayRaw, overlay); err != nil {
			return nil, fail("trust overlay is not valid JSON", "")
		}
		base := manifest.VectorByID(overlay.ArtifactVectorID)
		if base == nil {
			return nil, fail("trust overlay references an unknown artifact vector", overlay.ArtifactVectorID)
		}
		input, err := manifest.ReadSuiteFile(base.Input)
		if err != nil {
			return nil, fail("referenced artifact input unavailable", err.Error())
		}
		request.Type = verifier.ArtifactEvidenceEvent
		request.Input = input
		keys, keyErr := keyCandidates(manifest, vector, mutation)
		if keyErr != nil {
			return nil, fail("key material unavailable", keyErr.Error())
		}
		request.Keys = keys
		request.Trust = &verifier.TrustOverlay{
			KeyResolution:      overlay.KeyResolution,
			KeyTrust:           overlay.KeyTrust,
			RevocationSnapshot: overlay.RevocationSnapshot,
			BindingEvaluation:  overlay.BindingEvaluation,
			TimeConfidence:     overlay.TimeConfidence,
		}
	default:
		return nil, fail("unsupported vector family", vector.Family)
	}
	return verifier.Verify(request), nil
}

// diffResults renders a bounded, secret-free field diff between the expected
// and actual verification results.
func diffResults(expected, actual map[string]any) string {
	keys := map[string]struct{}{}
	for key := range expected {
		keys[key] = struct{}{}
	}
	for key := range actual {
		keys[key] = struct{}{}
	}
	names := make([]string, 0, len(keys))
	for key := range keys {
		names = append(names, key)
	}
	sort.Strings(names)
	var parts []string
	for _, name := range names {
		if !jsonEqual(expected[name], actual[name]) {
			expectedJSON, _ := json.Marshal(expected[name])
			actualJSON, _ := json.Marshal(actual[name])
			parts = append(parts, fmt.Sprintf("%s: expected %s, actual %s", name, expectedJSON, actualJSON))
		}
	}
	if len(parts) > 6 {
		parts = parts[:6]
	}
	return strings.Join(parts, "; ")
}
