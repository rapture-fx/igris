package api

// Connected contract synchronization — the first Connected slice.
//
// POST /v1/contracts/sync registers (idempotently) a code-declared
// ActionContract v1 as an immutable version of a tenant-owned logical
// action. It grants NO execution permission: logical actions created here
// carry a non-executable target type, and nothing on this path touches the
// task coordinator, dispatch, policy, approval, or evidence.
//
// Spec: docs/architecture/igris-connected-api-v1.md §1–2.
// Plan: docs/architecture/igris-connected-first-slice.md.
//
// Security posture:
//   - Tenant identity comes exclusively from authentication (BetterAuth
//     session or tenant-scoped API key). A body-supplied tenant is rejected.
//   - The caller's contract_hash is never trusted: the server recomputes it
//     from the canonical bytes (igris-overture/internal/canonicaljson, pinned
//     byte-for-byte to the Python SDK fixtures) and rejects mismatches.
//   - Idempotency keys are bound to the server-recomputed fingerprint; the
//     same key with a different fingerprint is an explicit 409 conflict.

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/internal/canonicaljson"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

const (
	contractSyncMaxBodyBytes       = 64 * 1024
	contractMaxParameterDescriptor = 128
	contractMaxStringField         = 512
	contractSyncRateLimitPerMinute = 60
	contractListDefaultLimit       = 50
	contractListMaxLimit           = 200
)

// SDK rule from igris.contracts.validate_action_name: letter start, then
// letters, digits, '.', '_', ':', '-', max 128 chars.
var contractActionNamePattern = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_.:-]{0,127}$`)
var contractHashPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)
var contractIdempotencyKeyPattern = regexp.MustCompile(`^[A-Za-z0-9._:-]{1,128}$`)

var contractRiskLevels = map[string]bool{"low": true, "medium": true, "high": true, "critical": true}
var contractApprovalModes = map[string]bool{"required": true, "never": true}

var contractRiskRank = map[string]int{"low": 1, "medium": 2, "high": 3, "critical": 4}

// contractAllowedFields is the exact ActionContract v1 field set. Unknown
// fields are rejected rather than hashed-and-stored: the protocol object is
// strictly versioned and junk fields must not ride along inside evidence.
var contractAllowedFields = map[string]bool{
	"schema_version":        true,
	"action_name":           true,
	"module":                true,
	"qualified_name":        true,
	"risk":                  true,
	"approval_mode":         true,
	"execution_mode":        true,
	"parameter_descriptors": true,
	"code_fingerprint":      true,
	"contract_hash":         true,
}

var contractDescriptorAllowedFields = map[string]bool{
	"name":        true,
	"kind":        true,
	"has_default": true,
	"annotation":  true,
}

// RegisterContractRoutes wires the Connected contract synchronization and
// lookup endpoints. No execution, evidence, approval, or dispatch route is
// registered here.
func RegisterContractRoutes(app *fiber.App, db *sql.DB) {
	v1 := app.Group("/v1/contracts")
	v1.Use(middleware.BetterAuth(db))
	v1.Use(middleware.NewRateLimiter(contractSyncRateLimitPerMinute, time.Minute).RateLimitMiddleware())

	v1.Post("/sync", handleContractSync(db))
	v1.Get("/actions/:name", handleContractActionGet(db))
	v1.Get("/actions/:name/versions/:contract_hash", handleContractVersionGet(db))
}

type contractValidationError struct {
	status int
	code   string
	detail string
}

// validatedContract carries the strictly validated ActionContract v1 fields
// plus the server-recomputed canonical identity.
type validatedContract struct {
	SchemaVersion   string
	ActionName      string
	Risk            string
	ApprovalMode    string
	ExecutionMode   string
	CodeFingerprint *string
	// RecomputedHash is the server-side canonical recomputation; it is the
	// only hash used after validation. SuppliedHash exists solely to detect
	// the mismatch.
	RecomputedHash string
	SuppliedHash   string
	// CanonicalBody is the canonical JSON of the full contract (including
	// contract_hash) — the verbatim stored representation.
	CanonicalBody []byte
}

func handleContractSync(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}

		body := c.Body()
		if len(body) > contractSyncMaxBodyBytes {
			return c.Status(http.StatusRequestEntityTooLarge).JSON(fiber.Map{
				"error":  "payload_too_large",
				"detail": "request body exceeds 64 KiB",
			})
		}

		idempotencyKey := strings.TrimSpace(c.Get("Idempotency-Key"))
		if idempotencyKey != "" && !contractIdempotencyKeyPattern.MatchString(idempotencyKey) {
			return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{
				"error":  "validation_failed",
				"detail": "Idempotency-Key must be 1-128 chars of [A-Za-z0-9._:-]",
			})
		}

		request, err := canonicaljson.DecodeObjectPreserving(body)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		for key := range request {
			if key != "contract" && key != "client" {
				// tenant_id (or any other caller-controlled field) is never
				// accepted here; the tenant comes from authentication only.
				return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{
					"error":  "validation_failed",
					"detail": "unexpected request field: " + key,
				})
			}
		}
		contractRaw, ok := request["contract"].(map[string]any)
		if !ok {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":  "invalid_body",
				"detail": "contract must be a JSON object",
			})
		}

		contract, verr := validateContractV1(contractRaw)
		if verr != nil {
			return c.Status(verr.status).JSON(fiber.Map{"error": verr.code, "detail": verr.detail})
		}

		if idempotencyKey != "" {
			status, responseBody, replayed, conflict, err := performIdempotentContractSync(
				c.Context(), db, tenantID, contract, idempotencyKey,
			)
			if err != nil {
				log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Contracts] idempotent sync failed")
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
			}
			if conflict {
				return c.Status(http.StatusConflict).JSON(fiber.Map{
					"error":  "idempotency_key_conflict",
					"detail": "this Idempotency-Key was already used with a different contract fingerprint; use a new key",
				})
			}
			if replayed {
				c.Set("Idempotency-Replayed", "true")
			}
			c.Set("Content-Type", "application/json")
			return c.Status(status).Send(responseBody)
		}

		status, response, err := performContractSync(c.Context(), db, tenantID, contract)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Contracts] sync failed")
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		responseBody, err := json.Marshal(response)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		c.Set("Content-Type", "application/json")
		return c.Status(status).Send(responseBody)
	}
}

// performContractSync runs the transactional core: resolve or create the
// tenant-owned logical action, then resolve or append the immutable contract
// version. Returns the HTTP status (201 created / 200 existing) and body.
func performContractSync(ctx context.Context, db *sql.DB, tenantID string, contract *validatedContract) (int, fiber.Map, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return 0, nil, err
	}
	defer func() { _ = tx.Rollback() }()

	status, response, err := performContractSyncInTx(ctx, tx, tenantID, contract)
	if err != nil {
		return 0, nil, err
	}
	if err := tx.Commit(); err != nil {
		return 0, nil, err
	}
	return status, response, nil
}

func performContractSyncInTx(ctx context.Context, tx *sql.Tx, tenantID string, contract *validatedContract) (int, fiber.Map, error) {
	actionID, origin, err := ensureContractLogicalAction(ctx, tx, tenantID, contract.ActionName)
	if err != nil {
		return 0, nil, err
	}
	originDivergence := origin != contractOriginSDKSync

	created := false
	version, err := getContractVersion(ctx, tx, tenantID, contract.ActionName, contract.RecomputedHash)
	if err == sql.ErrNoRows {
		prior, err := latestContractVersion(ctx, tx, tenantID, contract.ActionName)
		if err != nil && err != sql.ErrNoRows {
			return 0, nil, err
		}
		sensitive, flags := contractSecurityDelta(prior, contract)
		id, createdAt, err := insertContractVersion(ctx, tx,
			tenantID, contract.ActionName, contract.RecomputedHash,
			contract.SchemaVersion, contract.CanonicalBody,
			contract.Risk, contract.ApprovalMode, contract.ExecutionMode,
			contract.CodeFingerprint, sensitive, flags)
		if err == nil {
			created = true
			version = &contractVersionRecord{
				ID:                      id,
				ContractHash:            contract.RecomputedHash,
				SchemaVersion:           contract.SchemaVersion,
				Risk:                    contract.Risk,
				ApprovalMode:            contract.ApprovalMode,
				ExecutionMode:           contract.ExecutionMode,
				SecuritySensitiveChange: sensitive,
				PolicyFlags:             flags,
				CreatedAt:               createdAt,
			}
		} else if err == sql.ErrNoRows {
			// A concurrent identical sync won the uniqueness race; read the
			// surviving row — exactly one version exists either way.
			version, err = getContractVersion(ctx, tx, tenantID, contract.ActionName, contract.RecomputedHash)
			if err != nil {
				return 0, nil, err
			}
		} else {
			return 0, nil, err
		}
	} else if err != nil {
		return 0, nil, err
	}

	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	policyFlags := version.PolicyFlags
	if policyFlags == nil {
		policyFlags = []string{}
	}
	return status, fiber.Map{
		"action": fiber.Map{
			"id":                actionID,
			"tenant_owned":      true,
			"action_name":       contract.ActionName,
			"origin":            origin,
			"origin_divergence": originDivergence,
		},
		"version": fiber.Map{
			"id":                        version.ID,
			"contract_hash":             version.ContractHash,
			"schema_version":            version.SchemaVersion,
			"created":                   created,
			"created_at":                contractTimestamp(version.CreatedAt),
			"security_sensitive_change": version.SecuritySensitiveChange,
			"policy_flags":              policyFlags,
		},
		"grants": fiber.Map{
			"execution_permission": false,
			"note":                 "synchronization records a declaration; it authorizes nothing",
		},
	}, nil
}

func performIdempotentContractSync(ctx context.Context, db *sql.DB, tenantID string, contract *validatedContract, key string) (int, []byte, bool, bool, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return 0, nil, false, false, err
	}
	defer func() { _ = tx.Rollback() }()

	claimed, err := claimContractSyncIdempotencyRecord(
		ctx, tx, tenantID, contract.ActionName, key, contract.RecomputedHash,
	)
	if err != nil {
		return 0, nil, false, false, err
	}
	if !claimed {
		record, err := getContractSyncIdempotencyRecord(ctx, tx, tenantID, contract.ActionName, key)
		if err != nil {
			return 0, nil, false, false, err
		}
		if record.RequestFingerprint != contract.RecomputedHash {
			return 0, nil, false, true, nil
		}
		if err := tx.Commit(); err != nil {
			return 0, nil, false, false, err
		}
		return record.ResponseStatus, record.ResponseBody, true, false, nil
	}

	status, response, err := performContractSyncInTx(ctx, tx, tenantID, contract)
	if err != nil {
		return 0, nil, false, false, err
	}
	responseBody, err := json.Marshal(response)
	if err != nil {
		return 0, nil, false, false, err
	}
	if err := completeContractSyncIdempotencyRecord(
		ctx, tx, tenantID, contract.ActionName, key,
		contract.RecomputedHash, status, responseBody,
	); err != nil {
		return 0, nil, false, false, err
	}
	if err := tx.Commit(); err != nil {
		return 0, nil, false, false, err
	}
	return status, responseBody, false, false, nil
}

// validateContractV1 strictly validates the submitted ActionContract v1 and
// recomputes its canonical hash. First failure wins; order follows the spec.
func validateContractV1(contract map[string]any) (*validatedContract, *contractValidationError) {
	fail := func(status int, code, detail string) (*validatedContract, *contractValidationError) {
		return nil, &contractValidationError{status: status, code: code, detail: detail}
	}

	for key := range contract {
		if !contractAllowedFields[key] {
			return fail(http.StatusUnprocessableEntity, "validation_failed", "unexpected contract field: "+key)
		}
	}

	schemaVersion, _ := contract["schema_version"].(string)
	if schemaVersion != "1" {
		return fail(http.StatusUnprocessableEntity, "unsupported_schema_version", "schema_version must be \"1\"")
	}

	actionName, _ := contract["action_name"].(string)
	if !contractActionNamePattern.MatchString(actionName) {
		return fail(http.StatusUnprocessableEntity, "invalid_action_name", "action_name must start with a letter, use [A-Za-z0-9_.:-], max 128 chars")
	}

	risk, _ := contract["risk"].(string)
	if !contractRiskLevels[risk] {
		return fail(http.StatusUnprocessableEntity, "validation_failed", "risk must be one of low, medium, high, critical")
	}
	approvalMode, _ := contract["approval_mode"].(string)
	if !contractApprovalModes[approvalMode] {
		return fail(http.StatusUnprocessableEntity, "validation_failed", "approval_mode must be required or never")
	}
	executionMode, _ := contract["execution_mode"].(string)
	if executionMode != "embedded" {
		return fail(http.StatusUnprocessableEntity, "validation_failed", "execution_mode must be embedded for this endpoint version")
	}

	for _, field := range []string{"module", "qualified_name"} {
		value, ok := contract[field].(string)
		if !ok || value == "" {
			return fail(http.StatusUnprocessableEntity, "validation_failed", field+" must be a non-empty string")
		}
		if len(value) > contractMaxStringField {
			return fail(http.StatusUnprocessableEntity, "validation_failed", field+" exceeds 512 chars")
		}
	}

	descriptorsRaw, ok := contract["parameter_descriptors"].([]any)
	if !ok {
		return fail(http.StatusUnprocessableEntity, "validation_failed", "parameter_descriptors must be an array")
	}
	if len(descriptorsRaw) > contractMaxParameterDescriptor {
		return fail(http.StatusUnprocessableEntity, "validation_failed", "parameter_descriptors exceeds 128 entries")
	}
	for _, raw := range descriptorsRaw {
		descriptor, ok := raw.(map[string]any)
		if !ok {
			return fail(http.StatusUnprocessableEntity, "validation_failed", "parameter_descriptors entries must be objects")
		}
		for key := range descriptor {
			if !contractDescriptorAllowedFields[key] {
				return fail(http.StatusUnprocessableEntity, "validation_failed", "unexpected parameter descriptor field: "+key)
			}
		}
		for _, field := range []string{"name", "kind"} {
			value, ok := descriptor[field].(string)
			if !ok || value == "" || len(value) > contractMaxStringField {
				return fail(http.StatusUnprocessableEntity, "validation_failed", "parameter descriptor "+field+" must be a non-empty string of at most 512 chars")
			}
		}
		if _, ok := descriptor["has_default"].(bool); !ok {
			return fail(http.StatusUnprocessableEntity, "validation_failed", "parameter descriptor has_default must be a boolean")
		}
		switch annotation := descriptor["annotation"].(type) {
		case nil:
		case string:
			if len(annotation) > contractMaxStringField {
				return fail(http.StatusUnprocessableEntity, "validation_failed", "parameter descriptor annotation exceeds 512 chars")
			}
		default:
			return fail(http.StatusUnprocessableEntity, "validation_failed", "parameter descriptor annotation must be a string or null")
		}
	}

	var codeFingerprint *string
	switch fingerprint := contract["code_fingerprint"].(type) {
	case nil:
	case string:
		if !contractHashPattern.MatchString(fingerprint) {
			return fail(http.StatusUnprocessableEntity, "validation_failed", "code_fingerprint must be 64 lowercase hex chars or null")
		}
		codeFingerprint = &fingerprint
	default:
		return fail(http.StatusUnprocessableEntity, "validation_failed", "code_fingerprint must be 64 lowercase hex chars or null")
	}

	suppliedHash, _ := contract["contract_hash"].(string)
	if !contractHashPattern.MatchString(suppliedHash) {
		return fail(http.StatusUnprocessableEntity, "validation_failed", "contract_hash must be 64 lowercase hex chars")
	}

	recomputed, err := canonicaljson.ContractHash(contract)
	if err != nil {
		return fail(http.StatusUnprocessableEntity, "validation_failed", "contract could not be canonicalized")
	}
	if recomputed != suppliedHash {
		return fail(http.StatusUnprocessableEntity, "contract_hash_mismatch", "supplied contract_hash does not match the server-recomputed canonical hash")
	}

	canonicalBody, err := canonicaljson.Encode(contract)
	if err != nil {
		return fail(http.StatusUnprocessableEntity, "validation_failed", "contract could not be canonicalized")
	}

	return &validatedContract{
		SchemaVersion:   schemaVersion,
		ActionName:      actionName,
		Risk:            risk,
		ApprovalMode:    approvalMode,
		ExecutionMode:   executionMode,
		CodeFingerprint: codeFingerprint,
		RecomputedHash:  recomputed,
		SuppliedHash:    suppliedHash,
		CanonicalBody:   canonicalBody,
	}, nil
}

// contractSecurityDelta compares SEMANTIC fields against the latest prior
// version. A new version alone is never flagged (code_fingerprint is inside
// contract_hash in v1, so formatting-only edits over-version by design —
// docs/architecture/igris-progressive-contract-v1.md §4a).
func contractSecurityDelta(prior *contractVersionRecord, next *validatedContract) (bool, []string) {
	flags := []string{}
	if prior == nil {
		return false, flags
	}
	if contractRiskRank[next.Risk] < contractRiskRank[prior.Risk] {
		flags = append(flags, "risk_lowered:"+prior.Risk+"->"+next.Risk)
	}
	if prior.ApprovalMode == "required" && next.ApprovalMode == "never" {
		flags = append(flags, "approval_weakened:required->never")
	}
	if prior.ExecutionMode != next.ExecutionMode {
		flags = append(flags, "execution_mode_changed:"+prior.ExecutionMode+"->"+next.ExecutionMode)
	}
	return len(flags) > 0, flags
}

func handleContractActionGet(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		name, verr := contractActionNameParam(c)
		if verr != nil {
			return c.Status(verr.status).JSON(fiber.Map{"error": verr.code, "detail": verr.detail})
		}

		limit := contractListDefaultLimit
		if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil || parsed < 1 || parsed > contractListMaxLimit {
				return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{
					"error":  "validation_failed",
					"detail": "limit must be an integer between 1 and 200",
				})
			}
			limit = parsed
		}
		var before *time.Time
		if raw := strings.TrimSpace(c.Query("before")); raw != "" {
			parsed, err := time.Parse(time.RFC3339Nano, raw)
			if err != nil {
				return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{
					"error":  "validation_failed",
					"detail": "before must be an RFC3339 timestamp",
				})
			}
			before = &parsed
		}

		action, err := getContractLogicalAction(c.Context(), db, tenantID, name)
		if err == sql.ErrNoRows {
			// Absent and other-tenant are indistinguishable by design.
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "action_not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		versions, err := listContractVersions(c.Context(), db, tenantID, name, limit, before)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		summaries := make([]fiber.Map, 0, len(versions))
		for _, version := range versions {
			summaries = append(summaries, fiber.Map{
				"contract_hash":             version.ContractHash,
				"created_at":                contractTimestamp(version.CreatedAt),
				"risk":                      version.Risk,
				"approval_mode":             version.ApprovalMode,
				"execution_mode":            version.ExecutionMode,
				"security_sensitive_change": version.SecuritySensitiveChange,
			})
		}
		return c.JSON(fiber.Map{
			"action_name": name,
			"origin":      action.Origin,
			"created_at":  contractTimestamp(action.CreatedAt),
			"versions":    summaries,
		})
	}
}

func handleContractVersionGet(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		name, verr := contractActionNameParam(c)
		if verr != nil {
			return c.Status(verr.status).JSON(fiber.Map{"error": verr.code, "detail": verr.detail})
		}
		hash := strings.TrimSpace(c.Params("contract_hash"))
		if !contractHashPattern.MatchString(hash) {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_contract_hash"})
		}

		version, err := getContractVersion(c.Context(), db, tenantID, name, hash)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "contract_version_not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		var contract json.RawMessage = version.Contract
		policyFlags := version.PolicyFlags
		if policyFlags == nil {
			policyFlags = []string{}
		}
		return c.JSON(fiber.Map{
			"action_name":               name,
			"contract_hash":             version.ContractHash,
			"schema_version":            version.SchemaVersion,
			"created_at":                contractTimestamp(version.CreatedAt),
			"risk":                      version.Risk,
			"approval_mode":             version.ApprovalMode,
			"execution_mode":            version.ExecutionMode,
			"security_sensitive_change": version.SecuritySensitiveChange,
			"policy_flags":              policyFlags,
			"contract":                  contract,
		})
	}
}

func contractActionNameParam(c *fiber.Ctx) (string, *contractValidationError) {
	raw := c.Params("name")
	name, err := url.PathUnescape(raw)
	if err != nil {
		name = raw
	}
	name = strings.TrimSpace(name)
	if !contractActionNamePattern.MatchString(name) {
		return "", &contractValidationError{
			status: http.StatusBadRequest,
			code:   "invalid_action_name",
			detail: "action name must start with a letter, use [A-Za-z0-9_.:-], max 128 chars",
		}
	}
	return name, nil
}

// contractTimestamp renders server timestamps as UTC RFC3339 with
// microsecond precision, matching the SDK's timestamp_utc convention.
func contractTimestamp(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000000Z")
}
