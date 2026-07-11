package api

// Persistence for Embedded SDK evidence ingestion (Connected slice 2).
//
// Discipline (same as contract_store.go): INSERT and SELECT only — accepted
// evidence is never rewritten and there is deliberately no UPDATE or DELETE
// statement in this file. Every predicate includes tenant_id; there is no
// tenant-null lookup path. Fork and duplicate prevention are database
// constraints (unique batch content, unique verified chain slot, event
// primary key), never application-level pre-checks alone.
//
// Nothing in this file touches task_records or Managed receipt storage:
// execution_provenance is fixed to 'embedded' by table CHECKs and is not a
// parameter of any function here.

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/lib/pq"
)

const evidenceIngestOperation = "evidence_ingest"

type evidenceIssue struct {
	Index int    `json:"index"`
	Code  string `json:"code"`
}

type sdkSigningKeyRecord struct {
	PublicKeyPEM      string
	FingerprintSHA256 string
}

func getSDKSigningKey(ctx context.Context, q contractQuerier, tenantID, keyID string) (*sdkSigningKeyRecord, error) {
	var rec sdkSigningKeyRecord
	err := q.QueryRowContext(ctx, `
		SELECT public_key_pem, fingerprint_sha256
		FROM sdk_signing_keys
		WHERE tenant_id = $1 AND key_id = $2
	`, tenantID, keyID).Scan(&rec.PublicKeyPEM, &rec.FingerprintSHA256)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

// insertSDKSigningKey registers a public key on first verified use. A
// concurrent duplicate insert is resolved by the primary key; the caller has
// already checked fingerprint consistency against any existing record.
func insertSDKSigningKey(ctx context.Context, q contractQuerier, tenantID, keyID, publicKeyPEM, fingerprint string) error {
	_, err := q.ExecContext(ctx, `
		INSERT INTO sdk_signing_keys (tenant_id, key_id, public_key_pem, fingerprint_sha256)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (tenant_id, key_id) DO NOTHING
	`, tenantID, keyID, publicKeyPEM, fingerprint)
	return err
}

type evidenceBatchRecord struct {
	ID                     string
	KeyID                  string
	EvidenceState          string
	ContentHash            string
	FirstPreviousEventHash *string
	ChainHead              *string
	EventsAccepted         int
	EventsVerified         int
	ReceivedAt             time.Time
	VerifiedAt             *time.Time
	VerificationErrorCode  *string
	Issues                 []evidenceIssue
}

const evidenceBatchColumns = `
	id, key_id, evidence_state, content_hash, first_previous_event_hash,
	chain_head, events_accepted, events_verified, received_at, verified_at,
	verification_error_code, issues`

func scanEvidenceBatch(row *sql.Row) (*evidenceBatchRecord, error) {
	var rec evidenceBatchRecord
	var firstPrev, chainHead, errCode sql.NullString
	var verifiedAt sql.NullTime
	var issues []byte
	err := row.Scan(
		&rec.ID, &rec.KeyID, &rec.EvidenceState, &rec.ContentHash, &firstPrev,
		&chainHead, &rec.EventsAccepted, &rec.EventsVerified, &rec.ReceivedAt,
		&verifiedAt, &errCode, &issues,
	)
	if err != nil {
		return nil, err
	}
	if firstPrev.Valid {
		rec.FirstPreviousEventHash = &firstPrev.String
	}
	if chainHead.Valid {
		rec.ChainHead = &chainHead.String
	}
	if verifiedAt.Valid {
		t := verifiedAt.Time
		rec.VerifiedAt = &t
	}
	if errCode.Valid {
		rec.VerificationErrorCode = &errCode.String
	}
	if len(issues) > 0 {
		_ = json.Unmarshal(issues, &rec.Issues)
	}
	return &rec, nil
}

func getEvidenceBatchByContent(ctx context.Context, q contractQuerier, tenantID, keyID, contentHash string) (*evidenceBatchRecord, error) {
	row := q.QueryRowContext(ctx, `
		SELECT `+evidenceBatchColumns+`
		FROM sdk_evidence_batches
		WHERE tenant_id = $1 AND key_id = $2 AND content_hash = $3
	`, tenantID, keyID, contentHash)
	return scanEvidenceBatch(row)
}

func getEvidenceBatchByID(ctx context.Context, q contractQuerier, tenantID, batchID string) (*evidenceBatchRecord, error) {
	row := q.QueryRowContext(ctx, `
		SELECT `+evidenceBatchColumns+`
		FROM sdk_evidence_batches
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, batchID)
	return scanEvidenceBatch(row)
}

// currentEvidenceChainHead returns the terminal chain head for the stream
// (tenant, key): the verified batch head that no other verified batch
// extends. sql.ErrNoRows means the stream has no verified batch yet
// (genesis expected).
func currentEvidenceChainHead(ctx context.Context, q contractQuerier, tenantID, keyID string) (string, error) {
	var head string
	err := q.QueryRowContext(ctx, `
		SELECT b.chain_head
		FROM sdk_evidence_batches b
		WHERE b.tenant_id = $1 AND b.key_id = $2 AND b.evidence_state = 'verified'
		  AND NOT EXISTS (
			SELECT 1 FROM sdk_evidence_batches n
			WHERE n.tenant_id = $1 AND n.key_id = $2 AND n.evidence_state = 'verified'
			  AND n.first_previous_event_hash = b.chain_head
		  )
		ORDER BY b.received_at DESC
		LIMIT 1
	`, tenantID, keyID).Scan(&head)
	if err != nil {
		return "", err
	}
	return head, nil
}

// errEvidenceChainSlotTaken reports that another VERIFIED batch already
// extends the same chain position (fork attempt or lost continuation race).
var errEvidenceChainSlotTaken = errors.New("evidence chain slot already extended by a verified batch")

// insertEvidenceBatch appends a batch row. Returns (id, receivedAt).
//   - content-identity race: ON CONFLICT DO NOTHING → sql.ErrNoRows, caller
//     re-reads the surviving row and replays it;
//   - chain-slot race/fork (verified batches only): the partial unique index
//     raises, mapped to errEvidenceChainSlotTaken.
func insertEvidenceBatch(ctx context.Context, q contractQuerier, tenantID, keyID, state, contentHash string, firstPrev, chainHead *string, eventsAccepted, eventsVerified int, verifiedAt *time.Time, errorCode *string, issues []evidenceIssue) (string, time.Time, error) {
	if issues == nil {
		issues = []evidenceIssue{}
	}
	issuesJSON, err := json.Marshal(issues)
	if err != nil {
		return "", time.Time{}, err
	}
	var id string
	var receivedAt time.Time
	err = q.QueryRowContext(ctx, `
		INSERT INTO sdk_evidence_batches (
			tenant_id, key_id, evidence_state, content_hash,
			first_previous_event_hash, chain_head, events_accepted,
			events_verified, verified_at, verification_error_code, issues
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (tenant_id, key_id, content_hash) DO NOTHING
		RETURNING id, received_at
	`, tenantID, keyID, state, contentHash,
		nullableStringPtr(firstPrev), nullableStringPtr(chainHead),
		eventsAccepted, eventsVerified, nullableTime(verifiedAt),
		nullableStringPtr(errorCode), issuesJSON,
	).Scan(&id, &receivedAt)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" &&
			strings.Contains(pqErr.Constraint, "chain_slot") {
			return "", time.Time{}, errEvidenceChainSlotTaken
		}
		return "", time.Time{}, err
	}
	return id, receivedAt, nil
}

func insertEvidenceEvent(ctx context.Context, q contractQuerier, tenantID, keyID, eventHash, batchID string, eventJSON []byte, eventID, eventType, actionName, contractHash string, previousEventHash *string, timestampUTC time.Time) error {
	_, err := q.ExecContext(ctx, `
		INSERT INTO sdk_evidence_events (
			tenant_id, key_id, event_hash, batch_id, event, event_id,
			event_type, action_name, contract_hash, previous_event_hash,
			timestamp_utc
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (tenant_id, key_id, event_hash) DO NOTHING
	`, tenantID, keyID, eventHash, batchID, eventJSON, eventID,
		eventType, actionName, contractHash, nullableStringPtr(previousEventHash), timestampUTC)
	return err
}

// getStoredDecision looks up a previously stored decision event by event_id
// so a continuation batch's outcome can reference a decision from an earlier
// batch. Returns the decision value ("allowed"/"denied").
func getStoredDecision(ctx context.Context, q contractQuerier, tenantID, keyID, eventID string) (string, error) {
	var decision sql.NullString
	err := q.QueryRowContext(ctx, `
		SELECT event->>'decision'
		FROM sdk_evidence_events
		WHERE tenant_id = $1 AND key_id = $2 AND event_id = $3 AND event_type = 'decision'
		LIMIT 1
	`, tenantID, keyID, eventID).Scan(&decision)
	if err != nil {
		return "", err
	}
	return decision.String, nil
}

func getEvidenceIngestIdempotencyRecord(ctx context.Context, q contractQuerier, tenantID, keyID, key string) (*contractSyncIdempotencyRecord, error) {
	var rec contractSyncIdempotencyRecord
	err := q.QueryRowContext(ctx, `
		SELECT request_fingerprint, response_status, response_body
		FROM evidence_ingest_idempotency
		WHERE tenant_id = $1 AND operation = $2 AND key_id = $3 AND idempotency_key = $4
	`, tenantID, evidenceIngestOperation, keyID, key).Scan(
		&rec.RequestFingerprint, &rec.ResponseStatus, &rec.ResponseBody,
	)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func insertEvidenceIngestIdempotencyRecord(ctx context.Context, q contractQuerier, tenantID, keyID, key, fingerprint string, status int, body []byte) error {
	_, err := q.ExecContext(ctx, `
		INSERT INTO evidence_ingest_idempotency (
			tenant_id, operation, key_id, idempotency_key,
			request_fingerprint, response_status, response_body
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (tenant_id, operation, key_id, idempotency_key) DO NOTHING
	`, tenantID, evidenceIngestOperation, keyID, key, fingerprint, status, body)
	return err
}

// nullableStringPtr converts a nil pointer to SQL NULL. (nullableString in
// routes_runtime.go maps the empty string instead; evidence chain fields must
// distinguish "genesis" nil from an empty value, hence the pointer form.)
func nullableStringPtr(s *string) interface{} {
	if s == nil {
		return nil
	}
	return *s
}

func nullableTime(t *time.Time) interface{} {
	if t == nil {
		return nil
	}
	return *t
}
