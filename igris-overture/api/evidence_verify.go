package api

// Server-side verification of Embedded SDK evidence (event schema v1).
//
// The payload is treated as hostile: every event hash is recomputed from the
// canonical unsigned payload bytes (igris-overture/internal/canonicaljson —
// byte-pinned to the Python SDK), every Ed25519 signature is verified over
// the raw digest, and chain linkage is checked. Issue codes reuse the SDK
// verifier vocabulary (sdk/python/src/igris/verification.py): unknown_schema,
// unknown_event_type, missing_fields, chain_break, hash_mismatch,
// unknown_key, bad_signature — plus server-side additions invalid_field,
// invalid_timestamp, invalid_transition, unknown_decision_reference.
//
// Verification success means cryptographic integrity and chain continuity
// relative to the submitted public key. It does NOT prove the external side
// effect occurred, that timestamps are trusted, that the host was
// uncompromised, or that the key belongs to a named person.

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/x509"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Igris-inertial/system/igris-overture/internal/canonicaljson"
)

const (
	evidenceEventSchemaVersion = "1"
	evidenceMaxIssues          = 20
	evidenceMaxEventIDChars    = 128
)

var evidenceEventTypes = map[string]bool{"decision": true, "outcome": true}
var evidenceDecisionValues = map[string]bool{"allowed": true, "denied": true}
var evidenceOutcomeStatuses = map[string]bool{"succeeded": true, "failed": true}

var evidenceSharedRequiredFields = []string{
	"schema_version", "event_type", "event_id", "action_id", "action_name",
	"contract_hash", "timestamp_utc", "key_id", "event_hash", "signature",
}
var evidenceDecisionRequiredFields = []string{
	"decision", "risk", "approval_mode", "redacted_input_summary", "input_hash",
}
var evidenceOutcomeRequiredFields = []string{"status", "decision_event_id"}

// verifiedEvidenceEvent is one event that passed full verification, carrying
// everything the store needs.
type verifiedEvidenceEvent struct {
	CanonicalEvent    []byte // canonical bytes of the full signed event
	EventHash         string // server-recomputed
	EventID           string
	EventType         string
	ActionName        string
	ContractHash      string
	PreviousEventHash *string
	TimestampUTC      time.Time
}

// parseSDKPublicKey decodes a SubjectPublicKeyInfo PEM into an Ed25519 key
// and returns the key with its server-computed identity. Only the public key
// is ever handled; nothing here can accept private material (a PKCS#8
// private-key PEM fails x509.ParsePKIXPublicKey).
func parseSDKPublicKey(pemText string) (pub ed25519.PublicKey, fingerprint string, keyID string, err error) {
	block, _ := pem.Decode([]byte(pemText))
	if block == nil || block.Type != "PUBLIC KEY" {
		return nil, "", "", errors.New("public_key_pem is not a PEM public key")
	}
	parsed, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, "", "", fmt.Errorf("public_key_pem does not parse: %w", err)
	}
	key, ok := parsed.(ed25519.PublicKey)
	if !ok {
		return nil, "", "", errors.New("public_key_pem is not an Ed25519 key")
	}
	sum := sha256.Sum256(key)
	fingerprint = hex.EncodeToString(sum[:])
	return key, fingerprint, "ed25519:" + fingerprint[:16], nil
}

// decisionLookup resolves a decision event from earlier batches of the same
// stream. Returns ("", sql.ErrNoRows) when unknown.
type decisionLookup func(eventID string) (string, error)

func storedDecisionLookup(ctx context.Context, q contractQuerier, tenantID, keyID string) decisionLookup {
	return func(eventID string) (string, error) {
		return getStoredDecision(ctx, q, tenantID, keyID, eventID)
	}
}

// verifyEvidenceEvents verifies the submitted events against the public key
// and the expected chain start. On success it returns the verified events in
// order; otherwise a bounded issue list. A database error from the decision
// lookup is returned as err (500 path), never conflated with rejection.
func verifyEvidenceEvents(events []map[string]any, pub ed25519.PublicKey, expectedKeyID string, firstPrev *string, lookup decisionLookup) ([]verifiedEvidenceEvent, []evidenceIssue, error) {
	issues := []evidenceIssue{}
	addIssue := func(index int, code string) {
		if len(issues) < evidenceMaxIssues {
			issues = append(issues, evidenceIssue{Index: index, Code: code})
		}
	}

	verified := make([]verifiedEvidenceEvent, 0, len(events))
	expectedPrev := firstPrev
	batchDecisions := map[string]string{} // event_id -> decision value
	outcomesSeen := map[string]bool{}     // decision_event_id -> outcome present

	for index, event := range events {
		eventOK := true
		fail := func(code string) {
			eventOK = false
			addIssue(index, code)
		}

		schemaVersion, _ := event["schema_version"].(string)
		if schemaVersion != evidenceEventSchemaVersion {
			fail("unknown_schema")
			return nil, issues, nil // field layout of unknown schemas is undefined
		}
		eventType, _ := event["event_type"].(string)
		if !evidenceEventTypes[eventType] {
			fail("unknown_event_type")
			return nil, issues, nil
		}

		required := append([]string{}, evidenceSharedRequiredFields...)
		if eventType == "decision" {
			required = append(required, evidenceDecisionRequiredFields...)
		} else {
			required = append(required, evidenceOutcomeRequiredFields...)
		}
		missing := false
		for _, field := range required {
			if _, present := event[field]; !present {
				missing = true
			}
		}
		if _, present := event["previous_event_hash"]; !present {
			missing = true
		}
		if missing {
			fail("missing_fields")
			return nil, issues, nil
		}

		// Typed field extraction. String-typed protocol fields that decode to
		// something else are invalid_field, mirroring "sane types" in the SDK.
		stringField := func(name string) (string, bool) {
			value, ok := event[name].(string)
			return value, ok
		}
		submittedHash, ok := stringField("event_hash")
		if !ok || !contractHashPattern.MatchString(submittedHash) {
			fail("invalid_field")
			return nil, issues, nil
		}
		signature, ok := stringField("signature")
		if !ok {
			fail("invalid_field")
			return nil, issues, nil
		}
		eventID, ok1 := stringField("event_id")
		actionName, ok2 := stringField("action_name")
		contractHash, ok3 := stringField("contract_hash")
		eventKeyID, ok4 := stringField("key_id")
		timestampText, ok5 := stringField("timestamp_utc")
		if !ok1 || !ok2 || !ok3 || !ok4 || !ok5 || eventID == "" ||
			len(eventID) > evidenceMaxEventIDChars {
			fail("invalid_field")
			return nil, issues, nil
		}
		// Fields stored in indexed columns keep the SDK's own shape rules:
		// action_name per igris.contracts.validate_action_name and
		// contract_hash as 64 lowercase hex.
		if !contractActionNamePattern.MatchString(actionName) ||
			!contractHashPattern.MatchString(contractHash) {
			fail("invalid_field")
			return nil, issues, nil
		}

		var previousHash *string
		switch prev := event["previous_event_hash"].(type) {
		case nil:
		case string:
			previousHash = &prev
		default:
			fail("invalid_field")
			return nil, issues, nil
		}

		timestamp, err := time.Parse(time.RFC3339Nano, timestampText)
		if err != nil {
			fail("invalid_timestamp")
			return nil, issues, nil
		}

		// Chain linkage against the expected previous hash (stored/submitted
		// hashes, mirroring the SDK verifier's single-issue-per-tamper rule).
		if !stringPtrEqual(previousHash, expectedPrev) {
			fail("chain_break")
		}

		// Hash integrity: recompute over the canonical unsigned payload.
		unsigned := make(map[string]any, len(event))
		for k, v := range event {
			if k == "event_hash" || k == "signature" {
				continue
			}
			unsigned[k] = v
		}
		canonicalUnsigned, err := canonicaljson.Encode(unsigned)
		if err != nil {
			fail("invalid_field")
			return nil, issues, nil
		}
		digest := sha256.Sum256(canonicalUnsigned)
		recomputedHash := hex.EncodeToString(digest[:])
		if recomputedHash != submittedHash {
			fail("hash_mismatch")
		}

		// Signature over the recomputed digest with the submitted key.
		if eventKeyID != expectedKeyID {
			fail("unknown_key")
		} else {
			rawSig, err := base64.StdEncoding.DecodeString(signature)
			if err != nil || !ed25519.Verify(pub, digest[:], rawSig) {
				fail("bad_signature")
			}
		}

		// Event-type transition semantics.
		if eventType == "decision" {
			decision, _ := stringField("decision")
			if !evidenceDecisionValues[decision] {
				fail("invalid_field")
			} else {
				batchDecisions[eventID] = decision
			}
		} else {
			status, _ := stringField("status")
			if !evidenceOutcomeStatuses[status] {
				fail("invalid_field")
			}
			decisionEventID, _ := stringField("decision_event_id")
			if decisionEventID == "" {
				fail("invalid_field")
			} else {
				decision, known := batchDecisions[decisionEventID]
				if !known && lookup != nil {
					stored, err := lookup(decisionEventID)
					if err == nil {
						decision, known = stored, true
					} else if err != sql.ErrNoRows {
						return nil, nil, err
					}
				}
				switch {
				case !known:
					fail("unknown_decision_reference")
				case decision == "denied":
					fail("invalid_transition") // a denial is terminal
				case outcomesSeen[decisionEventID]:
					fail("invalid_transition") // one outcome per decision
				default:
					outcomesSeen[decisionEventID] = true
				}
			}
		}

		if eventOK {
			canonicalFull, err := canonicaljson.Encode(event)
			if err != nil {
				fail("invalid_field")
			} else {
				verified = append(verified, verifiedEvidenceEvent{
					CanonicalEvent:    canonicalFull,
					EventHash:         recomputedHash,
					EventID:           eventID,
					EventType:         eventType,
					ActionName:        actionName,
					ContractHash:      contractHash,
					PreviousEventHash: previousHash,
					TimestampUTC:      timestamp.UTC(),
				})
			}
		}

		// Follow the chain on the SUBMITTED hash (single tampered payload =
		// one hash/signature issue, not cascading chain errors).
		expectedPrev = &submittedHash
	}

	if len(issues) > 0 {
		return nil, issues, nil
	}
	return verified, nil, nil
}

// dominantIssueCode picks the verification_error_code for a rejected batch.
func dominantIssueCode(issues []evidenceIssue) string {
	if len(issues) == 0 {
		return "verification_failed"
	}
	counts := map[string]int{}
	for _, issue := range issues {
		counts[issue.Code]++
	}
	best, bestCount := issues[0].Code, 0
	for code, count := range counts {
		if count > bestCount || (count == bestCount && code < best) {
			best, bestCount = code, count
		}
	}
	return best
}

// evidenceContentHash is the deterministic batch identity: SHA-256 over the
// key id plus the ordered manifest of SHA-256 hashes of the ACTUAL submitted
// canonical event bytes — not the events' claimed event_hash fields. A
// tampered payload that keeps its claimed event_hash therefore gets a
// DIFFERENT batch identity than the honest journal, so a stored rejected
// batch can never block later ingestion of the corrected evidence. The
// Python SDK derives its evidence-sync Idempotency-Key from the same rule;
// keep the two in lockstep (sdk/python/src/igris/evidence_sync.py).
func evidenceContentHash(keyID string, eventByteHashes []string) string {
	sum := sha256.Sum256([]byte("igris-evidence-batch:v1:" + keyID + ":" + strings.Join(eventByteHashes, ",")))
	return hex.EncodeToString(sum[:])
}

func stringPtrEqual(a, b *string) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}
