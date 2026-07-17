package verifier

import (
	"crypto/sha256"
	"encoding/hex"
)

// ArtifactType selects the verification operation.
type ArtifactType string

const (
	// ArtifactLegacyValue checks an arbitrary value against the schema-1
	// legacy canonical JSON profile (conformance level C1).
	ArtifactLegacyValue ArtifactType = "legacy-value"
	// ArtifactActionContract verifies an ActionContract schema-1 object.
	ArtifactActionContract ArtifactType = "action-contract"
	// ArtifactEvidenceEvent verifies one Evidence schema-1 event.
	ArtifactEvidenceEvent ArtifactType = "evidence-event"
	// ArtifactEvidenceChain verifies a JSONL Evidence schema-1 chain.
	ArtifactEvidenceChain ArtifactType = "evidence-chain"
)

// ChainAnchor supplies trusted out-of-band context for a partial chain
// segment: the expected preceding event hash and any trusted prior decisions
// that outcomes inside the segment may reference.
type ChainAnchor struct {
	PrecedingHash string
	Decisions     map[string]string // event_id -> "allowed"/"denied"
}

// TrustOverlay is the declarative trust/time input model from the frozen
// trust vectors. It never changes hash or signature facts; it only supplies
// the relying-party trust conclusion inputs.
type TrustOverlay struct {
	KeyResolution      string // resolved | unknown | ambiguous
	KeyTrust           string // trusted | untrusted | unknown
	RevocationSnapshot string // current | stale | absent | revoked
	BindingEvaluation  string // not_applicable | inside | outside | indeterminate
	TimeConfidence     string // registered time_confidence value
}

// Request describes one offline verification operation.
type Request struct {
	Type  ArtifactType
	Input []byte
	Keys  []KeyCandidate
	// Anchor supplies trusted chain context for partial segments.
	Anchor *ChainAnchor
	// RequiredHead, when set, is a trusted checkpoint head hash the chain
	// must reach; not reaching it is proven incompleteness.
	RequiredHead string
	// Trust, when set, layers the declarative trust overlay over a
	// successfully content-verified single event.
	Trust *TrustOverlay
	// DeclareSpecificationConflict simulates conflicting manifest-selected
	// normative artifacts (governance vectors): verification stops.
	DeclareSpecificationConflict bool
	// DropNumericLexemes simulates a host that lost original number tokens
	// (capability-failure vectors): verification fails closed.
	DropNumericLexemes bool
	Limits             Limits
}

// Outcome carries the portable result plus non-portable byte facts the
// conformance runner compares (canonical bytes, computed hashes).
type Outcome struct {
	Result *Result
	// Canonical is the reconstructed canonical byte sequence when one was
	// computed for a single artifact.
	Canonical []byte
	// ObjectHash is the computed lowercase hex hash when one was computed.
	ObjectHash string
	// ChainHead is the submitted hash of the last chain event.
	ChainHead string
}

func objectTypeFor(artifactType ArtifactType) string {
	switch artifactType {
	case ArtifactActionContract:
		return "action-contract"
	case ArtifactEvidenceEvent:
		return "evidence-event"
	case ArtifactEvidenceChain:
		return "evidence-chain"
	default:
		return "unknown"
	}
}

// Verify runs one bounded offline schema-1 verification and always returns a
// portable result. It performs no network, database, or environment access.
func Verify(req Request) *Outcome {
	if req.Limits == (Limits{}) {
		req.Limits = DefaultLimits()
	}
	objectType := objectTypeFor(req.Type)
	if req.DeclareSpecificationConflict {
		return &Outcome{Result: specificationConflictResult(objectType, req.Limits)}
	}
	switch req.Type {
	case ArtifactActionContract:
		return verifyContract(req)
	case ArtifactEvidenceEvent:
		return verifyEvidenceEvent(req)
	case ArtifactEvidenceChain:
		return verifyChain(req)
	default:
		return verifyLegacyValue(req)
	}
}

func sha256Hex(data []byte) string {
	digest := sha256.Sum256(data)
	return hex.EncodeToString(digest[:])
}

func schemaOne() *string {
	id := "1"
	return &id
}

// canonFailureResult maps a canonical-reconstruction rejection. An invalid
// Unicode scalar is canonical-domain invalidity; a lost number lexeme is a
// verifier capability limitation and fails closed as unsupported with every
// dependent check not evaluated.
func canonFailureResult(r *Result, err *CanonError, limits Limits) *Result {
	if err.Failure == CanonLexemeLost {
		r.Canonicalization = "unsupported"
		r.ObjectHash = "not_evaluated"
		r.Signature = "not_evaluated"
		r.KeyResolution = "not_evaluated"
		r.Issues = append(r.Issues, newIssue("unsupported_legacy_representation"))
		return r.finalize(limits)
	}
	r.Canonicalization = "invalid"
	r.Issues = append(r.Issues, newIssue("invalid_unicode_scalar"))
	return r.finalize(limits)
}

// verifyLegacyValue checks one arbitrary value against the legacy canonical
// profile: parse plus exact canonical reconstruction. No hash, signature, or
// semantic dimension applies.
func verifyLegacyValue(req Request) *Outcome {
	value, parseErr := ParseLegacyJSON(req.Input, req.Limits)
	if parseErr != nil {
		return &Outcome{Result: parseFailureResult("unknown", parseErr, req.Limits)}
	}
	if req.DropNumericLexemes {
		ClearNumberLexemes(value)
	}
	r := baseResult("unknown", schemaOne())
	canonical, canonErr := EncodeLegacyCanonical(value)
	if canonErr != nil {
		return &Outcome{Result: canonFailureResult(r, canonErr, req.Limits)}
	}
	r.EventsVerified = 1
	return &Outcome{
		Result:     r.finalize(req.Limits),
		Canonical:  canonical,
		ObjectHash: sha256Hex(canonical),
	}
}

// schemaFailureResult reports schema dispatch/shape failures with dependent
// checks not evaluated.
func schemaFailureResult(r *Result, check schemaCheck, limits Limits) *Result {
	r.Artifact.ObjectSchemaID = check.objectSchemaID
	if check.issue == "unsupported_schema" {
		r.Schema = "unsupported"
	} else {
		r.Schema = "invalid"
	}
	r.Canonicalization = "not_evaluated"
	r.ObjectHash = "not_evaluated"
	r.Semantics = "not_evaluated"
	r.Issues = append(r.Issues, newIssue(check.issue))
	return r.finalize(limits)
}

func verifyContract(req Request) *Outcome {
	object, parseErr := ParseLegacyJSON(req.Input, req.Limits)
	if parseErr != nil {
		return &Outcome{Result: parseFailureResult("action-contract", parseErr, req.Limits)}
	}
	if object.Kind != KindObject {
		return &Outcome{Result: parseFailureResult("action-contract",
			&ParseError{Failure: FailMalformed, reason: "contract is not a JSON object"}, req.Limits)}
	}
	r := baseResult("action-contract", schemaOne())
	if check := contractSchemaIssue(object); check.issue != "" {
		return &Outcome{Result: schemaFailureResult(r, check, req.Limits)}
	}
	if req.DropNumericLexemes {
		ClearNumberLexemes(object)
	}
	canonical, canonErr := EncodeLegacyCanonical(contractBodyWithoutHash(object))
	if canonErr != nil {
		r.ObjectHash = "not_evaluated"
		r.Semantics = "not_evaluated"
		return &Outcome{Result: canonFailureResult(r, canonErr, req.Limits)}
	}
	computed := sha256Hex(canonical)
	submitted := object.Lookup("contract_hash").Str
	r.Semantics = "valid"
	if computed != submitted {
		r.ObjectHash = "mismatch"
		r.Issues = append(r.Issues, newIssue("hash_mismatch"))
		return &Outcome{Result: r.finalize(req.Limits), Canonical: canonical, ObjectHash: computed}
	}
	r.ObjectHash = "valid"
	r.EventsVerified = 1
	return &Outcome{Result: r.finalize(req.Limits), Canonical: canonical, ObjectHash: computed}
}

// eventContent is the cryptographic content evaluation of one parsed event.
type eventContent struct {
	canonical []byte
	digest    []byte
	hashValid bool
	object    *Value
}

func verifyEvidenceEvent(req Request) *Outcome {
	object, parseErr := ParseLegacyJSON(req.Input, req.Limits)
	if parseErr != nil {
		return &Outcome{Result: parseFailureResult("evidence-event", parseErr, req.Limits)}
	}
	if object.Kind != KindObject {
		return &Outcome{Result: parseFailureResult("evidence-event",
			&ParseError{Failure: FailMalformed, reason: "event is not a JSON object"}, req.Limits)}
	}
	r := baseResult("evidence-event", schemaOne())
	if check := evidenceSchemaIssue(object); check.issue != "" {
		result := schemaFailureResult(r, check, req.Limits)
		// A single event that failed schema dispatch has no evaluable
		// signature/key/time dimensions.
		result.Signature = "not_evaluated"
		result.KeyResolution = "not_evaluated"
		result.TimeConfidence = "not_evaluated"
		result.Summary = deriveSummary(result)
		return &Outcome{Result: result}
	}
	if req.DropNumericLexemes {
		ClearNumberLexemes(object)
	}
	canonical, canonErr := EncodeLegacyCanonical(unsignedEventPayload(object))
	if canonErr != nil {
		r.ObjectHash = "not_evaluated"
		r.Signature = "not_evaluated"
		r.KeyResolution = "not_evaluated"
		r.Semantics = "not_evaluated"
		r.TimeConfidence = "not_evaluated"
		return &Outcome{Result: canonFailureResult(r, canonErr, req.Limits)}
	}
	digest := sha256.Sum256(canonical)
	content := eventContent{
		canonical: canonical,
		digest:    digest[:],
		hashValid: object.Lookup("event_hash").Str == hex.EncodeToString(digest[:]),
		object:    object,
	}
	r.Algorithm = "supported"
	outcome := &Outcome{Canonical: canonical, ObjectHash: hex.EncodeToString(digest[:])}

	if req.Trust != nil {
		outcome.Result = verifyWithTrustOverlay(r, content, req)
		return outcome
	}

	keyID := object.Lookup("key_id").Str
	key, resolution := resolveKey(keyID, req.Keys)
	if resolution != keyResolved {
		r.ObjectHash = hashDim(content.hashValid)
		if !content.hashValid {
			r.Issues = append(r.Issues, newIssue("hash_mismatch"))
		}
		r.Signature = "not_evaluated"
		r.Semantics = "not_evaluated"
		r.TimeConfidence = "not_evaluated"
		if resolution == keyAmbiguous {
			r.KeyResolution = "ambiguous"
			r.Issues = append(r.Issues, newIssue("ambiguous_key"))
		} else {
			r.KeyResolution = "unknown"
			r.Issues = append(r.Issues, newIssue("unknown_key"))
		}
		outcome.Result = r.finalize(req.Limits)
		return outcome
	}
	r.KeyResolution = "resolved"
	signatureValid := verifyEventSignature(object.Lookup("signature").Str, key, content.digest)
	if !content.hashValid || !signatureValid {
		r.ObjectHash = hashDim(content.hashValid)
		r.Signature = "invalid"
		r.Semantics = "not_evaluated"
		r.TimeConfidence = "not_evaluated"
		if !content.hashValid {
			r.Issues = append(r.Issues, newIssue("hash_mismatch"))
		}
		r.Issues = append(r.Issues, newIssue("invalid_signature"))
		outcome.Result = r.finalize(req.Limits)
		return outcome
	}
	r.ObjectHash = "valid"
	r.Signature = "valid"
	r.Semantics = "valid"
	r.EventsVerified = 1
	if eventHasUnknownFields(object) {
		r.Issues = append(r.Issues, newIssue("unknown_fields_present"))
	}
	// Default self-asserted trust conclusion: cryptographic validity never
	// implies trust, and the only time basis is the producer assertion.
	r.Trust = "unknown"
	r.TimeConfidence = "producer_asserted"
	r.Issues = append(r.Issues, newIssue("trust_unknown"), newIssue("producer_time_only"))
	outcome.Result = r.finalize(req.Limits)
	return outcome
}

func hashDim(valid bool) string {
	if valid {
		return "valid"
	}
	return "mismatch"
}

// verifyWithTrustOverlay layers the declarative trust overlay over the
// cryptographic content evaluation. Lifecycle semantics are outside the
// trust question (not_applicable). The overlay never upgrades or erases a
// cryptographic fact.
func verifyWithTrustOverlay(r *Result, content eventContent, req Request) *Result {
	overlay := req.Trust
	r.Semantics = "not_applicable"
	r.TimeConfidence = overlay.TimeConfidence
	r.ObjectHash = hashDim(content.hashValid)
	if !content.hashValid {
		r.Issues = append(r.Issues, newIssue("hash_mismatch"))
	}

	switch overlay.KeyResolution {
	case "unknown", "ambiguous":
		r.KeyResolution = overlay.KeyResolution
		r.Signature = "not_evaluated"
		r.Trust = "unknown"
		if overlay.KeyResolution == "unknown" {
			r.Issues = append(r.Issues, newIssue("unknown_key"))
		} else {
			r.Issues = append(r.Issues, newIssue("ambiguous_key"))
		}
		return r.finalize(req.Limits)
	}
	r.KeyResolution = "resolved"

	keyID := content.object.Lookup("key_id").Str
	key, resolution := resolveKey(keyID, req.Keys)
	if resolution != keyResolved {
		// The overlay asserted resolution but no usable key material was
		// supplied: fail closed as unknown key.
		r.KeyResolution = "unknown"
		r.Signature = "not_evaluated"
		r.Trust = "unknown"
		r.Issues = append(r.Issues, newIssue("unknown_key"))
		return r.finalize(req.Limits)
	}
	signatureValid := verifyEventSignature(content.object.Lookup("signature").Str, key, content.digest)
	if !content.hashValid || !signatureValid {
		r.Signature = "invalid"
		r.Trust = "not_evaluated"
		r.TimeConfidence = "not_evaluated"
		r.Issues = append(r.Issues, newIssue("invalid_signature"))
		return r.finalize(req.Limits)
	}
	r.Signature = "valid"
	r.EventsVerified = 1

	// Trust conclusion precedence over the declared overlay inputs. The
	// registered issue's dimension effect controls the trust value.
	switch {
	case overlay.RevocationSnapshot == "revoked":
		r.Trust = "revoked"
		r.Issues = append(r.Issues, newIssue("revoked_key"))
	case overlay.BindingEvaluation == "outside":
		r.Trust = "outside_binding_interval"
		r.Issues = append(r.Issues, newIssue("outside_binding_interval"))
	case overlay.BindingEvaluation == "indeterminate":
		r.Trust = "binding_interval_indeterminate"
		r.Issues = append(r.Issues, newIssue("binding_interval_indeterminate"))
	case overlay.KeyTrust == "untrusted":
		r.Trust = "untrusted"
		r.Issues = append(r.Issues, newIssue("untrusted_key"))
	case overlay.RevocationSnapshot == "stale":
		r.Trust = "unknown"
		r.Issues = append(r.Issues, newIssue("stale_trust_snapshot"))
	case overlay.KeyTrust == "trusted":
		r.Trust = "trusted"
	default:
		r.Trust = "unknown"
		r.Issues = append(r.Issues, newIssue("trust_unknown"))
	}
	return r.finalize(req.Limits)
}
