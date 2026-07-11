package api

// Embedded SDK evidence ingestion — Connected slice 2
// (docs/architecture/igris-connected-api-v1.md §3–4).
//
// POST /v1/evidence/batches receives locally signed Embedded evidence,
// verifies it server-side synchronously (hash recomputation, Ed25519, chain
// linkage, transition semantics), and stores it tenant-scoped with
// execution_provenance=embedded — unconditionally: there is no request field
// for provenance and the storage CHECK admits no other value. Nothing on
// this path grants execution permission or touches Managed receipt storage.
//
// Security posture mirrors contract sync: tenant only from authentication;
// the client's hashes are never trusted (recomputed); idempotency keys are
// bound to the server-computed batch fingerprint; strict envelope decoding
// rejects tenant_id / execution_provenance anywhere in the request.

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/internal/canonicaljson"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

const (
	evidenceMaxBodyBytes       = 1 << 20 // 1 MiB
	evidenceMaxEvents          = 500
	evidenceMaxEventBytes      = 64 * 1024
	evidenceMaxKeyPEMBytes     = 4096
	evidenceMaxDepth           = 64
	evidenceRateLimitPerMinute = 20
	evidenceStateVerified      = "verified"
	evidenceStateRejected      = "rejected"
	evidenceProvenanceEmbedded = "embedded"
)

var evidenceKeyIDPattern = regexp.MustCompile(`^ed25519:[0-9a-f]{16}$`)

// RegisterEvidenceRoutes wires Embedded evidence ingestion and status reads.
// No approval, policy, dispatch, or Managed route is registered here.
func RegisterEvidenceRoutes(app *fiber.App, db *sql.DB) {
	v1 := app.Group("/v1/evidence")
	v1.Use(middleware.BetterAuth(db))
	v1.Use(middleware.NewRateLimiter(evidenceRateLimitPerMinute, time.Minute).RateLimitMiddleware())

	v1.Post("/batches", handleEvidenceBatchSubmit(db))
	v1.Get("/batches/:id", handleEvidenceBatchGet(db))
}

type evidenceSubmission struct {
	KeyID        string
	PublicKeyPEM string
	FirstPrev    *string
	Events       []map[string]any
	ContentHash  string
}

func handleEvidenceBatchSubmit(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}

		body := c.Body()
		if len(body) > evidenceMaxBodyBytes {
			return c.Status(http.StatusRequestEntityTooLarge).JSON(fiber.Map{
				"error":  "payload_too_large",
				"detail": "request body exceeds 1 MiB",
			})
		}
		idempotencyKey := strings.TrimSpace(c.Get("Idempotency-Key"))
		if idempotencyKey != "" && !contractIdempotencyKeyPattern.MatchString(idempotencyKey) {
			return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{
				"error":  "validation_failed",
				"detail": "Idempotency-Key must be 1-128 chars of [A-Za-z0-9._:-]",
			})
		}

		submission, verr := decodeEvidenceSubmission(body)
		if verr != nil {
			return c.Status(verr.status).JSON(fiber.Map{"error": verr.code, "detail": verr.detail})
		}

		// Public key: parse, and bind key_id to the server-derived identity.
		pub, fingerprint, derivedKeyID, err := parseSDKPublicKey(submission.PublicKeyPEM)
		if err != nil {
			return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{
				"error":  "validation_failed",
				"detail": "public_key_pem must be an Ed25519 SubjectPublicKeyInfo PEM",
			})
		}
		if derivedKeyID != submission.KeyID {
			return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{
				"error":  "validation_failed",
				"detail": "key_id does not match public_key_pem",
			})
		}
		existingKey, err := getSDKSigningKey(c.Context(), db, tenantID, submission.KeyID)
		if err != nil && err != sql.ErrNoRows {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if existingKey != nil && existingKey.FingerprintSHA256 != fingerprint {
			return c.Status(http.StatusConflict).JSON(fiber.Map{
				"error":  "signing_key_conflict",
				"detail": "this key_id is already registered for this tenant with a different public key",
			})
		}

		// Explicit idempotency (fingerprint = server-computed batch identity).
		if idempotencyKey != "" {
			record, err := getEvidenceIngestIdempotencyRecord(c.Context(), db, tenantID, submission.KeyID, idempotencyKey)
			if err != nil && err != sql.ErrNoRows {
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
			}
			if record != nil {
				if record.RequestFingerprint != submission.ContentHash {
					return c.Status(http.StatusConflict).JSON(fiber.Map{
						"error":  "idempotency_key_conflict",
						"detail": "this Idempotency-Key was already used with a different evidence batch; use a new key",
					})
				}
				c.Set("Idempotency-Replayed", "true")
				c.Set("Content-Type", "application/json")
				return c.Status(record.ResponseStatus).Send(record.ResponseBody)
			}
		}

		// Natural idempotency: byte-identical evidence replays its batch.
		existing, err := getEvidenceBatchByContent(c.Context(), db, tenantID, submission.KeyID, submission.ContentHash)
		if err != nil && err != sql.ErrNoRows {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if existing != nil {
			return respondEvidenceBatch(c, db, tenantID, submission, idempotencyKey, existing, fingerprint, false, http.StatusOK)
		}

		// Continuation: the batch must extend the stream's current head.
		expectedHead, err := currentEvidenceChainHead(c.Context(), db, tenantID, submission.KeyID)
		var expected *string
		if err == nil {
			expected = &expectedHead
		} else if err != sql.ErrNoRows {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if !stringPtrEqual(submission.FirstPrev, expected) {
			// A concurrent identical submission may have committed between
			// the content lookup and the chain-head read; replay it rather
			// than reporting a mismatch against our own evidence.
			raced, err := getEvidenceBatchByContent(c.Context(), db, tenantID, submission.KeyID, submission.ContentHash)
			if err != nil && err != sql.ErrNoRows {
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
			}
			if raced != nil {
				return respondEvidenceBatch(c, db, tenantID, submission, idempotencyKey, raced, fingerprint, false, http.StatusOK)
			}
			return evidenceChainMismatch(c, expected)
		}

		// Full hostile-input verification.
		verified, issues, err := verifyEvidenceEvents(
			submission.Events, pub, submission.KeyID, submission.FirstPrev,
			storedDecisionLookup(c.Context(), db, tenantID, submission.KeyID),
		)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Evidence] decision lookup failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		batch, status, verr2 := persistEvidenceBatch(c, db, tenantID, submission, fingerprint, verified, issues)
		if verr2 != nil {
			if verr2.code == "chain_head_mismatch" {
				head, err := currentEvidenceChainHead(c.Context(), db, tenantID, submission.KeyID)
				var current *string
				if err == nil {
					current = &head
				} else if err != sql.ErrNoRows {
					return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
				}
				return evidenceChainMismatch(c, current)
			}
			return c.Status(verr2.status).JSON(fiber.Map{"error": verr2.code, "detail": verr2.detail})
		}
		created := status == http.StatusAccepted
		return respondEvidenceBatch(c, db, tenantID, submission, idempotencyKey, batch, fingerprint, created, status)
	}
}

// persistEvidenceBatch stores the outcome atomically. Verified: signing key
// (first use), batch row, and every event. Rejected: bounded batch metadata
// only — no events, no key registration.
func persistEvidenceBatch(c *fiber.Ctx, db *sql.DB, tenantID string, submission *evidenceSubmission, fingerprint string, verified []verifiedEvidenceEvent, issues []evidenceIssue) (*evidenceBatchRecord, int, *contractValidationError) {
	ctx := c.Context()
	dbError := &contractValidationError{status: http.StatusInternalServerError, code: "db_error"}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, 0, dbError
	}
	defer func() { _ = tx.Rollback() }()

	record := &evidenceBatchRecord{
		KeyID:                  submission.KeyID,
		ContentHash:            submission.ContentHash,
		FirstPreviousEventHash: submission.FirstPrev,
		Issues:                 []evidenceIssue{},
	}

	if len(issues) > 0 {
		errorCode := dominantIssueCode(issues)
		record.EvidenceState = evidenceStateRejected
		record.VerificationErrorCode = &errorCode
		record.Issues = issues
		id, receivedAt, err := insertEvidenceBatch(ctx, tx,
			tenantID, submission.KeyID, evidenceStateRejected, submission.ContentHash,
			submission.FirstPrev, nil, 0, 0, nil, &errorCode, issues)
		if err == sql.ErrNoRows {
			return replayRacedEvidenceBatch(ctx, db, tenantID, submission)
		}
		if err != nil {
			return nil, 0, dbError
		}
		record.ID, record.ReceivedAt = id, receivedAt
		if err := tx.Commit(); err != nil {
			return nil, 0, dbError
		}
		return record, http.StatusAccepted, nil
	}

	// First-use key registration, then an in-transaction re-read: if a
	// concurrent request registered a DIFFERENT public key under this key_id
	// (which requires a fingerprint-prefix collision), the batch must not
	// commit against the wrong key.
	if err := insertSDKSigningKey(ctx, tx, tenantID, submission.KeyID, submission.PublicKeyPEM, fingerprint); err != nil {
		return nil, 0, dbError
	}
	storedKey, err := getSDKSigningKey(ctx, tx, tenantID, submission.KeyID)
	if err != nil {
		return nil, 0, dbError
	}
	if storedKey.FingerprintSHA256 != fingerprint {
		return nil, 0, &contractValidationError{
			status: http.StatusConflict,
			code:   "signing_key_conflict",
			detail: "this key_id is already registered for this tenant with a different public key",
		}
	}

	chainHead := verified[len(verified)-1].EventHash
	now := time.Now().UTC()
	id, receivedAt, err := insertEvidenceBatch(ctx, tx,
		tenantID, submission.KeyID, evidenceStateVerified, submission.ContentHash,
		submission.FirstPrev, &chainHead, len(verified), len(verified), &now, nil, nil)
	if err == sql.ErrNoRows {
		return replayRacedEvidenceBatch(ctx, db, tenantID, submission)
	}
	if err == errEvidenceChainSlotTaken {
		return nil, 0, &contractValidationError{status: http.StatusConflict, code: "chain_head_mismatch"}
	}
	if err != nil {
		return nil, 0, dbError
	}
	for _, event := range verified {
		if err := insertEvidenceEvent(ctx, tx,
			tenantID, submission.KeyID, event.EventHash, id, event.CanonicalEvent,
			event.EventID, event.EventType, event.ActionName, event.ContractHash,
			event.PreviousEventHash, event.TimestampUTC); err != nil {
			return nil, 0, dbError
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, 0, dbError
	}

	record.EvidenceState = evidenceStateVerified
	record.ChainHead = &chainHead
	record.EventsAccepted = len(verified)
	record.EventsVerified = len(verified)
	record.ID, record.ReceivedAt = id, receivedAt
	record.VerifiedAt = &now
	return record, http.StatusAccepted, nil
}

// replayRacedEvidenceBatch re-reads the batch a concurrent identical
// submission created first; natural idempotency makes the responses
// equivalent.
func replayRacedEvidenceBatch(ctx context.Context, db *sql.DB, tenantID string, submission *evidenceSubmission) (*evidenceBatchRecord, int, *contractValidationError) {
	record, err := getEvidenceBatchByContent(ctx, db, tenantID, submission.KeyID, submission.ContentHash)
	if err != nil {
		return nil, 0, &contractValidationError{status: http.StatusInternalServerError, code: "db_error"}
	}
	return record, http.StatusOK, nil
}

func evidenceChainMismatch(c *fiber.Ctx, expected *string) error {
	payload := fiber.Map{
		"error":  "chain_head_mismatch",
		"detail": "first_previous_event_hash does not extend this stream's stored chain head; resync from expected_head",
	}
	if expected != nil {
		payload["expected_head"] = *expected
	} else {
		payload["expected_head"] = nil
	}
	return c.Status(http.StatusConflict).JSON(payload)
}

func respondEvidenceBatch(c *fiber.Ctx, db *sql.DB, tenantID string, submission *evidenceSubmission, idempotencyKey string, record *evidenceBatchRecord, fingerprint string, created bool, status int) error {
	response := evidenceBatchJSON(record)
	response["created"] = created
	response["key_fingerprint_sha256"] = fingerprint

	responseBody, err := json.Marshal(response)
	if err != nil {
		return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
	}
	if idempotencyKey != "" {
		if err := insertEvidenceIngestIdempotencyRecord(c.Context(), db, tenantID, submission.KeyID, idempotencyKey, submission.ContentHash, status, responseBody); err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Evidence] idempotency record insert failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
	}
	c.Set("Content-Type", "application/json")
	return c.Status(status).Send(responseBody)
}

// evidenceBatchJSON is the shared batch representation for POST and GET.
// execution_provenance is emitted from the storage model, which structurally
// admits only "embedded" on this path.
func evidenceBatchJSON(record *evidenceBatchRecord) fiber.Map {
	issues := record.Issues
	if issues == nil {
		issues = []evidenceIssue{}
	}
	response := fiber.Map{
		"batch_id":             record.ID,
		"evidence_state":       record.EvidenceState,
		"execution_provenance": evidenceProvenanceEmbedded,
		"events_accepted":      record.EventsAccepted,
		"events_verified":      record.EventsVerified,
		"verification_key_id":  record.KeyID,
		"received_at":          contractTimestamp(record.ReceivedAt),
		"issues":               issues,
	}
	if record.FirstPreviousEventHash != nil {
		response["first_previous_event_hash"] = *record.FirstPreviousEventHash
	} else {
		response["first_previous_event_hash"] = nil
	}
	if record.ChainHead != nil {
		response["chain_head"] = *record.ChainHead
	} else {
		response["chain_head"] = nil
	}
	if record.VerifiedAt != nil {
		response["verified_at"] = contractTimestamp(*record.VerifiedAt)
	} else {
		response["verified_at"] = nil
	}
	if record.VerificationErrorCode != nil {
		response["verification_error_code"] = *record.VerificationErrorCode
	} else {
		response["verification_error_code"] = nil
	}
	return response
}

func handleEvidenceBatchGet(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		batchID := strings.TrimSpace(c.Params("id"))
		if _, err := uuid.Parse(batchID); err != nil {
			// Absent, other-tenant, and malformed ids are indistinguishable.
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "batch_not_found"})
		}
		record, err := getEvidenceBatchByID(c.Context(), db, tenantID, batchID)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "batch_not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(evidenceBatchJSON(record))
	}
}

// decodeEvidenceSubmission strictly decodes and bounds the request envelope.
// Verification of the evidence itself happens later; this stage rejects
// malformed shapes, prohibited fields, and out-of-bound sizes.
func decodeEvidenceSubmission(body []byte) (*evidenceSubmission, *contractValidationError) {
	fail := func(status int, code, detail string) (*evidenceSubmission, *contractValidationError) {
		return nil, &contractValidationError{status: status, code: code, detail: detail}
	}

	request, err := canonicaljson.DecodeObjectPreserving(body)
	if err != nil {
		return fail(http.StatusBadRequest, "invalid_body", "request must be a JSON object")
	}
	for key := range request {
		switch key {
		case "key_id", "public_key_pem", "journal_segment":
		default:
			// tenant_id, execution_provenance, or anything else caller-
			// controlled is never accepted here.
			return fail(http.StatusUnprocessableEntity, "validation_failed", "unexpected request field: "+key)
		}
	}

	keyID, _ := request["key_id"].(string)
	if !evidenceKeyIDPattern.MatchString(keyID) {
		return fail(http.StatusUnprocessableEntity, "validation_failed", "key_id must match ed25519:<16 hex>")
	}
	publicKeyPEM, _ := request["public_key_pem"].(string)
	if publicKeyPEM == "" || len(publicKeyPEM) > evidenceMaxKeyPEMBytes {
		return fail(http.StatusUnprocessableEntity, "validation_failed", "public_key_pem must be a PEM string of at most 4096 bytes")
	}
	segment, ok := request["journal_segment"].(map[string]any)
	if !ok {
		return fail(http.StatusBadRequest, "invalid_body", "journal_segment must be a JSON object")
	}
	for key := range segment {
		if key != "first_previous_event_hash" && key != "events" {
			return fail(http.StatusUnprocessableEntity, "validation_failed", "unexpected journal_segment field: "+key)
		}
	}

	var firstPrev *string
	switch value := segment["first_previous_event_hash"].(type) {
	case nil:
	case string:
		if !contractHashPattern.MatchString(value) {
			return fail(http.StatusUnprocessableEntity, "validation_failed", "first_previous_event_hash must be null or 64 lowercase hex chars")
		}
		firstPrev = &value
	default:
		return fail(http.StatusUnprocessableEntity, "validation_failed", "first_previous_event_hash must be null or a string")
	}

	eventsRaw, ok := segment["events"].([]any)
	if !ok || len(eventsRaw) == 0 {
		return fail(http.StatusUnprocessableEntity, "validation_failed", "journal_segment.events must be a non-empty array")
	}
	if len(eventsRaw) > evidenceMaxEvents {
		return fail(http.StatusUnprocessableEntity, "validation_failed", "journal_segment.events exceeds 500 entries")
	}

	events := make([]map[string]any, 0, len(eventsRaw))
	byteHashes := make([]string, 0, len(eventsRaw))
	for index, raw := range eventsRaw {
		event, ok := raw.(map[string]any)
		if !ok {
			return fail(http.StatusUnprocessableEntity, "validation_failed", "events entries must be objects")
		}
		for _, prohibited := range []string{"tenant_id", "execution_provenance"} {
			if _, present := event[prohibited]; present {
				return fail(http.StatusUnprocessableEntity, "validation_failed", "events must not carry "+prohibited)
			}
		}
		if depth := jsonDepth(event, 0); depth > evidenceMaxDepth {
			return fail(http.StatusUnprocessableEntity, "validation_failed", "event nesting exceeds maximum depth")
		}
		encoded, err := canonicaljson.Encode(event)
		if err != nil || len(encoded) > evidenceMaxEventBytes {
			return fail(http.StatusUnprocessableEntity, "validation_failed", "an event exceeds the per-event size limit")
		}
		if _, ok := event["event_hash"].(string); !ok || !contractHashPattern.MatchString(event["event_hash"].(string)) {
			return fail(http.StatusUnprocessableEntity, "validation_failed", "every event must carry a 64-hex event_hash")
		}
		// Batch identity commits to the ACTUAL submitted bytes (see
		// evidenceContentHash), never the claimed event_hash manifest.
		byteHashes = append(byteHashes, canonicaljson.SHA256Hex(encoded))
		if index == 0 {
			var eventPrev *string
			switch prev := event["previous_event_hash"].(type) {
			case nil:
			case string:
				eventPrev = &prev
			}
			if !stringPtrEqual(eventPrev, firstPrev) {
				return fail(http.StatusUnprocessableEntity, "validation_failed", "first_previous_event_hash must equal events[0].previous_event_hash")
			}
		}
		events = append(events, event)
	}

	return &evidenceSubmission{
		KeyID:        keyID,
		PublicKeyPEM: publicKeyPEM,
		FirstPrev:    firstPrev,
		Events:       events,
		ContentHash:  evidenceContentHash(keyID, byteHashes),
	}, nil
}

func jsonDepth(value any, depth int) int {
	if depth > evidenceMaxDepth {
		return depth
	}
	switch typed := value.(type) {
	case map[string]any:
		deepest := depth + 1
		for _, child := range typed {
			if d := jsonDepth(child, depth+1); d > deepest {
				deepest = d
			}
		}
		return deepest
	case []any:
		deepest := depth + 1
		for _, child := range typed {
			if d := jsonDepth(child, depth+1); d > deepest {
				deepest = d
			}
		}
		return deepest
	default:
		return depth
	}
}
