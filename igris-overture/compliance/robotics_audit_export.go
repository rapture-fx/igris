// Package compliance builds operator-facing evidence bundles for audits.
package compliance

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
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
	TenantID            string
	ReceiptFilter       coordinator.RoboticsAuditReceiptFilter
	AIToolReceiptFilter coordinator.AIToolAuditReceiptFilter
	KeyLimit            int
	KeyVersion          string
	KeyAction           string
	Filters             map[string]string
	ExportedAt          time.Time
}

type RoboticsAuditExportBundle struct {
	TenantID              string                            `json:"tenant_id"`
	ExportedAt            time.Time                         `json:"exported_at"`
	Filters               map[string]string                 `json:"filters"`
	PolicyKeyLifecycle    []PolicyKeyLifecycleAuditRecord   `json:"policy_key_lifecycle"`
	RobotExecutionReplay  []coordinator.RoboticsAuditReplay `json:"robot_execution_replays"`
	AIToolExecutionReplay []coordinator.AIToolAuditReplay   `json:"ai_tool_execution_replays"`
	Totals                map[string]int                    `json:"totals"`
}

type ExportJobConfig struct {
	TenantIDs      []string
	OutputDir      string
	Format         string
	ReplayLimit    int
	KeyLimit       int
	IncludeEmpty   bool
	RetentionDays  int
	Signing        ManifestSigningConfig
	S3UploadTarget S3UploadConfig
}

type ExportJobResult struct {
	TenantID                     string
	Path                         string
	ManifestPath                 string
	BundleSHA256                 string
	ManifestSHA256               string
	Signature                    string
	Uploaded                     bool
	PolicyKeyLifecycleRecords    int
	RobotExecutionReplayRecords  int
	AIToolExecutionReplayRecords int
}

type ManifestSigningConfig struct {
	PrivateKeyEd25519 string
	KeyID             string
}

type ExportManifest struct {
	SchemaVersion                string             `json:"schema_version"`
	TenantID                     string             `json:"tenant_id"`
	ExportedAt                   time.Time          `json:"exported_at"`
	CreatedAt                    time.Time          `json:"created_at"`
	BundleFilename               string             `json:"bundle_filename"`
	BundleSHA256                 string             `json:"bundle_sha256"`
	BundleBytes                  int64              `json:"bundle_bytes"`
	Format                       string             `json:"format"`
	Filters                      map[string]string  `json:"filters"`
	Totals                       map[string]int     `json:"totals"`
	PolicyKeyLifecycleRecords    int                `json:"policy_key_lifecycle_records"`
	RobotExecutionReplayRecords  int                `json:"robot_execution_replay_records"`
	AIToolExecutionReplayRecords int                `json:"ai_tool_execution_replay_records"`
	ManifestSHA256               string             `json:"manifest_sha256"`
	Signature                    *ManifestSignature `json:"signature,omitempty"`
}

type ManifestSignature struct {
	Algorithm           string    `json:"algorithm"`
	KeyID               string    `json:"key_id,omitempty"`
	PublicKeyEd25519    string    `json:"public_key_ed25519,omitempty"`
	SignedAt            time.Time `json:"signed_at"`
	SignedPayloadSHA256 string    `json:"signed_payload_sha256"`
	Signature           string    `json:"signature"`
}

type S3UploadConfig struct {
	Endpoint        string
	Bucket          string
	Prefix          string
	Region          string
	AccessKeyID     string
	SecretAccessKey string
	SessionToken    string
	ForcePathStyle  bool
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
	if opts.AIToolReceiptFilter.Limit <= 0 || opts.AIToolReceiptFilter.Limit > 500 {
		opts.AIToolReceiptFilter.Limit = opts.ReceiptFilter.Limit
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
	aiToolReplays, err := store.ReplayAIToolAudit(opts.TenantID, opts.AIToolReceiptFilter)
	if err != nil {
		return RoboticsAuditExportBundle{}, err
	}
	keyLifecycle, err := ListPolicyKeyLifecycleAudit(ctx, db, opts.TenantID, opts.KeyLimit, opts.KeyVersion, opts.KeyAction)
	if err != nil {
		return RoboticsAuditExportBundle{}, err
	}

	return RoboticsAuditExportBundle{
		TenantID:              opts.TenantID,
		ExportedAt:            opts.ExportedAt.UTC(),
		Filters:               opts.Filters,
		PolicyKeyLifecycle:    keyLifecycle,
		RobotExecutionReplay:  replays,
		AIToolExecutionReplay: aiToolReplays,
		Totals: map[string]int{
			"policy_key_lifecycle":     len(keyLifecycle),
			"robot_execution_replay":   len(replays),
			"ai_tool_execution_replay": len(aiToolReplays),
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
		for _, replay := range bundle.AIToolExecutionReplay {
			line, err := json.Marshal(map[string]any{"type": "ai_tool_execution_replay", "record": replay})
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

func WriteRoboticsAuditBundleArtifacts(outputDir, format string, bundle RoboticsAuditExportBundle, signing ManifestSigningConfig) (ExportJobResult, error) {
	if outputDir == "" {
		outputDir = "compliance-exports"
	}
	if format == "" {
		format = "json"
	}
	if strings.TrimSpace(signing.PrivateKeyEd25519) == "" {
		return ExportJobResult{}, fmt.Errorf("manifest signing key is required")
	}
	if err := os.MkdirAll(outputDir, 0o750); err != nil {
		return ExportJobResult{}, err
	}
	var bundleBuffer bytes.Buffer
	if err := WriteRoboticsAuditBundle(&bundleBuffer, bundle, format); err != nil {
		return ExportJobResult{}, err
	}
	bundleBytes := bundleBuffer.Bytes()
	bundleHash := sha256.Sum256(bundleBytes)
	bundleSHA256 := hex.EncodeToString(bundleHash[:])
	bundlePath := filepath.Join(outputDir, complianceBundleFilename(bundle.TenantID, bundle.ExportedAt, format))
	if err := writeFileExclusive(bundlePath, bundleBytes, 0o440); err != nil {
		return ExportJobResult{}, err
	}

	manifest, manifestBytes, err := buildExportManifest(bundle, filepath.Base(bundlePath), format, bundleSHA256, int64(len(bundleBytes)), signing)
	if err != nil {
		return ExportJobResult{}, err
	}
	manifestPath := bundlePath + ".manifest.json"
	if err := writeFileExclusive(manifestPath, manifestBytes, 0o440); err != nil {
		return ExportJobResult{}, err
	}
	return ExportJobResult{
		TenantID:                     bundle.TenantID,
		Path:                         bundlePath,
		ManifestPath:                 manifestPath,
		BundleSHA256:                 bundleSHA256,
		ManifestSHA256:               manifest.ManifestSHA256,
		Signature:                    manifestSignatureValue(manifest),
		PolicyKeyLifecycleRecords:    len(bundle.PolicyKeyLifecycle),
		RobotExecutionReplayRecords:  len(bundle.RobotExecutionReplay),
		AIToolExecutionReplayRecords: len(bundle.AIToolExecutionReplay),
	}, nil
}

func buildExportManifest(bundle RoboticsAuditExportBundle, bundleFilename, format, bundleSHA256 string, bundleBytes int64, signing ManifestSigningConfig) (ExportManifest, []byte, error) {
	manifest := ExportManifest{
		SchemaVersion:                "igris.robotics_compliance_manifest.v1",
		TenantID:                     bundle.TenantID,
		ExportedAt:                   bundle.ExportedAt.UTC(),
		CreatedAt:                    time.Now().UTC(),
		BundleFilename:               bundleFilename,
		BundleSHA256:                 bundleSHA256,
		BundleBytes:                  bundleBytes,
		Format:                       normalizedExportFormat(format),
		Filters:                      bundle.Filters,
		Totals:                       bundle.Totals,
		PolicyKeyLifecycleRecords:    len(bundle.PolicyKeyLifecycle),
		RobotExecutionReplayRecords:  len(bundle.RobotExecutionReplay),
		AIToolExecutionReplayRecords: len(bundle.AIToolExecutionReplay),
	}
	signingPayload, err := manifestSigningPayload(manifest)
	if err != nil {
		return manifest, nil, err
	}
	signingPayloadHash := sha256.Sum256(signingPayload)
	manifest.ManifestSHA256 = hex.EncodeToString(signingPayloadHash[:])
	privateKey, err := decodeEd25519PrivateKey(signing.PrivateKeyEd25519)
	if err != nil {
		return manifest, nil, err
	}
	publicKey := privateKey.Public().(ed25519.PublicKey)
	manifest.Signature = &ManifestSignature{
		Algorithm:           "ed25519-sha256",
		KeyID:               strings.TrimSpace(signing.KeyID),
		PublicKeyEd25519:    hex.EncodeToString(publicKey),
		SignedAt:            time.Now().UTC(),
		SignedPayloadSHA256: manifest.ManifestSHA256,
		Signature:           base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, signingPayloadHash[:])),
	}
	manifestBytes, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return manifest, nil, err
	}
	return manifest, append(manifestBytes, '\n'), nil
}

func manifestSigningPayload(manifest ExportManifest) ([]byte, error) {
	manifest.ManifestSHA256 = ""
	manifest.Signature = nil
	return json.Marshal(manifest)
}

func decodeEd25519PrivateKey(value string) (ed25519.PrivateKey, error) {
	value = strings.TrimSpace(value)
	var raw []byte
	var err error
	if raw, err = hex.DecodeString(value); err != nil {
		raw, err = base64.StdEncoding.DecodeString(value)
		if err != nil {
			return nil, fmt.Errorf("invalid ed25519 private key encoding")
		}
	}
	switch len(raw) {
	case ed25519.SeedSize:
		return ed25519.NewKeyFromSeed(raw), nil
	case ed25519.PrivateKeySize:
		return ed25519.PrivateKey(raw), nil
	default:
		return nil, fmt.Errorf("invalid ed25519 private key length")
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
			AIToolReceiptFilter: coordinator.AIToolAuditReceiptFilter{
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
		if !cfg.IncludeEmpty && len(bundle.PolicyKeyLifecycle) == 0 && len(bundle.RobotExecutionReplay) == 0 && len(bundle.AIToolExecutionReplay) == 0 {
			continue
		}
		result, err := WriteRoboticsAuditBundleArtifacts(cfg.OutputDir, cfg.Format, bundle, cfg.Signing)
		if err != nil {
			return results, err
		}
		uploaded, err := uploadBundleArtifacts(ctx, result, cfg.S3UploadTarget)
		if err != nil {
			return results, err
		}
		result.Uploaded = uploaded
		results = append(results, result)
	}
	if _, err := ApplyLocalRetention(cfg.OutputDir, cfg.RetentionDays); err != nil {
		return results, err
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
			UNION
			SELECT DISTINCT tenant_id FROM ai_tool_receipt_audit
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

func ApplyLocalRetention(outputDir string, retentionDays int) (int, error) {
	if outputDir == "" || retentionDays <= 0 {
		return 0, nil
	}
	cutoff := time.Now().Add(-time.Duration(retentionDays) * 24 * time.Hour)
	deleted := 0
	err := filepath.WalkDir(outputDir, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || !isComplianceExportFile(entry.Name()) {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if info.ModTime().Before(cutoff) {
			if err := os.Remove(path); err != nil {
				return err
			}
			deleted++
		}
		return nil
	})
	return deleted, err
}

func uploadBundleArtifacts(ctx context.Context, result ExportJobResult, cfg S3UploadConfig) (bool, error) {
	if !cfg.configured() {
		return false, nil
	}
	if err := cfg.validate(); err != nil {
		return false, err
	}
	for _, path := range []string{result.Path, result.ManifestPath} {
		if strings.TrimSpace(path) == "" {
			continue
		}
		if err := uploadFileToS3(ctx, path, cfg); err != nil {
			return false, err
		}
	}
	return true, nil
}

func (cfg S3UploadConfig) configured() bool {
	return strings.TrimSpace(cfg.Endpoint) != "" ||
		strings.TrimSpace(cfg.Bucket) != "" ||
		strings.TrimSpace(cfg.AccessKeyID) != "" ||
		strings.TrimSpace(cfg.SecretAccessKey) != ""
}

func (cfg S3UploadConfig) validate() error {
	if strings.TrimSpace(cfg.Endpoint) == "" {
		return fmt.Errorf("s3 endpoint is required")
	}
	if strings.TrimSpace(cfg.Bucket) == "" {
		return fmt.Errorf("s3 bucket is required")
	}
	if strings.TrimSpace(cfg.AccessKeyID) == "" {
		return fmt.Errorf("s3 access key id is required")
	}
	if strings.TrimSpace(cfg.SecretAccessKey) == "" {
		return fmt.Errorf("s3 secret access key is required")
	}
	return nil
}

func uploadFileToS3(ctx context.Context, path string, cfg S3UploadConfig) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	key := strings.Trim(strings.TrimSpace(cfg.Prefix), "/")
	if key != "" {
		key += "/"
	}
	key += filepath.Base(path)
	return putS3Object(ctx, cfg, key, data, contentTypeForPath(path))
}

func putS3Object(ctx context.Context, cfg S3UploadConfig, key string, body []byte, contentType string) error {
	endpoint, err := url.Parse(strings.TrimRight(cfg.Endpoint, "/"))
	if err != nil {
		return err
	}
	region := strings.TrimSpace(cfg.Region)
	if region == "" {
		region = "us-east-1"
	}
	objectPath := "/" + strings.Trim(cfg.Bucket, "/") + "/" + strings.TrimLeft(key, "/")
	if !cfg.ForcePathStyle {
		endpoint.Host = strings.Trim(cfg.Bucket, "/") + "." + endpoint.Host
		objectPath = "/" + strings.TrimLeft(key, "/")
	}
	endpoint.Path = joinURLPath(endpoint.Path, objectPath)
	endpoint.RawQuery = ""

	now := time.Now().UTC()
	payloadHash := sha256.Sum256(body)
	payloadHashHex := hex.EncodeToString(payloadHash[:])
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpoint.String(), bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-Amz-Content-Sha256", payloadHashHex)
	req.Header.Set("X-Amz-Date", now.Format("20060102T150405Z"))
	if strings.TrimSpace(cfg.SessionToken) != "" {
		req.Header.Set("X-Amz-Security-Token", strings.TrimSpace(cfg.SessionToken))
	}
	authorization := s3AuthorizationHeader(req, cfg, region, now, payloadHashHex)
	req.Header.Set("Authorization", authorization)

	client := http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("s3 upload failed for %s: status=%d", key, resp.StatusCode)
	}
	return nil
}

func s3AuthorizationHeader(req *http.Request, cfg S3UploadConfig, region string, now time.Time, payloadHashHex string) string {
	date := now.Format("20060102")
	scope := date + "/" + region + "/s3/aws4_request"
	canonicalHeaders, signedHeaders := canonicalS3Headers(req)
	canonicalRequest := strings.Join([]string{
		req.Method,
		awsCanonicalURI(req.URL.EscapedPath()),
		canonicalQueryString(req.URL.Query()),
		canonicalHeaders,
		signedHeaders,
		payloadHashHex,
	}, "\n")
	canonicalRequestHash := sha256.Sum256([]byte(canonicalRequest))
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		now.Format("20060102T150405Z"),
		scope,
		hex.EncodeToString(canonicalRequestHash[:]),
	}, "\n")
	signature := hmacSHA256Hex(s3SigningKey(strings.TrimSpace(cfg.SecretAccessKey), date, region), []byte(stringToSign))
	return fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s", strings.TrimSpace(cfg.AccessKeyID), scope, signedHeaders, signature)
}

func canonicalS3Headers(req *http.Request) (string, string) {
	headers := map[string]string{
		"host":                 req.URL.Host,
		"x-amz-content-sha256": req.Header.Get("X-Amz-Content-Sha256"),
		"x-amz-date":           req.Header.Get("X-Amz-Date"),
	}
	if token := req.Header.Get("X-Amz-Security-Token"); token != "" {
		headers["x-amz-security-token"] = token
	}
	keys := make([]string, 0, len(headers))
	for key := range headers {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	var canonical strings.Builder
	for _, key := range keys {
		canonical.WriteString(key)
		canonical.WriteByte(':')
		canonical.WriteString(strings.TrimSpace(headers[key]))
		canonical.WriteByte('\n')
	}
	return canonical.String(), strings.Join(keys, ";")
}

func s3SigningKey(secret, date, region string) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secret), []byte(date))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte("s3"))
	return hmacSHA256(kService, []byte("aws4_request"))
}

func hmacSHA256(key, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	_, _ = h.Write(data)
	return h.Sum(nil)
}

func hmacSHA256Hex(key, data []byte) string {
	return hex.EncodeToString(hmacSHA256(key, data))
}

func joinURLPath(base, add string) string {
	if strings.TrimSpace(base) == "" || base == "/" {
		return add
	}
	return strings.TrimRight(base, "/") + add
}

func awsCanonicalURI(path string) string {
	if path == "" {
		return "/"
	}
	parts := strings.Split(path, "/")
	for i, part := range parts {
		decoded, err := url.PathUnescape(part)
		if err == nil {
			part = decoded
		}
		parts[i] = strings.ReplaceAll(url.PathEscape(part), "+", "%20")
	}
	return strings.Join(parts, "/")
}

func canonicalQueryString(values url.Values) string {
	if len(values) == 0 {
		return ""
	}
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0)
	for _, key := range keys {
		vals := append([]string(nil), values[key]...)
		sort.Strings(vals)
		for _, value := range vals {
			parts = append(parts, url.QueryEscape(key)+"="+url.QueryEscape(value))
		}
	}
	return strings.Join(parts, "&")
}

func contentTypeForPath(path string) string {
	switch {
	case strings.HasSuffix(path, ".jsonl"):
		return "application/x-ndjson"
	case strings.HasSuffix(path, ".json"):
		return "application/json"
	default:
		return "application/octet-stream"
	}
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
	extension := normalizedExportFormat(format)
	return fmt.Sprintf("%s-robotics-compliance-%s.%s", sanitizeFilenamePart(tenantID), exportedAt.UTC().Format("20060102T150405Z"), extension)
}

func normalizedExportFormat(format string) string {
	if strings.EqualFold(format, "jsonl") || strings.EqualFold(format, "ndjson") {
		return "jsonl"
	}
	return "json"
}

func manifestSignatureValue(manifest ExportManifest) string {
	if manifest.Signature == nil {
		return ""
	}
	return manifest.Signature.Signature
}

func writeFileExclusive(path string, data []byte, perm os.FileMode) error {
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, perm)
	if err != nil {
		return err
	}
	if _, err := file.Write(data); err != nil {
		_ = file.Close()
		return err
	}
	return file.Close()
}

func isComplianceExportFile(name string) bool {
	return strings.Contains(name, "-robotics-compliance-") &&
		(strings.HasSuffix(name, ".json") || strings.HasSuffix(name, ".jsonl") || strings.HasSuffix(name, ".manifest.json"))
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
