// Package api provides execution receipt endpoints.
// Receipts are the tamper-evident, signed records produced for every execution.
package api

import (
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// Receipt is the API shape for a single execution receipt.
type Receipt struct {
	ExecutionID       string `json:"execution_id"`
	AgentID           string `json:"agent_id"`
	RuntimeID         string `json:"runtime_id"`
	TenantID          string `json:"tenant_id"`
	TimestampUTC      string `json:"timestamp_utc"`
	WallTimeMs        int64  `json:"wall_time_ms"`
	CPUTimeMs         int64  `json:"cpu_time_ms"`
	MemoryPeakMB      int64  `json:"memory_peak_mb"`
	ToolCalls         int    `json:"tool_calls"`
	ViolationOccurred bool   `json:"violation_occurred"`
	Status            string `json:"status"`
	ReceiptHash       string `json:"receipt_hash,omitempty"`
	PreviousHash      string `json:"previous_hash,omitempty"`
	Signature         string `json:"signature,omitempty"`
	TransactionID     string `json:"transaction_id,omitempty"`
	PromptPreview     string `json:"prompt_preview,omitempty"`
}

// RegisterReceiptRoutes registers /v1/receipts/* endpoints.
func RegisterReceiptRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Warn().Msg("[Routes] Receipt endpoints disabled — database not available")
		return
	}

	auth := middleware.BetterAuth(db)
	// /export must be registered before /:id so Fiber doesn't treat "export" as an ID.
	app.Get("/v1/receipts/export", auth, exportReceipts(db))
	app.Get("/v1/receipts/robotics/audit-export", auth, exportRoboticsAuditBundle(db))
	app.Get("/v1/receipts/robotics/replay", auth, replayRoboticsReceipts(db))
	app.Get("/v1/receipts/robotics", auth, listRoboticsReceipts(db))
	app.Get("/v1/receipts/:id", auth, getReceipt(db))
	app.Get("/v1/receipts", auth, listReceipts(db))

	log.Info().Msg("[Routes] Registered receipt endpoints (/v1/receipts, /v1/receipts/:id, /v1/receipts/export, /v1/receipts/robotics, /v1/receipts/robotics/replay, /v1/receipts/robotics/audit-export)")
}

// scanReceipt scans a single row from execution_lineage into a Receipt.
func scanReceipt(row interface {
	Scan(...interface{}) error
}) (Receipt, error) {
	var r Receipt
	var ts time.Time
	var runtimeID, receiptHash, previousHash, signature, transactionID, promptPreview sql.NullString
	var cpuTimeMs, memoryPeakMB sql.NullInt64
	var toolCalls sql.NullInt32

	err := row.Scan(
		&r.ExecutionID,
		&r.AgentID,
		&runtimeID,
		&r.TenantID,
		&ts,
		&r.WallTimeMs,
		&cpuTimeMs,
		&memoryPeakMB,
		&toolCalls,
		&r.ViolationOccurred,
		&r.Status,
		&receiptHash,
		&previousHash,
		&signature,
		&transactionID,
		&promptPreview,
	)
	if err != nil {
		return r, err
	}
	r.TimestampUTC = ts.UTC().Format(time.RFC3339)
	if runtimeID.Valid {
		r.RuntimeID = runtimeID.String
	}
	if cpuTimeMs.Valid {
		r.CPUTimeMs = cpuTimeMs.Int64
	}
	if memoryPeakMB.Valid {
		r.MemoryPeakMB = memoryPeakMB.Int64
	}
	if toolCalls.Valid {
		r.ToolCalls = int(toolCalls.Int32)
	}
	if receiptHash.Valid {
		r.ReceiptHash = receiptHash.String
	}
	if previousHash.Valid {
		r.PreviousHash = previousHash.String
	}
	if signature.Valid {
		r.Signature = signature.String
	}
	if transactionID.Valid {
		r.TransactionID = transactionID.String
	}
	if promptPreview.Valid {
		r.PromptPreview = promptPreview.String
	}
	return r, nil
}

const receiptSelectCols = `
	execution_id,
	COALESCE(agent_id, '')          AS agent_id,
	runtime_id,
	tenant_id,
	timestamp_utc,
	COALESCE(wall_time_ms, 0)       AS wall_time_ms,
	cpu_time_ms,
	memory_peak_mb,
	tool_calls,
	COALESCE(violation_occurred, false) AS violation_occurred,
	COALESCE(status, CASE WHEN violation_occurred THEN 'violation' ELSE 'completed' END) AS status,
	receipt_hash,
	previous_hash,
	signature,
	transaction_id,
	prompt_preview
`

// ── GET /v1/receipts ─────────────────────────────────────────────────────────

func listReceipts(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		limit := 50
		if v := c.QueryInt("limit", 0); v > 0 && v <= 500 {
			limit = v
		}

		args := []interface{}{tenantID}
		where := "WHERE tenant_id = $1"

		if from := c.Query("from"); from != "" {
			args = append(args, from)
			where += fmt.Sprintf(" AND timestamp_utc >= $%d", len(args))
		}
		if to := c.Query("to"); to != "" {
			args = append(args, to)
			where += fmt.Sprintf(" AND timestamp_utc <= $%d", len(args))
		}
		if agentID := c.Query("agent_id"); agentID != "" {
			args = append(args, agentID)
			where += fmt.Sprintf(" AND agent_id = $%d", len(args))
		}
		if c.QueryBool("violations_only", false) {
			where += " AND violation_occurred = true"
		}

		args = append(args, limit)
		query := fmt.Sprintf(`
			SELECT %s FROM execution_lineage
			%s
			ORDER BY timestamp_utc DESC
			LIMIT $%d
		`, receiptSelectCols, where, len(args))

		rows, err := db.QueryContext(c.Context(), query, args...)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Receipts] listReceipts query failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		defer rows.Close()

		receipts := make([]Receipt, 0)
		for rows.Next() {
			r, err := scanReceipt(rows)
			if err != nil {
				log.Error().Err(err).Msg("[Receipts] scan error")
				continue
			}
			receipts = append(receipts, r)
		}
		return c.JSON(receipts)
	}
}

// ── GET /v1/receipts/robotics ────────────────────────────────────────────────

func listRoboticsReceipts(db *sql.DB) fiber.Handler {
	store := coordinator.NewCheckpointStore(db)
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		filter, err := roboticsReceiptFilterFromQuery(c)
		if err != nil {
			return err
		}

		receipts, err := store.GetRoboticsAuditReceipts(tenantID, filter)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Receipts] listRoboticsReceipts query failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		return c.JSON(fiber.Map{"receipts": receipts, "total": len(receipts)})
	}
}

func replayRoboticsReceipts(db *sql.DB) fiber.Handler {
	store := coordinator.NewCheckpointStore(db)
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		filter, err := roboticsReceiptFilterFromQuery(c)
		if err != nil {
			return err
		}
		replays, err := store.ReplayRoboticsAudit(tenantID, filter)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Receipts] replayRoboticsReceipts query failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		return c.JSON(fiber.Map{"replays": replays, "total": len(replays)})
	}
}

type roboticsPolicyKeyLifecycleAuditRecord struct {
	TenantID         string          `json:"tenant_id"`
	KeyVersion       string          `json:"key_version"`
	Action           string          `json:"action"`
	ActorID          string          `json:"actor_id"`
	ActorEmail       string          `json:"actor_email,omitempty"`
	SignerIdentity   string          `json:"signer_identity"`
	SignerKeyVersion string          `json:"signer_key_version,omitempty"`
	CommandNonce     string          `json:"command_nonce,omitempty"`
	CommandHash      string          `json:"command_hash,omitempty"`
	CommandSignature string          `json:"command_signature,omitempty"`
	PreviousStatus   string          `json:"previous_status,omitempty"`
	NewStatus        string          `json:"new_status"`
	KeySnapshot      json.RawMessage `json:"key_snapshot"`
	OccurredAt       time.Time       `json:"occurred_at"`
}

type roboticsAuditExportBundle struct {
	TenantID              string                                    `json:"tenant_id"`
	ExportedAt           time.Time                                 `json:"exported_at"`
	Filters              map[string]string                         `json:"filters"`
	PolicyKeyLifecycle   []roboticsPolicyKeyLifecycleAuditRecord   `json:"policy_key_lifecycle"`
	RobotExecutionReplay []coordinator.RoboticsAuditReplay         `json:"robot_execution_replays"`
	Totals               map[string]int                            `json:"totals"`
}

func exportRoboticsAuditBundle(db *sql.DB) fiber.Handler {
	store := coordinator.NewCheckpointStore(db)
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		filter, err := roboticsReceiptFilterFromQuery(c)
		if err != nil {
			return err
		}
		keyLimit := c.QueryInt("key_limit", 100)
		if keyLimit <= 0 || keyLimit > 500 {
			keyLimit = 100
		}
		keyVersion := c.Query("key_version")
		keyAction := c.Query("key_action")

		replays, err := store.ReplayRoboticsAudit(tenantID, filter)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Receipts] exportRoboticsAuditBundle replay query failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		keyLifecycle, err := listRoboticsPolicyKeyLifecycleAudit(c.Context(), db, tenantID, keyLimit, keyVersion, keyAction)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Receipts] exportRoboticsAuditBundle key audit query failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}

		bundle := roboticsAuditExportBundle{
			TenantID:              tenantID,
			ExportedAt:           time.Now().UTC(),
			Filters:              roboticsAuditExportFilters(c),
			PolicyKeyLifecycle:   keyLifecycle,
			RobotExecutionReplay: replays,
			Totals: map[string]int{
				"policy_key_lifecycle":  len(keyLifecycle),
				"robot_execution_replay": len(replays),
			},
		}

		switch c.Query("format", "json") {
		case "jsonl":
			c.Set("Content-Type", "application/x-ndjson")
			c.Set("Content-Disposition", "attachment; filename=\"robotics-audit-bundle.jsonl\"")
			header, _ := json.Marshal(fiber.Map{
				"type":        "robotics_audit_bundle",
				"tenant_id":   bundle.TenantID,
				"exported_at": bundle.ExportedAt,
				"filters":     bundle.Filters,
				"totals":      bundle.Totals,
			})
			_, _ = c.Response().BodyWriter().Write(append(header, '\n'))
			for _, record := range bundle.PolicyKeyLifecycle {
				line, _ := json.Marshal(fiber.Map{"type": "policy_key_lifecycle", "record": record})
				_, _ = c.Response().BodyWriter().Write(append(line, '\n'))
			}
			for _, replay := range bundle.RobotExecutionReplay {
				line, _ := json.Marshal(fiber.Map{"type": "robot_execution_replay", "record": replay})
				_, _ = c.Response().BodyWriter().Write(append(line, '\n'))
			}
			return nil
		default:
			c.Set("Content-Type", "application/json")
			c.Set("Content-Disposition", "attachment; filename=\"robotics-audit-bundle.json\"")
			return c.JSON(bundle)
		}
	}
}

func roboticsAuditExportFilters(c *fiber.Ctx) map[string]string {
	keys := []string{"task_id", "policy_decision_id", "robot_action", "limit", "key_version", "key_action", "key_limit"}
	filters := make(map[string]string, len(keys))
	for _, key := range keys {
		if value := c.Query(key); value != "" {
			filters[key] = value
		}
	}
	return filters
}

func listRoboticsPolicyKeyLifecycleAudit(ctx context.Context, db *sql.DB, tenantID string, limit int, keyVersion, action string) ([]roboticsPolicyKeyLifecycleAuditRecord, error) {
	args := []interface{}{tenantID}
	where := "tenant_id = $1"
	if keyVersion != "" {
		args = append(args, keyVersion)
		where += fmt.Sprintf(" AND key_version = $%d", len(args))
	}
	if action != "" {
		args = append(args, action)
		where += fmt.Sprintf(" AND action = $%d", len(args))
	}
	args = append(args, limit)

	rows, err := db.QueryContext(ctx, fmt.Sprintf(`
		SELECT tenant_id, key_version, action, actor_id,
		       actor_email, signer_identity, signer_key_version,
		       command_nonce, command_hash, command_signature,
		       previous_status, new_status, key_snapshot, occurred_at
		FROM robotics_policy_key_lifecycle_audit
		WHERE %s
		ORDER BY occurred_at DESC
		LIMIT $%d`, where, len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := make([]roboticsPolicyKeyLifecycleAuditRecord, 0)
	for rows.Next() {
		var record roboticsPolicyKeyLifecycleAuditRecord
		var actorEmail, signerKeyVersion, commandNonce, commandHash, commandSignature, previousStatus sql.NullString
		var snapshot []byte
		if err := rows.Scan(
			&record.TenantID,
			&record.KeyVersion,
			&record.Action,
			&record.ActorID,
			&actorEmail,
			&record.SignerIdentity,
			&signerKeyVersion,
			&commandNonce,
			&commandHash,
			&commandSignature,
			&previousStatus,
			&record.NewStatus,
			&snapshot,
			&record.OccurredAt,
		); err != nil {
			return nil, err
		}
		record.ActorEmail = actorEmail.String
		record.SignerKeyVersion = signerKeyVersion.String
		record.CommandNonce = commandNonce.String
		record.CommandHash = commandHash.String
		record.CommandSignature = commandSignature.String
		record.PreviousStatus = previousStatus.String
		record.KeySnapshot = json.RawMessage(snapshot)
		records = append(records, record)
	}
	return records, rows.Err()
}

func roboticsReceiptFilterFromQuery(c *fiber.Ctx) (coordinator.RoboticsAuditReceiptFilter, error) {
	limit := c.QueryInt("limit", 100)
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	filter := coordinator.RoboticsAuditReceiptFilter{
		PolicyDecisionID: c.Query("policy_decision_id"),
		RobotAction:      c.Query("robot_action"),
		Limit:            limit,
	}
	if rawTaskID := c.Query("task_id"); rawTaskID != "" {
		taskID, err := uuid.Parse(rawTaskID)
		if err != nil {
			return filter, c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid task_id"})
		}
		filter.TaskID = &taskID
	}
	return filter, nil
}

// ── GET /v1/receipts/:id ─────────────────────────────────────────────────────

func getReceipt(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		id := c.Params("id")

		row := db.QueryRowContext(c.Context(), fmt.Sprintf(`
			SELECT %s FROM execution_lineage
			WHERE execution_id = $1 AND tenant_id = $2
		`, receiptSelectCols), id, tenantID)

		r, err := scanReceipt(row)
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "receipt not found"})
		}
		if err != nil {
			log.Error().Err(err).Str("id", id).Msg("[Receipts] getReceipt failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		return c.JSON(r)
	}
}

// ── GET /v1/receipts/export ──────────────────────────────────────────────────

func exportReceipts(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		format := c.Query("format", "jsonl") // jsonl | csv
		args := []interface{}{tenantID}
		where := "WHERE tenant_id = $1"

		if from := c.Query("from"); from != "" {
			args = append(args, from)
			where += fmt.Sprintf(" AND timestamp_utc >= $%d", len(args))
		}
		if to := c.Query("to"); to != "" {
			args = append(args, to)
			where += fmt.Sprintf(" AND timestamp_utc <= $%d", len(args))
		}

		query := fmt.Sprintf(`
			SELECT %s FROM execution_lineage
			%s
			ORDER BY timestamp_utc ASC
		`, receiptSelectCols, where)

		rows, err := db.QueryContext(c.Context(), query, args...)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Receipts] exportReceipts query failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		defer rows.Close()

		switch format {
		case "csv":
			c.Set("Content-Type", "text/csv")
			c.Set("Content-Disposition", "attachment; filename=\"receipts.csv\"")
			w := csv.NewWriter(c.Response().BodyWriter())
			_ = w.Write([]string{
				"execution_id", "agent_id", "runtime_id", "timestamp_utc",
				"wall_time_ms", "cpu_time_ms", "memory_peak_mb", "tool_calls",
				"violation_occurred", "status", "receipt_hash",
			})
			for rows.Next() {
				r, err := scanReceipt(rows)
				if err != nil {
					continue
				}
				_ = w.Write([]string{
					r.ExecutionID, r.AgentID, r.RuntimeID, r.TimestampUTC,
					fmt.Sprintf("%d", r.WallTimeMs),
					fmt.Sprintf("%d", r.CPUTimeMs),
					fmt.Sprintf("%d", r.MemoryPeakMB),
					fmt.Sprintf("%d", r.ToolCalls),
					fmt.Sprintf("%t", r.ViolationOccurred),
					r.Status, r.ReceiptHash,
				})
			}
			w.Flush()
			return nil

		default: // jsonl
			c.Set("Content-Type", "application/x-ndjson")
			c.Set("Content-Disposition", "attachment; filename=\"receipts.jsonl\"")
			for rows.Next() {
				r, err := scanReceipt(rows)
				if err != nil {
					continue
				}
				line, _ := json.Marshal(r)
				_, _ = c.Response().BodyWriter().Write(append(line, '\n'))
			}
			return nil
		}
	}
}
