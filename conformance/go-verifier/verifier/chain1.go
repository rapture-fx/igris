package verifier

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
)

// verifyChain verifies a schema-1 Evidence JSONL chain: per-event bounded
// parse, schema shape, exact canonical reconstruction, hash and signature,
// previous-hash continuity from null genesis or a supplied trusted anchor,
// known decision/outcome lifecycle semantics, and completeness against an
// optional trusted required head.
//
// After an adverse event the walk follows the submitted hashes for
// diagnostic isolation, but the chain result remains adverse.
func verifyChain(req Request) *Outcome {
	if req.Limits.MaxInputBytes > 0 && len(req.Input) > req.Limits.MaxInputBytes {
		return &Outcome{Result: parseFailureResult("evidence-chain",
			&ParseError{Failure: FailResourceLimit, reason: "chain input exceeds the bounded size limit"}, req.Limits)}
	}
	lines := splitChainLines(req.Input)
	if len(lines) == 0 {
		return &Outcome{Result: parseFailureResult("evidence-chain",
			&ParseError{Failure: FailMalformed, reason: "chain contains no events"}, req.Limits)}
	}
	if req.Limits.MaxChainEvents > 0 && len(lines) > req.Limits.MaxChainEvents {
		return &Outcome{Result: parseFailureResult("evidence-chain",
			&ParseError{Failure: FailResourceLimit, reason: "chain exceeds the bounded event count"}, req.Limits)}
	}

	perEvent := req.Limits
	perEvent.MaxInputBytes = req.Limits.MaxEventBytes

	events := make([]*Value, 0, len(lines))
	for index, line := range lines {
		event, parseErr := ParseLegacyJSON(line, perEvent)
		if parseErr != nil {
			result := parseFailureResult("evidence-chain", parseErr, req.Limits)
			setEventIndex(result, index)
			return &Outcome{Result: result}
		}
		if event.Kind != KindObject {
			result := parseFailureResult("evidence-chain",
				&ParseError{Failure: FailMalformed, reason: "chain member is not a JSON object"}, req.Limits)
			setEventIndex(result, index)
			return &Outcome{Result: result}
		}
		events = append(events, event)
	}

	r := baseResult("evidence-chain", schemaOne())
	r.Continuity = "not_evaluated"
	r.Completeness = "not_evaluated"

	// Per-event schema and cryptographic evaluation.
	for index, event := range events {
		if check := evidenceSchemaIssue(event); check.issue != "" {
			result := schemaFailureResult(r, check, req.Limits)
			result.Signature = "not_evaluated"
			result.KeyResolution = "not_evaluated"
			result.TimeConfidence = "not_evaluated"
			result.Summary = deriveSummary(result)
			setEventIndex(result, index)
			return &Outcome{Result: result}
		}
	}
	if req.DropNumericLexemes {
		for _, event := range events {
			ClearNumberLexemes(event)
		}
	}

	type checkedEvent struct {
		object        *Value
		submittedHash string
		cryptoOK      bool
	}
	checked := make([]checkedEvent, 0, len(events))
	adverseCrypto := false
	for index, event := range events {
		canonical, canonErr := EncodeLegacyCanonical(unsignedEventPayload(event))
		if canonErr != nil {
			result := canonFailureResult(r, canonErr, req.Limits)
			setEventIndex(result, index)
			return &Outcome{Result: result}
		}
		digest := sha256.Sum256(canonical)
		submitted := event.Lookup("event_hash").Str
		hashValid := submitted == hex.EncodeToString(digest[:])
		key, resolution := resolveKey(event.Lookup("key_id").Str, req.Keys)
		signatureValid := false
		if resolution == keyResolved {
			signatureValid = verifyEventSignature(event.Lookup("signature").Str, key, digest[:])
		}
		ok := hashValid && resolution == keyResolved && signatureValid
		if !ok && !adverseCrypto {
			adverseCrypto = true
			index := index
			switch {
			case resolution == keyAmbiguous:
				r.KeyResolution = "ambiguous"
				r.Signature = "not_evaluated"
				r.Issues = append(r.Issues, Issue{Code: "ambiguous_key", Severity: "error", EventIndex: &index})
			case resolution == keyUnknown:
				r.KeyResolution = "unknown"
				r.Signature = "not_evaluated"
				r.Issues = append(r.Issues, Issue{Code: "unknown_key", Severity: "error", EventIndex: &index})
			default:
				if !hashValid {
					r.ObjectHash = "mismatch"
					r.Issues = append(r.Issues, Issue{Code: "hash_mismatch", Severity: "error", EventIndex: &index})
				}
				r.Signature = "invalid"
				r.Issues = append(r.Issues, Issue{Code: "invalid_signature", Severity: "error", EventIndex: &index})
			}
		}
		checked = append(checked, checkedEvent{object: event, submittedHash: submitted, cryptoOK: ok})
	}
	r.Algorithm = "supported"
	if !adverseCrypto {
		r.ObjectHash = "valid"
		r.Signature = "valid"
		r.KeyResolution = "resolved"
	}

	// Continuity walk over submitted hashes plus fork detection on signed
	// event identity, then the known schema-1 lifecycle semantics.
	var expectedPrevious *string
	anchored := false
	decisions := map[string]string{}
	if req.Anchor != nil {
		if req.Anchor.PrecedingHash != "" {
			anchor := req.Anchor.PrecedingHash
			expectedPrevious = &anchor
			anchored = true
		}
		for eventID, decision := range req.Anchor.Decisions {
			decisions[eventID] = decision
		}
	}
	identities := map[string]string{}
	outcomesSeen := map[string]struct{}{}
	continuityIssue := ""
	semanticIssue := ""
	verified := 0
	for _, item := range checked {
		event := item.object
		previous := event.Lookup("previous_event_hash")
		previousMatches := false
		if previous.Kind == KindNull {
			previousMatches = expectedPrevious == nil
		} else if expectedPrevious != nil {
			previousMatches = previous.Str == *expectedPrevious
		}
		eventID := event.Lookup("event_id").Str
		if known, seen := identities[eventID]; seen && known != item.submittedHash {
			if continuityIssue == "" || continuityIssue == "chain_discontinuity" {
				continuityIssue = "fork_detected"
			}
		} else if !previousMatches && continuityIssue == "" {
			continuityIssue = "chain_discontinuity"
		}
		identities[eventID] = item.submittedHash
		if previousMatches && item.cryptoOK {
			verified++
		}
		next := item.submittedHash
		expectedPrevious = &next

		if event.Lookup("event_type").Str == "decision" {
			decisions[eventID] = event.Lookup("decision").Str
		} else {
			decisionID := event.Lookup("decision_event_id").Str
			switch {
			case decisions[decisionID] == "":
				if semanticIssue == "" {
					semanticIssue = "unknown_decision_reference"
				}
			case decisions[decisionID] == "denied":
				if semanticIssue == "" {
					semanticIssue = "invalid_transition"
				}
			default:
				if _, duplicate := outcomesSeen[decisionID]; duplicate {
					if semanticIssue == "" {
						semanticIssue = "duplicate_outcome"
					}
				} else {
					outcomesSeen[decisionID] = struct{}{}
				}
			}
		}
	}
	r.EventsVerified = verified
	chainHead := checked[len(checked)-1].submittedHash
	outcome := &Outcome{ChainHead: chainHead}

	if continuityIssue != "" {
		r.Continuity = "discontinuous"
	} else if anchored {
		r.Continuity = "valid_anchored"
	} else {
		r.Continuity = "valid_genesis"
	}

	// Adverse reporting precedence: cryptographic failure, continuity,
	// lifecycle semantics. Trust and time are not evaluated for an adverse
	// chain; completeness stays unknown because no trusted head was proven.
	if adverseCrypto || continuityIssue != "" || semanticIssue != "" {
		r.Completeness = "completeness_unknown"
		r.TimeConfidence = "not_evaluated"
		if continuityIssue != "" {
			r.Semantics = "not_evaluated"
			r.Issues = append(r.Issues, newIssue(continuityIssue))
		} else if semanticIssue != "" && !adverseCrypto {
			r.Semantics = "invalid"
			r.Issues = append(r.Issues, newIssue(semanticIssue))
		} else {
			r.Semantics = "not_evaluated"
		}
		outcome.Result = r.finalize(req.Limits)
		return outcome
	}

	r.Semantics = "valid"
	r.Trust = "unknown"
	r.TimeConfidence = "producer_asserted"
	if req.RequiredHead != "" && chainHead != req.RequiredHead {
		// A trusted required head was supplied and the submitted chain does
		// not reach it: incompleteness is proven, not merely unknown.
		r.Completeness = "incomplete"
		r.Issues = append(r.Issues, newIssue("incomplete_chain"))
		outcome.Result = r.finalize(req.Limits)
		return outcome
	}
	if req.RequiredHead != "" {
		r.Completeness = "complete_to_checkpoint"
		r.Issues = append(r.Issues, newIssue("trust_unknown"), newIssue("producer_time_only"))
		outcome.Result = r.finalize(req.Limits)
		return outcome
	}
	r.Completeness = "completeness_unknown"
	r.Issues = append(r.Issues,
		newIssue("completeness_unknown"),
		newIssue("trust_unknown"),
		newIssue("producer_time_only"))
	for _, item := range checked {
		if eventHasUnknownFields(item.object) {
			r.Issues = append(r.Issues, newIssue("unknown_fields_present"))
			break
		}
	}
	outcome.Result = r.finalize(req.Limits)
	return outcome
}

func splitChainLines(input []byte) [][]byte {
	var lines [][]byte
	for _, line := range bytes.Split(input, []byte("\n")) {
		trimmed := bytes.TrimRight(line, "\r")
		if len(bytes.TrimSpace(trimmed)) == 0 {
			continue
		}
		lines = append(lines, trimmed)
	}
	return lines
}

func setEventIndex(result *Result, index int) {
	for i := range result.Issues {
		if result.Issues[i].EventIndex == nil {
			idx := index
			result.Issues[i].EventIndex = &idx
		}
	}
}
