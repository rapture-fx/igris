package api

import (
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/x509"
	"database/sql"
	"database/sql/driver"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/internal/canonicaljson"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const evidenceFixtureDir = "../../testdata/igris-contract-v1"

func evidenceTestApp(db *sql.DB, tenantID string) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		if tenantID != "" {
			c.Locals("clerk_user_id", tenantID)
		}
		return c.Next()
	})
	app.Post("/v1/evidence/batches", handleEvidenceBatchSubmit(db))
	app.Get("/v1/evidence/batches/:id", handleEvidenceBatchGet(db))
	return app
}

// loadFixtureJournal returns the Python-SDK-generated journal events (number
// literals preserved) and the matching public key PEM. This is the
// cross-language authority: hashes and signatures in these events were
// produced by the real Python SDK, including unicode/special characters.
func loadFixtureJournal(t *testing.T) (events []map[string]any, publicKeyPEM string, keyID string) {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(evidenceFixtureDir, "journal.jsonl"))
	require.NoError(t, err)
	for _, line := range strings.Split(strings.TrimSpace(string(raw)), "\n") {
		event, err := canonicaljson.DecodeObjectPreserving([]byte(line))
		require.NoError(t, err)
		events = append(events, event)
	}
	require.NotEmpty(t, events)
	pemBytes, err := os.ReadFile(filepath.Join(evidenceFixtureDir, "verify_key.pem"))
	require.NoError(t, err)
	keyID, ok := events[0]["key_id"].(string)
	require.True(t, ok)
	return events, string(pemBytes), keyID
}

func evidenceBody(t *testing.T, keyID, publicKeyPEM string, firstPrev any, events []map[string]any) []byte {
	t.Helper()
	body, err := json.Marshal(map[string]any{
		"key_id":         keyID,
		"public_key_pem": publicKeyPEM,
		"journal_segment": map[string]any{
			"first_previous_event_hash": firstPrev,
			"events":                    events,
		},
	})
	require.NoError(t, err)
	return body
}

func postEvidence(t *testing.T, app *fiber.App, body []byte, headers map[string]string) (*http.Response, map[string]any) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/v1/evidence/batches", strings.NewReader(string(body)))
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	raw, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	var decoded map[string]any
	if len(raw) > 0 {
		require.NoError(t, json.Unmarshal(raw, &decoded), "body: %s", raw)
	}
	return resp, decoded
}

// signedTestEvent builds a schema-v1 event signed with a Go-generated
// Ed25519 key, canonicalized by the production canonicalizer. Used for
// chain-shape scenarios the static Python fixture cannot express.
type testSigner struct {
	priv  ed25519.PrivateKey
	pub   ed25519.PublicKey
	pem   string
	keyID string
}

func newTestSigner(t *testing.T) *testSigner {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	der, err := x509.MarshalPKIXPublicKey(pub)
	require.NoError(t, err)
	pemText := string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der}))
	sum := sha256.Sum256(pub)
	return &testSigner{
		priv:  priv,
		pub:   pub,
		pem:   pemText,
		keyID: "ed25519:" + hex.EncodeToString(sum[:])[:16],
	}
}

func (s *testSigner) event(t *testing.T, eventType, eventID string, previous any, extra map[string]any) map[string]any {
	t.Helper()
	payload := map[string]any{
		"schema_version":      "1",
		"event_type":          eventType,
		"event_id":            eventID,
		"action_id":           "tests.evidence.action",
		"action_name":         "tests.evidence.action",
		"contract_hash":       strings.Repeat("ab", 32),
		"timestamp_utc":       "2026-07-11T10:00:00.000000Z",
		"key_id":              s.keyID,
		"previous_event_hash": previous,
	}
	if eventType == "decision" {
		payload["decision"] = "allowed"
		payload["risk"] = "high"
		payload["approval_mode"] = "never"
		payload["redacted_input_summary"] = "x=1"
		payload["input_hash"] = strings.Repeat("cd", 32)
	} else {
		payload["status"] = "succeeded"
		payload["decision_event_id"] = "missing-decision"
	}
	for k, v := range extra {
		payload[k] = v
	}
	canonical, err := canonicaljson.Encode(payload)
	require.NoError(t, err)
	digest := sha256.Sum256(canonical)
	payload["event_hash"] = hex.EncodeToString(digest[:])
	payload["signature"] = base64.StdEncoding.EncodeToString(ed25519.Sign(s.priv, digest[:]))
	return payload
}

// chain builds a linked decision(+outcome) chain of n events.
func (s *testSigner) chain(t *testing.T, n int) []map[string]any {
	t.Helper()
	events := make([]map[string]any, 0, n)
	var prev any
	for i := 0; i < n; i++ {
		var event map[string]any
		if i%2 == 0 {
			event = s.event(t, "decision", "evt-"+strings.Repeat("d", 3)+"-"+hex.EncodeToString([]byte{byte(i)}), prev, nil)
		} else {
			decisionID := events[i-1]["event_id"].(string)
			event = s.event(t, "outcome", "evt-o-"+hex.EncodeToString([]byte{byte(i)}), prev, map[string]any{
				"decision_event_id": decisionID,
			})
		}
		events = append(events, event)
		prev = event["event_hash"]
	}
	return events
}

// ---------------------------------------------------------------------------
// Authentication and tenant derivation
// ---------------------------------------------------------------------------

func TestEvidenceSubmitUnauthenticatedRejected(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	app := evidenceTestApp(db, "")

	resp, body := postEvidence(t, app, []byte("{}"), nil)
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	require.Equal(t, "unauthenticated", body["error"])
	require.Equal(t, 0, drv.remainingQueries())
}

func TestEvidenceRegisteredRoutesRequireBetterAuth(t *testing.T) {
	t.Parallel()
	// Through the real registration (BetterAuth middleware), a request with
	// no session and no API key never reaches the handler.
	db, _ := newQueuedRouteDB(t, nil)
	app := fiber.New()
	RegisterEvidenceRoutes(app, db)

	for _, route := range []struct{ method, path string }{
		{http.MethodPost, "/v1/evidence/batches"},
		{http.MethodGet, "/v1/evidence/batches/00000000-0000-0000-0000-000000000000"},
	} {
		req := httptest.NewRequest(route.method, route.path, strings.NewReader("{}"))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req, -1)
		require.NoError(t, err)
		require.Equal(t, http.StatusUnauthorized, resp.StatusCode, "%s %s", route.method, route.path)
	}
}

func TestEvidenceSubmitBodyTenantAndProvenanceFieldsRejected(t *testing.T) {
	t.Parallel()
	events, pemText, keyID := loadFixtureJournal(t)

	for _, field := range []string{"tenant_id", "execution_provenance"} {
		// Top-level injection.
		db, drv := newQueuedRouteDB(t, nil)
		app := evidenceTestApp(db, "tenant-a")
		var envelope map[string]any
		require.NoError(t, json.Unmarshal(evidenceBody(t, keyID, pemText, nil, events), &envelope))
		envelope[field] = "managed"
		body, err := json.Marshal(envelope)
		require.NoError(t, err)
		resp, decoded := postEvidence(t, app, body, nil)
		require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
		require.Equal(t, "validation_failed", decoded["error"])
		require.Contains(t, decoded["detail"], field)
		require.Equal(t, 0, drv.remainingQueries(), "nothing may be stored")

		// Injection inside an event.
		db2, drv2 := newQueuedRouteDB(t, nil)
		app2 := evidenceTestApp(db2, "tenant-a")
		tampered := make([]map[string]any, len(events))
		copy(tampered, events)
		clone := map[string]any{}
		for k, v := range events[0] {
			clone[k] = v
		}
		clone[field] = "managed"
		tampered[0] = clone
		resp, decoded = postEvidence(t, app2, evidenceBody(t, keyID, pemText, nil, tampered), nil)
		require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
		require.Equal(t, "validation_failed", decoded["error"])
		require.Contains(t, decoded["detail"], field)
		require.Equal(t, 0, drv2.remainingQueries(), "nothing may be stored")
	}
}

func TestEvidenceTenantComesFromAuthContext(t *testing.T) {
	t.Parallel()
	events, pemText, keyID := loadFixtureJournal(t)
	_, fingerprint, _, err := parseSDKPublicKey(pemText)
	require.NoError(t, err)
	received := time.Date(2026, 7, 11, 10, 0, 0, 0, time.UTC)

	assertTenant := func(query string, args []driver.NamedValue) {
		assertAppendOnly(t)(query, args)
		require.NotEmpty(t, args)
		require.Equal(t, "tenant-auth", args[0].Value, "every statement must be scoped to the authenticated tenant: %s", query)
	}
	db, drv := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{columns: []string{"public_key_pem", "fingerprint_sha256"}, rows: nil, checkArgs: assertTenant},                                      // key lookup: absent
			{columns: evidenceBatchTestCols, rows: nil, checkArgs: assertTenant},                                                                 // content lookup: absent
			{columns: []string{"chain_head"}, rows: nil, checkArgs: assertTenant},                                                                // chain head: genesis
			{columns: []string{"public_key_pem", "fingerprint_sha256"}, rows: [][]driver.Value{{pemText, fingerprint}}, checkArgs: assertTenant}, // in-tx re-read
			{columns: []string{"id", "received_at"}, rows: [][]driver.Value{{"batch-uuid-1", received}}, checkArgs: assertTenant},                // batch insert returning
		},
		queuedRouteExecExpectation{rowsAffected: 1, check: assertTenant}, // key insert
		queuedRouteExecExpectation{rowsAffected: 1, check: assertTenant}, // event 1
		queuedRouteExecExpectation{rowsAffected: 1, check: assertTenant}, // event 2
		queuedRouteExecExpectation{rowsAffected: 1, check: assertTenant}, // event 3
		queuedRouteExecExpectation{rowsAffected: 1, check: assertTenant}, // event 4
		queuedRouteExecExpectation{rowsAffected: 1, check: assertTenant}, // event 5
	)
	app := evidenceTestApp(db, "tenant-auth")

	resp, body := postEvidence(t, app, evidenceBody(t, keyID, pemText, nil, events), nil)
	require.Equal(t, http.StatusAccepted, resp.StatusCode, "body: %v", body)
	require.Equal(t, 0, drv.remainingQueries())
	require.Equal(t, 0, drv.remainingExecs())

	require.Equal(t, "verified", body["evidence_state"])
	require.Equal(t, "embedded", body["execution_provenance"])
	require.Equal(t, true, body["created"])
	require.Equal(t, float64(len(events)), body["events_accepted"])
	require.Equal(t, keyID, body["verification_key_id"])
	require.Equal(t, fingerprint, body["key_fingerprint_sha256"])
	require.Equal(t, events[len(events)-1]["event_hash"], body["chain_head"])
}

var evidenceBatchTestCols = []string{
	"id", "key_id", "evidence_state", "content_hash", "first_previous_event_hash",
	"chain_head", "events_accepted", "events_verified", "received_at", "verified_at",
	"verification_error_code", "issues",
}

// ---------------------------------------------------------------------------
// Envelope validation (all failures happen before any DB access)
// ---------------------------------------------------------------------------

func TestEvidenceSubmitValidationRejections(t *testing.T) {
	t.Parallel()
	events, pemText, keyID := loadFixtureJournal(t)
	firstHash := events[0]["event_hash"].(string)

	cases := []struct {
		name       string
		body       func(t *testing.T) []byte
		wantStatus int
		wantError  string
	}{
		{
			name:       "malformed JSON",
			body:       func(t *testing.T) []byte { return []byte("{not json") },
			wantStatus: http.StatusBadRequest, wantError: "invalid_body",
		},
		{
			name:       "trailing garbage",
			body:       func(t *testing.T) []byte { return []byte(`{}garbage`) },
			wantStatus: http.StatusBadRequest, wantError: "invalid_body",
		},
		{
			name: "unknown top-level field",
			body: func(t *testing.T) []byte {
				return []byte(`{"key_id":"` + keyID + `","public_key_pem":"x","journal_segment":{"first_previous_event_hash":null,"events":[{}]},"extra":1}`)
			},
			wantStatus: http.StatusUnprocessableEntity, wantError: "validation_failed",
		},
		{
			name: "bad key_id shape",
			body: func(t *testing.T) []byte {
				return evidenceBody(t, "rsa:deadbeef", pemText, nil, events)
			},
			wantStatus: http.StatusUnprocessableEntity, wantError: "validation_failed",
		},
		{
			name: "key_id does not match public key",
			body: func(t *testing.T) []byte {
				return evidenceBody(t, "ed25519:0000000000000000", pemText, nil, events)
			},
			wantStatus: http.StatusUnprocessableEntity, wantError: "validation_failed",
		},
		{
			name: "non-PEM public key",
			body: func(t *testing.T) []byte {
				return evidenceBody(t, keyID, "not a pem", nil, events)
			},
			wantStatus: http.StatusUnprocessableEntity, wantError: "validation_failed",
		},
		{
			name: "private key PEM is refused",
			body: func(t *testing.T) []byte {
				// A PKCS#8 Ed25519 PRIVATE key must never be accepted.
				_, priv, err := ed25519.GenerateKey(nil)
				require.NoError(t, err)
				der, err := x509.MarshalPKCS8PrivateKey(priv)
				require.NoError(t, err)
				privPEM := string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}))
				return evidenceBody(t, keyID, privPEM, nil, events)
			},
			wantStatus: http.StatusUnprocessableEntity, wantError: "validation_failed",
		},
		{
			name: "empty events",
			body: func(t *testing.T) []byte {
				return evidenceBody(t, keyID, pemText, nil, []map[string]any{})
			},
			wantStatus: http.StatusUnprocessableEntity, wantError: "validation_failed",
		},
		{
			name: "unknown journal_segment field",
			body: func(t *testing.T) []byte {
				body, err := json.Marshal(map[string]any{
					"key_id": keyID, "public_key_pem": pemText,
					"journal_segment": map[string]any{
						"first_previous_event_hash": nil, "events": events, "stream_id": "x",
					},
				})
				require.NoError(t, err)
				return body
			},
			wantStatus: http.StatusUnprocessableEntity, wantError: "validation_failed",
		},
		{
			name: "first_previous_event_hash not hex",
			body: func(t *testing.T) []byte {
				return evidenceBody(t, keyID, pemText, "zz", events)
			},
			wantStatus: http.StatusUnprocessableEntity, wantError: "validation_failed",
		},
		{
			name: "segment prev disagrees with events[0]",
			body: func(t *testing.T) []byte {
				return evidenceBody(t, keyID, pemText, firstHash, events)
			},
			wantStatus: http.StatusUnprocessableEntity, wantError: "validation_failed",
		},
		{
			name: "event without event_hash",
			body: func(t *testing.T) []byte {
				return evidenceBody(t, keyID, pemText, nil, []map[string]any{{"schema_version": "1", "previous_event_hash": nil}})
			},
			wantStatus: http.StatusUnprocessableEntity, wantError: "validation_failed",
		},
		{
			name: "invalid Idempotency-Key",
			body: func(t *testing.T) []byte {
				return evidenceBody(t, keyID, pemText, nil, events)
			},
			wantStatus: http.StatusUnprocessableEntity, wantError: "validation_failed",
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			db, drv := newQueuedRouteDB(t, nil)
			app := evidenceTestApp(db, "tenant-a")
			headers := map[string]string{}
			if tc.name == "invalid Idempotency-Key" {
				headers["Idempotency-Key"] = "bad key with spaces!"
			}
			resp, decoded := postEvidence(t, app, tc.body(t), headers)
			require.Equal(t, tc.wantStatus, resp.StatusCode, "body: %v", decoded)
			require.Equal(t, tc.wantError, decoded["error"])
			require.Equal(t, 0, drv.remainingQueries(), "validation failures must not touch the database")
			require.Equal(t, 0, drv.remainingExecs())
		})
	}
}

func TestEvidenceSubmitOversizedInputsRejected(t *testing.T) {
	t.Parallel()
	events, pemText, keyID := loadFixtureJournal(t)

	t.Run("body over 1MiB", func(t *testing.T) {
		t.Parallel()
		db, _ := newQueuedRouteDB(t, nil)
		app := evidenceTestApp(db, "tenant-a")
		big := append([]byte(`{"pad":"`), append(make([]byte, evidenceMaxBodyBytes), []byte(`"}`)...)...)
		for i := range big[8 : len(big)-2] {
			big[8+i] = 'a'
		}
		resp, decoded := postEvidence(t, app, big, nil)
		require.Equal(t, http.StatusRequestEntityTooLarge, resp.StatusCode)
		require.Equal(t, "payload_too_large", decoded["error"])
	})

	t.Run("too many events", func(t *testing.T) {
		t.Parallel()
		db, _ := newQueuedRouteDB(t, nil)
		app := evidenceTestApp(db, "tenant-a")
		many := make([]map[string]any, evidenceMaxEvents+1)
		for i := range many {
			many[i] = map[string]any{"event_hash": strings.Repeat("ab", 32), "previous_event_hash": nil}
		}
		resp, decoded := postEvidence(t, app, evidenceBody(t, keyID, pemText, nil, many), nil)
		require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
		require.Equal(t, "validation_failed", decoded["error"])
		require.Contains(t, decoded["detail"], "500")
	})

	t.Run("event nesting too deep", func(t *testing.T) {
		t.Parallel()
		db, _ := newQueuedRouteDB(t, nil)
		app := evidenceTestApp(db, "tenant-a")
		deep := map[string]any{"event_hash": strings.Repeat("ab", 32), "previous_event_hash": nil}
		nested := any("leaf")
		for i := 0; i < evidenceMaxDepth+2; i++ {
			nested = []any{nested}
		}
		deep["metadata"] = nested
		resp, decoded := postEvidence(t, app, evidenceBody(t, keyID, pemText, nil, []map[string]any{deep}), nil)
		require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
		require.Equal(t, "validation_failed", decoded["error"])
		require.Contains(t, decoded["detail"], "depth")
	})

	t.Run("single event too large", func(t *testing.T) {
		t.Parallel()
		db, _ := newQueuedRouteDB(t, nil)
		app := evidenceTestApp(db, "tenant-a")
		huge := map[string]any{
			"event_hash":          strings.Repeat("ab", 32),
			"previous_event_hash": nil,
			"metadata":            strings.Repeat("x", evidenceMaxEventBytes),
		}
		resp, decoded := postEvidence(t, app, evidenceBody(t, keyID, pemText, nil, []map[string]any{huge}), nil)
		require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
		require.Equal(t, "validation_failed", decoded["error"])
		require.Contains(t, decoded["detail"], "size")
	})

	_ = events
}

// ---------------------------------------------------------------------------
// Verification engine against the Python-SDK fixture (cross-language parity)
// ---------------------------------------------------------------------------

func TestEvidenceVerifyAcceptsPythonFixtureJournal(t *testing.T) {
	t.Parallel()
	events, pemText, keyID := loadFixtureJournal(t)
	pub, _, derivedKeyID, err := parseSDKPublicKey(pemText)
	require.NoError(t, err)
	require.Equal(t, keyID, derivedKeyID)

	verified, issues, err := verifyEvidenceEvents(events, pub, keyID, nil, nil)
	require.NoError(t, err)
	require.Empty(t, issues, "the Python-generated journal (incl. unicode, special chars) must verify byte-exactly")
	require.Len(t, verified, len(events))
	for i, event := range verified {
		require.Equal(t, events[i]["event_hash"], event.EventHash,
			"server-recomputed canonical hash must equal the Python-computed hash (event %d)", i)
	}
}

func TestEvidenceVerifyTamperAndTransitionRejections(t *testing.T) {
	t.Parallel()
	fixtureEvents, pemText, keyID := loadFixtureJournal(t)
	pub, _, _, err := parseSDKPublicKey(pemText)
	require.NoError(t, err)

	clone := func(events []map[string]any) []map[string]any {
		out := make([]map[string]any, len(events))
		for i, event := range events {
			c := map[string]any{}
			for k, v := range event {
				c[k] = v
			}
			out[i] = c
		}
		return out
	}

	t.Run("payload tamper is hash_mismatch", func(t *testing.T) {
		t.Parallel()
		events := clone(fixtureEvents)
		events[1]["status"] = "failed" // flip a signed outcome field
		_, issues, err := verifyEvidenceEvents(events, pub, keyID, nil, nil)
		require.NoError(t, err)
		codes := issueCodes(issues)
		require.Contains(t, codes, "hash_mismatch")
		require.Contains(t, codes, "bad_signature", "the recomputed digest also fails the signature")
	})

	t.Run("recomputed-hash tamper breaks signature", func(t *testing.T) {
		t.Parallel()
		events := clone(fixtureEvents)
		events[1]["status"] = "failed"
		unsigned := map[string]any{}
		for k, v := range events[1] {
			if k != "event_hash" && k != "signature" {
				unsigned[k] = v
			}
		}
		canonical, err := canonicaljson.Encode(unsigned)
		require.NoError(t, err)
		digest := sha256.Sum256(canonical)
		events[1]["event_hash"] = hex.EncodeToString(digest[:])
		_, issues, err := verifyEvidenceEvents(events, pub, keyID, nil, nil)
		require.NoError(t, err)
		codes := issueCodes(issues)
		require.Contains(t, codes, "bad_signature", "an attacker recomputing event_hash still fails the signature")
		require.Contains(t, codes, "chain_break", "and breaks the next event's linkage")
	})

	t.Run("reorder is chain_break", func(t *testing.T) {
		t.Parallel()
		events := clone(fixtureEvents)
		events[0], events[1] = events[1], events[0]
		_, issues, err := verifyEvidenceEvents(events, pub, keyID, nil, nil)
		require.NoError(t, err)
		require.Contains(t, issueCodes(issues), "chain_break")
	})

	t.Run("wrong genesis is chain_break", func(t *testing.T) {
		t.Parallel()
		wrongGenesis := strings.Repeat("ef", 32)
		_, issues, err := verifyEvidenceEvents(clone(fixtureEvents), pub, keyID, &wrongGenesis, nil)
		require.NoError(t, err)
		require.Contains(t, issueCodes(issues), "chain_break")
	})

	t.Run("unsupported schema version", func(t *testing.T) {
		t.Parallel()
		events := clone(fixtureEvents)
		events[0]["schema_version"] = "999"
		_, issues, err := verifyEvidenceEvents(events, pub, keyID, nil, nil)
		require.NoError(t, err)
		require.Equal(t, "unknown_schema", dominantIssueCode(issues))
	})

	t.Run("missing fields", func(t *testing.T) {
		t.Parallel()
		events := clone(fixtureEvents)
		delete(events[0], "input_hash")
		_, issues, err := verifyEvidenceEvents(events, pub, keyID, nil, nil)
		require.NoError(t, err)
		require.Equal(t, "missing_fields", dominantIssueCode(issues))
	})

	t.Run("wrong key is unknown_key", func(t *testing.T) {
		t.Parallel()
		other := newTestSigner(t)
		_, issues, err := verifyEvidenceEvents(clone(fixtureEvents), other.pub, other.keyID, nil, nil)
		require.NoError(t, err)
		require.Contains(t, issueCodes(issues), "unknown_key")
	})

	t.Run("swapped signature is bad_signature", func(t *testing.T) {
		t.Parallel()
		events := clone(fixtureEvents)
		events[0]["signature"], events[2]["signature"] = events[2]["signature"], events[0]["signature"]
		_, issues, err := verifyEvidenceEvents(events, pub, keyID, nil, nil)
		require.NoError(t, err)
		require.Contains(t, issueCodes(issues), "bad_signature")
	})

	signer := newTestSigner(t)

	t.Run("outcome referencing unknown decision", func(t *testing.T) {
		t.Parallel()
		outcome := signer.event(t, "outcome", "evt-orphan", nil, map[string]any{"decision_event_id": "never-existed"})
		noRows := func(string) (string, error) { return "", sql.ErrNoRows }
		_, issues, err := verifyEvidenceEvents([]map[string]any{outcome}, signer.pub, signer.keyID, nil, noRows)
		require.NoError(t, err)
		require.Contains(t, issueCodes(issues), "unknown_decision_reference")
	})

	t.Run("denied decision is terminal", func(t *testing.T) {
		t.Parallel()
		denied := signer.event(t, "decision", "evt-denied", nil, map[string]any{"decision": "denied"})
		outcome := signer.event(t, "outcome", "evt-after-denied", denied["event_hash"], map[string]any{
			"decision_event_id": "evt-denied",
		})
		_, issues, err := verifyEvidenceEvents([]map[string]any{denied, outcome}, signer.pub, signer.keyID, nil, nil)
		require.NoError(t, err)
		require.Contains(t, issueCodes(issues), "invalid_transition")
	})

	t.Run("second outcome for one decision", func(t *testing.T) {
		t.Parallel()
		decision := signer.event(t, "decision", "evt-d1", nil, nil)
		outcome1 := signer.event(t, "outcome", "evt-o1", decision["event_hash"], map[string]any{"decision_event_id": "evt-d1"})
		outcome2 := signer.event(t, "outcome", "evt-o2", outcome1["event_hash"], map[string]any{"decision_event_id": "evt-d1"})
		_, issues, err := verifyEvidenceEvents([]map[string]any{decision, outcome1, outcome2}, signer.pub, signer.keyID, nil, nil)
		require.NoError(t, err)
		require.Contains(t, issueCodes(issues), "invalid_transition")
	})

	t.Run("gap inside the batch", func(t *testing.T) {
		t.Parallel()
		events := signer.chain(t, 4)
		gapped := []map[string]any{events[0], events[1], events[3]} // events[2] missing
		_, issues, err := verifyEvidenceEvents(gapped, signer.pub, signer.keyID, nil, nil)
		require.NoError(t, err)
		require.Contains(t, issueCodes(issues), "chain_break")
	})
}

func issueCodes(issues []evidenceIssue) []string {
	codes := make([]string, 0, len(issues))
	for _, issue := range issues {
		codes = append(codes, issue.Code)
	}
	return codes
}

// ---------------------------------------------------------------------------
// GET status
// ---------------------------------------------------------------------------

func TestEvidenceBatchGetMalformedIDIndistinguishableFromAbsent(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	app := evidenceTestApp(db, "tenant-a")

	req := httptest.NewRequest(http.MethodGet, "/v1/evidence/batches/not-a-uuid", nil)
	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)
	require.Equal(t, 0, drv.remainingQueries(), "malformed ids must not reach the database")
}

// ---------------------------------------------------------------------------
// Surface and immutability discipline
// ---------------------------------------------------------------------------

func TestRegisterEvidenceRoutesExposesOnlyEvidenceEndpoints(t *testing.T) {
	t.Parallel()
	db, _ := newQueuedRouteDB(t, nil)
	app := fiber.New()
	RegisterEvidenceRoutes(app, db)

	require.True(t, hasRoute(app, "POST", "/v1/evidence/batches"))
	require.True(t, hasRoute(app, "GET", "/v1/evidence/batches/:id"))

	for _, route := range app.GetRoutes(true) {
		// "/v1/evidence" (no trailing segment) is the group middleware mount.
		if route.Method == "HEAD" || route.Path == "/" || route.Path == "/v1/evidence" {
			continue
		}
		require.True(t, strings.HasPrefix(route.Path, "/v1/evidence/"),
			"unexpected route registered by RegisterEvidenceRoutes: %s %s", route.Method, route.Path)
		for _, forbidden := range []string{"task", "receipt", "callback", "approve", "dispatch", "run"} {
			require.NotContains(t, route.Path, forbidden,
				"no Managed/task/approval endpoint may be registered by evidence ingestion")
		}
	}
}

func TestEvidencePersistenceSourceHasNoUpdateOrDelete(t *testing.T) {
	t.Parallel()
	// Accepted evidence is append-only: this guard fails if anyone adds a
	// mutating statement to the ingestion path.
	pattern := regexp.MustCompile(`(?i)\b(UPDATE|DELETE)\b`)
	for _, file := range []string{"evidence_store.go", "routes_evidence.go", "evidence_verify.go"} {
		source, err := os.ReadFile(file)
		require.NoError(t, err)
		for i, line := range strings.Split(string(source), "\n") {
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, "//") {
				continue
			}
			require.False(t, pattern.MatchString(trimmed),
				"%s:%d contains a mutating SQL keyword: %s", file, i+1, trimmed)
		}
	}
}

func TestEvidenceSourceNeverTouchesManagedReceiptStorage(t *testing.T) {
	t.Parallel()
	// Structural separation: locally observed evidence must be impossible to
	// store as Managed evidence. The ingestion path must not reference the
	// Managed receipt tables at all, and must never write a provenance value.
	for _, file := range []string{"evidence_store.go", "routes_evidence.go", "evidence_verify.go"} {
		source, err := os.ReadFile(file)
		require.NoError(t, err)
		for i, line := range strings.Split(string(source), "\n") {
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, "//") {
				continue
			}
			require.NotContains(t, trimmed, "task_records",
				"%s:%d must not touch Managed task storage", file, i+1)
			require.NotContains(t, trimmed, "execution_receipt",
				"%s:%d must not touch Managed receipts", file, i+1)
			// The only writer of execution_provenance is the CHECKed column
			// DEFAULT: no SQL on this path may bind it as an insert column.
			if strings.Contains(trimmed, "INSERT") || strings.Contains(trimmed, "$") {
				require.NotContains(t, trimmed, "execution_provenance",
					"%s:%d must not bind execution_provenance in SQL", file, i+1)
			}
		}
	}
}
