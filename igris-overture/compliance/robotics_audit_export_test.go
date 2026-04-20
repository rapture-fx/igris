package compliance

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestWriteRoboticsAuditBundleArtifactsCreatesSignedManifest(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	exportedAt := time.Unix(1_900_500_000, 0).UTC()
	bundle := RoboticsAuditExportBundle{
		TenantID:   "tenant/audit",
		ExportedAt: exportedAt,
		Filters:    map[string]string{"source": "test"},
		Totals:     map[string]int{"policy_key_lifecycle": 0, "robot_execution_replay": 0},
	}

	result, err := WriteRoboticsAuditBundleArtifacts(t.TempDir(), "json", bundle, ManifestSigningConfig{
		PrivateKeyEd25519: hex.EncodeToString(privateKey),
		KeyID:             "manifest-key-v1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.BundleSHA256 == "" || result.ManifestSHA256 == "" || result.Signature == "" {
		t.Fatalf("expected signed hashes in result: %+v", result)
	}

	bundleBytes, err := os.ReadFile(result.Path)
	if err != nil {
		t.Fatal(err)
	}
	bundleHash := sha256.Sum256(bundleBytes)
	if got := hex.EncodeToString(bundleHash[:]); got != result.BundleSHA256 {
		t.Fatalf("bundle hash mismatch: got %s want %s", got, result.BundleSHA256)
	}

	manifestBytes, err := os.ReadFile(result.ManifestPath)
	if err != nil {
		t.Fatal(err)
	}
	var manifest ExportManifest
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
		t.Fatal(err)
	}
	if manifest.BundleSHA256 != result.BundleSHA256 {
		t.Fatalf("manifest bundle hash mismatch: got %s want %s", manifest.BundleSHA256, result.BundleSHA256)
	}
	if manifest.Signature == nil {
		t.Fatal("expected manifest signature")
	}
	payload, err := manifestSigningPayload(manifest)
	if err != nil {
		t.Fatal(err)
	}
	payloadHash := sha256.Sum256(payload)
	if hex.EncodeToString(payloadHash[:]) != manifest.ManifestSHA256 {
		t.Fatalf("manifest payload hash mismatch")
	}
	signature, err := base64.StdEncoding.DecodeString(manifest.Signature.Signature)
	if err != nil {
		t.Fatal(err)
	}
	if !ed25519.Verify(publicKey, payloadHash[:], signature) {
		t.Fatal("manifest signature did not verify")
	}
}

func TestApplyLocalRetentionDeletesOnlyExpiredComplianceFiles(t *testing.T) {
	dir := t.TempDir()
	oldPath := filepath.Join(dir, "tenant-robotics-compliance-20240101T000000Z.json")
	keepPath := filepath.Join(dir, "tenant-robotics-compliance-20260101T000000Z.json")
	otherPath := filepath.Join(dir, "unrelated.json")
	for _, path := range []string{oldPath, keepPath, otherPath} {
		if err := os.WriteFile(path, []byte("{}"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	oldTime := time.Now().Add(-72 * time.Hour)
	if err := os.Chtimes(oldPath, oldTime, oldTime); err != nil {
		t.Fatal(err)
	}

	deleted, err := ApplyLocalRetention(dir, 1)
	if err != nil {
		t.Fatal(err)
	}
	if deleted != 1 {
		t.Fatalf("deleted=%d want 1", deleted)
	}
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Fatalf("old compliance export still exists or unexpected stat error: %v", err)
	}
	for _, path := range []string{keepPath, otherPath} {
		if _, err := os.Stat(path); err != nil {
			t.Fatalf("expected %s to remain: %v", path, err)
		}
	}
}

func TestS3AuthorizationHeaderCoversPayloadAndSessionToken(t *testing.T) {
	body := []byte(`{"bundle":true}`)
	payloadHash := sha256.Sum256(body)
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPut, "https://s3.example.test/audit-bucket/tenant-exports/bundle.json", strings.NewReader(string(body)))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("X-Amz-Content-Sha256", hex.EncodeToString(payloadHash[:]))
	req.Header.Set("X-Amz-Date", "20260421T010203Z")
	req.Header.Set("X-Amz-Security-Token", "session-token")

	header := s3AuthorizationHeader(req, S3UploadConfig{
		AccessKeyID:     "access",
		SecretAccessKey: "secret",
		SessionToken:    "session-token",
	}, "us-test-1", time.Date(2026, 4, 21, 1, 2, 3, 0, time.UTC), hex.EncodeToString(payloadHash[:]))
	for _, required := range []string{
		"AWS4-HMAC-SHA256",
		"Credential=access/20260421/us-test-1/s3/aws4_request",
		"SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-security-token",
		"Signature=",
	} {
		if !strings.Contains(header, required) {
			t.Fatalf("authorization header missing %q: %s", required, header)
		}
	}
}
