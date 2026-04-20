// Package compliance builds operator-facing evidence bundles for audits.
package compliance

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
)

type PolicyKeyLifecycleAuditRecord struct {
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

type RoboticsAuditBundleOptions struct {
	TenantID      string
	ReceiptFilter coordinator.RoboticsAuditReceiptFilter
	KeyLimit      int
	KeyVersion    string
	KeyAction     string
	Filters       map[string]string
	ExportedAt    time.Time
}

type RoboticsAuditExportBundle struct {
	TenantID             string                            `json:"tenant_id"`
	ExportedAt           time.Time                         `json:"exported_at"`
	Filters              map[string]string                 `json:"filters"`
	PolicyKeyLifecycle   []PolicyKeyLifecycleAuditRecord   `json:"policy_key_lifecycle"`
	RobotExecutionReplay []coordinator.RoboticsAuditReplay `json:"robot_execution_replays"`
	Totals               map[string]int                    `json:"totals"`
}

type ExportJobConfig struct {
	TenantIDs    []string
	OutputDir    string
	Format       string
	ReplayLimit  int
	KeyLimit     int
	IncludeEmpty bool
}

type ExportJobResult struct {
	TenantID                    string
	Path                        string
	PolicyKeyLifecycleRecords   int
	RobotExecutionReplayRecords int
}

func BuildRoboticsAuditBundle(ctx context.Context, db *sql.DB, opts RoboticsAuditBundleOptions) (RoboticsAuditExportBundle, error) {
	if db == nil {
		return RoboticsAuditExportBundle{}, fmt.Errorf("database is required")
	}
	opts.TenantID = strings.TrimSpace(opts.TenantID)
	if opts.TenantID == "" {
		return RoboticsAuditExportBundle{}, fmt.Errorf("tenant_id is required")
	}
	if opts.KeyLimit <= 0 || opts.KeyLimit > 500 {
		opts.KeyLimit = 100
	}
	if opts.ReceiptFilter.Limit <= 0 || opts.ReceiptFilter.Limit > 500 {
		opts.ReceiptFilter.Limit = 100
	}
	if opts.ExportedAt.IsZero() {
		opts.ExportedAt = time.Now().UTC()
	}
	if opts.Filters == nil {
		opts.Filters = map[string]string{}
	}

	store := coordinator.NewCheckpointStore(db)
	replays, err := store.ReplayRoboticsAudit(opts.TenantID, opts.ReceiptFilter)
	if err != nil {
		return RoboticsAuditExportBundle{}, err
	}
	keyLifecycle, err := ListPolicyKeyLifecycleAudit(ctx, db, opts.TenantID, opts.KeyLimit, opts.KeyVersion, opts.KeyAction)
	if err != nil {
		return RoboticsAuditExportBundle{}, err
	}

	return RoboticsAuditExportBundle{
		TenantID:             opts.TenantID,
		ExportedAt:           opts.ExportedAt.UTC(),
		Filters:              opts.Filters,
		PolicyKeyLifecycle:   keyLifecycle,
		RobotExecutionReplay: replays,
		Totals: map[string]int{
			"policy_key_lifecycle":   len(keyLifecycle),
			"robot_execution_replay": len(replays),
		},
	}, nil
}

func WriteRoboticsAuditBundle(w io.Writer, bundle RoboticsAuditExportBundle, format string) error {
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "jsonl", "ndjson":
		header, err := json.Marshal(map[string]any{
			"type":        "robotics_audit_bundle",
			"tenant_id":   bundle.TenantID,
			"exported_at": bundle.ExportedAt,
			"filters":     bundle.Filters,
			"totals":      bundle.Totals,
		})
		if err != nil {
			return err
		}
		if _, err := w.Write(append(header, '\n')); err != nil {
			return err
		}
		for _, record := range bundle.PolicyKeyLifecycle {
			line, err := json.Marshal(map[string]any{"type": "policy_key_lifecycle", "record": record})
			if err != nil {
				return err
			}
			if _, err := w.Write(append(line, '\n')); err != nil {
				return err
			}
		}
		for _, replay := range bundle.RobotExecutionReplay {
			line, err := json.Marshal(map[string]any{"type": "robot_execution_replay", "record": replay})
			if err != nil {
				return err
			}
			if _, err := w.Write(append(line, '\n')); err != nil {
				return err
			}
		}
		return nil
	default:
		encoder := json.NewEncoder(w)
		encoder.SetIndent("", "  ")
		return encoder.Encode(bundle)
	}
}

func ListPolicyKeyLifecycleAudit(ctx context.Context, db *sql.DB, tenantID string, limit int, keyVersion, action string) ([]PolicyKeyLifecycleAuditRecord, error) {
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

	records := make([]PolicyKeyLifecycleAuditRecord, 0)
	for rows.Next() {
		var record PolicyKeyLifecycleAuditRecord
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

func RunTenantComplianceExport(ctx context.Context, db *sql.DB, cfg ExportJobConfig) ([]ExportJobResult, error) {
	if cfg.OutputDir == "" {
		cfg.OutputDir = "compliance-exports"
	}
	if cfg.Format == "" {
		cfg.Format = "json"
	}
	if cfg.ReplayLimit <= 0 || cfg.ReplayLimit > 500 {
		cfg.ReplayLimit = 500
	}
	if cfg.KeyLimit <= 0 || cfg.KeyLimit > 500 {
		cfg.KeyLimit = 500
	}
	if err := os.MkdirAll(cfg.OutputDir, 0o750); err != nil {
		return nil, err
	}
	tenants := normalizeTenantIDs(cfg.TenantIDs)
	if len(tenants) == 0 {
		var err error
		tenants, err = ListTenantsWithComplianceEvidence(ctx, db)
		if err != nil {
			return nil, err
		}
	}

	results := make([]ExportJobResult, 0, len(tenants))
	for _, tenantID := range tenants {
		bundle, err := BuildRoboticsAuditBundle(ctx, db, RoboticsAuditBundleOptions{
			TenantID: tenantID,
			ReceiptFilter: coordinator.RoboticsAuditReceiptFilter{
				Limit: cfg.ReplayLimit,
			},
			KeyLimit: cfg.KeyLimit,
			Filters: map[string]string{
				"limit":     fmt.Sprintf("%d", cfg.ReplayLimit),
				"key_limit": fmt.Sprintf("%d", cfg.KeyLimit),
				"source":    "tenant_compliance_export_job",
			},
		})
		if err != nil {
			return results, err
		}
		if !cfg.IncludeEmpty && len(bundle.PolicyKeyLifecycle) == 0 && len(bundle.RobotExecutionReplay) == 0 {
			continue
		}
		path := filepath.Join(cfg.OutputDir, complianceBundleFilename(tenantID, bundle.ExportedAt, cfg.Format))
		file, err := os.Create(path)
		if err != nil {
			return results, err
		}
		if err := WriteRoboticsAuditBundle(file, bundle, cfg.Format); err != nil {
			_ = file.Close()
			return results, err
		}
		if err := file.Close(); err != nil {
			return results, err
		}
		results = append(results, ExportJobResult{
			TenantID:                    tenantID,
			Path:                        path,
			PolicyKeyLifecycleRecords:   len(bundle.PolicyKeyLifecycle),
			RobotExecutionReplayRecords: len(bundle.RobotExecutionReplay),
		})
	}
	return results, nil
}

func ListTenantsWithComplianceEvidence(ctx context.Context, db *sql.DB) ([]string, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT tenant_id
		FROM (
			SELECT DISTINCT tenant_id FROM robotics_policy_key_lifecycle_audit
			UNION
			SELECT DISTINCT tenant_id FROM robotics_receipt_audit
		) tenants
		ORDER BY tenant_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	tenants := make([]string, 0)
	for rows.Next() {
		var tenantID string
		if err := rows.Scan(&tenantID); err != nil {
			return nil, err
		}
		tenants = append(tenants, tenantID)
	}
	return tenants, rows.Err()
}

func StartTenantComplianceExportScheduler(ctx context.Context, db *sql.DB, cfg ExportJobConfig, interval time.Duration, logf func(string, ...interface{})) {
	if db == nil {
		return
	}
	if interval <= 0 {
		interval = 24 * time.Hour
	}
	if logf == nil {
		logf = func(string, ...interface{}) {}
	}
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				results, err := RunTenantComplianceExport(ctx, db, cfg)
				if err != nil {
					logf("[Compliance] tenant export failed: %v", err)
					continue
				}
				logf("[Compliance] tenant export completed: %d bundle(s)", len(results))
			}
		}
	}()
}

func normalizeTenantIDs(values []string) []string {
	seen := map[string]struct{}{}
	tenants := make([]string, 0, len(values))
	for _, value := range values {
		for _, part := range strings.Split(value, ",") {
			tenantID := strings.TrimSpace(part)
			if tenantID == "" {
				continue
			}
			if _, ok := seen[tenantID]; ok {
				continue
			}
			seen[tenantID] = struct{}{}
			tenants = append(tenants, tenantID)
		}
	}
	return tenants
}

func complianceBundleFilename(tenantID string, exportedAt time.Time, format string) string {
	extension := "json"
	if strings.EqualFold(format, "jsonl") || strings.EqualFold(format, "ndjson") {
		extension = "jsonl"
	}
	return fmt.Sprintf("%s-robotics-compliance-%s.%s", sanitizeFilenamePart(tenantID), exportedAt.UTC().Format("20060102T150405Z"), extension)
}

func sanitizeFilenamePart(value string) string {
	var b strings.Builder
	for _, r := range value {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' || r == '_' || r == '.' {
			b.WriteRune(r)
		} else {
			b.WriteByte('_')
		}
	}
	if b.Len() == 0 {
		return "tenant"
	}
	return b.String()
}
