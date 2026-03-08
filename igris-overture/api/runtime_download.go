// Package api provides the authenticated runtime binary download endpoint.
// Binaries are served only to tenants with an active subscription.
// Every download is rate-limited and audit-logged.
package api

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/billing"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// downloadRateLimit is the maximum downloads per tenant per hour.
const downloadRateLimit = 10

// binaryVersion is embedded at build time; override with RUNTIME_BINARY_VERSION env var.
const binaryVersion = "latest"

// DownloadHandler serves authenticated igris-runtime binary downloads.
type DownloadHandler struct {
	db          *sql.DB
	redis       *redis.Client
	binariesDir string  // local filesystem dir; "" means use redirect mode
	binariesURL string  // base URL for redirect mode (e.g. private R2 bucket)
}

// NewDownloadHandler creates a handler.
//
//   - binariesDir: path to /runtime-binaries directory (from RUNTIME_BINARIES_DIR env).
//     If empty the handler redirects to binariesURL instead of streaming.
//   - binariesURL: base URL for binary redirects (from RUNTIME_BINARIES_URL env).
func NewDownloadHandler(db *sql.DB, redis *redis.Client) *DownloadHandler {
	return &DownloadHandler{
		db:          db,
		redis:       redis,
		binariesDir: os.Getenv("RUNTIME_BINARIES_DIR"),
		binariesURL: os.Getenv("RUNTIME_BINARIES_URL"),
	}
}

// RegisterDownloadRoutes registers the authenticated binary download endpoint.
// Uses Clerk JWT auth (Authorization: Bearer <clerk_session_token>) via ClerkAuth middleware.
func RegisterDownloadRoutes(app *fiber.App, db *sql.DB, redisClient *redis.Client, _ *middleware.TenantAuth) {
	if db == nil {
		log.Warn().Msg("[Routes] Runtime download disabled — database not available")
		return
	}

	h := NewDownloadHandler(db, redisClient)

	v1 := app.Group("/v1/runtime")

	// Authenticated download endpoint (Clerk JWT)
	v1.Get("/download", middleware.ClerkAuth(), h.Download)

	// Public checksum endpoint (no auth) — used by the installer for verification
	v1.Get("/checksum", h.Checksum)

	log.Info().Msg("[Routes] Registered authenticated download endpoint (GET /v1/runtime/download)")
}

// Download handles GET /v1/runtime/download?platform=linux-amd64
//
// Query params:
//   - platform: linux-amd64 | linux-arm64 | macos-arm64 | darwin-arm64 | windows-amd64
//               (auto-detected from User-Agent if omitted)
//
// Auth: Authorization: Bearer <clerk_session_token>
// Response: binary stream, or 302 redirect if RUNTIME_BINARIES_URL is set.
func (h *DownloadHandler) Download(c *fiber.Ctx) error {
	// Extract tenant from context (set by ClerkAuth middleware via clerk_user_id local)
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "unauthorized",
			"message": "Valid Clerk session required to download runtime binary",
		})
	}

	// Verify subscription is active
	if err := h.verifySubscription(tenantID); err != nil {
		log.Warn().Str("tenant_id", tenantID).Err(err).Msg("[Download] Subscription check failed")
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":       "subscription_required",
			"message":     "An active Igris subscription is required to download the runtime",
			"upgrade_url": "https://igrisinertial.com/pricing",
		})
	}

	// Enforce per-tenant hourly rate limit
	if h.redis != nil {
		if limited, remaining := h.checkRateLimit(tenantID); limited {
			c.Set("X-RateLimit-Limit", strconv.Itoa(downloadRateLimit))
			c.Set("X-RateLimit-Remaining", "0")
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error":   "rate_limited",
				"message": fmt.Sprintf("Download limit reached (%d per hour). Try again later.", downloadRateLimit),
			})
		} else {
			c.Set("X-RateLimit-Limit", strconv.Itoa(downloadRateLimit))
			c.Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
		}
	}

	// Resolve platform
	platform := c.Query("platform", "")
	if platform == "" {
		platform = detectPlatform(c.Get("User-Agent"))
	}
	platform = normalizePlatform(platform)
	binaryName, ok := platformBinaries[platform]
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":     "unsupported_platform",
			"message":   "Specify ?platform=linux-amd64 | linux-arm64 | macos-arm64 | windows-amd64",
			"supported": supportedPlatforms(),
		})
	}

	version := os.Getenv("RUNTIME_BINARY_VERSION")
	if version == "" {
		version = binaryVersion
	}

	// Audit log (non-blocking)
	go h.logDownload(tenantID, c.IP(), version, platform, c.Get("User-Agent"))

	// Increment rate-limit counter (non-blocking)
	if h.redis != nil {
		go h.incrementRateLimit(tenantID)
	}

	// Serve binary
	if h.binariesDir != "" {
		return h.streamBinary(c, platform, binaryName, version)
	}
	if h.binariesURL != "" {
		return h.redirectToBinary(c, binaryName, version)
	}

	// Neither configured — return download metadata only
	log.Warn().Msg("[Download] Neither RUNTIME_BINARIES_DIR nor RUNTIME_BINARIES_URL configured — returning metadata only")
	return c.JSON(fiber.Map{
		"platform":    platform,
		"binary_name": binaryName,
		"version":     version,
		"message":     "Binary hosting not yet configured on this server",
	})
}

// streamBinary serves the binary directly from the local filesystem.
func (h *DownloadHandler) streamBinary(c *fiber.Ctx, platform, binaryName, version string) error {
	binaryPath := filepath.Join(h.binariesDir, platform, binaryName)

	f, err := os.Open(binaryPath)
	if errors.Is(err, os.ErrNotExist) {
		log.Error().Str("path", binaryPath).Msg("[Download] Binary not found on filesystem")
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "binary_not_found",
			"message": "Runtime binary not available for this platform yet",
			"platform": platform,
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "binary_read_failed",
		})
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "stat_failed"})
	}

	contentType := mime.TypeByExtension(filepath.Ext(binaryName))
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	c.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, binaryName))
	c.Set("Content-Type", contentType)
	c.Set("Content-Length", strconv.FormatInt(stat.Size(), 10))
	c.Set("X-Runtime-Version", version)
	c.Set("X-Runtime-Platform", platform)
	c.Status(http.StatusOK)

	_, err = io.Copy(c.Response().BodyWriter(), f)
	return err
}

// redirectToBinary redirects to a private download URL (e.g. signed R2/S3 URL).
func (h *DownloadHandler) redirectToBinary(c *fiber.Ctx, binaryName, version string) error {
	url := fmt.Sprintf("%s/%s/%s", h.binariesURL, version, binaryName)
	return c.Redirect(url, fiber.StatusFound)
}

// verifySubscription checks that the tenant has an active subscription of any paid tier.
func (h *DownloadHandler) verifySubscription(tenantID string) error {
	var tier, status string
	err := h.db.QueryRowContext(context.Background(),
		`SELECT tier, status FROM tenants WHERE id = $1`, tenantID,
	).Scan(&tier, &status)
	if errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("tenant not found")
	}
	if err != nil {
		return fmt.Errorf("db error: %w", err)
	}
	if status != "active" {
		return fmt.Errorf("tenant status is %q (must be active)", status)
	}
	if !billing.ValidTier(tier) {
		return fmt.Errorf("tenant has no valid subscription tier")
	}
	return nil
}

// checkRateLimit returns (limited=true, remaining) for the tenant's hourly download quota.
func (h *DownloadHandler) checkRateLimit(tenantID string) (bool, int) {
	ctx := context.Background()
	key := fmt.Sprintf("igris:downloads:%s:hour:%s",
		tenantID, time.Now().UTC().Format("2006-01-02-15"))

	count, err := h.redis.Get(ctx, key).Int()
	if errors.Is(err, redis.Nil) {
		count = 0
	} else if err != nil {
		// Redis error — fail open
		return false, downloadRateLimit
	}

	if count >= downloadRateLimit {
		return true, 0
	}
	return false, downloadRateLimit - count
}

// incrementRateLimit bumps the hourly download counter.
func (h *DownloadHandler) incrementRateLimit(tenantID string) {
	ctx := context.Background()
	key := fmt.Sprintf("igris:downloads:%s:hour:%s",
		tenantID, time.Now().UTC().Format("2006-01-02-15"))

	pipe := h.redis.Pipeline()
	pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, 2*time.Hour) // TTL 2h to cover boundary
	_, _ = pipe.Exec(ctx)
}

// logDownload writes a row to runtime_downloads for audit purposes.
func (h *DownloadHandler) logDownload(tenantID, ip, version, platform, userAgent string) {
	ctx := context.Background()
	_, err := h.db.ExecContext(ctx, `
		INSERT INTO runtime_downloads (tenant_id, ip_address, runtime_version, platform, user_agent)
		VALUES ($1::uuid, $2, $3, $4, $5)
	`, tenantID, ip, version, platform, userAgent)
	if err != nil {
		log.Warn().Err(err).Str("tenant_id", tenantID).Msg("[Download] Failed to audit-log download")
	}
}

// platformBinaries maps canonical platform keys to binary filenames.
var platformBinaries = map[string]string{
	"linux-amd64":   "igris-runtime-linux-amd64",
	"linux-arm64":   "igris-runtime-linux-arm64",
	"macos-arm64":   "igris-runtime-macos-arm64",
	"darwin-arm64":  "igris-runtime-macos-arm64",
	"darwin-amd64":  "igris-runtime-macos-amd64",
	"windows-amd64": "igris-runtime-windows-amd64.exe",
}

// normalizePlatform maps aliases to canonical keys.
func normalizePlatform(p string) string {
	switch p {
	case "darwin-arm64", "macos-arm64":
		return "macos-arm64"
	case "darwin-amd64", "macos-amd64":
		return "darwin-amd64"
	default:
		return p
	}
}

// detectPlatform makes a best-effort guess from the User-Agent string.
func detectPlatform(ua string) string {
	if ua == "" {
		return "linux-amd64"
	}
	switch {
	case containsAny(ua, "Mac OS X", "Darwin", "Macintosh"):
		if containsAny(ua, "arm64", "Apple Silicon") {
			return "macos-arm64"
		}
		return "darwin-amd64"
	case containsAny(ua, "Windows"):
		return "windows-amd64"
	default:
		if containsAny(ua, "aarch64", "arm64") {
			return "linux-arm64"
		}
		return "linux-amd64"
	}
}

func containsAny(s string, needles ...string) bool {
	for _, n := range needles {
		if len(s) >= len(n) {
			for i := 0; i <= len(s)-len(n); i++ {
				if s[i:i+len(n)] == n {
					return true
				}
			}
		}
	}
	return false
}

// Checksum handles GET /v1/runtime/checksum?platform=linux-amd64
// Returns the SHA-256 checksum of the binary for the given platform.
// This endpoint is public (no auth) — checksums are not secrets.
func (h *DownloadHandler) Checksum(c *fiber.Ctx) error {
	platform := normalizePlatform(c.Query("platform", "linux-amd64"))
	binaryName, ok := platformBinaries[platform]
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "unsupported_platform",
		})
	}

	// Try reading a pre-computed .sha256 file alongside the binary
	if h.binariesDir != "" {
		checksumPath := filepath.Join(h.binariesDir, platform, binaryName+".sha256")
		data, err := os.ReadFile(checksumPath)
		if err == nil {
			return c.SendString(string(data))
		}
	}

	// No checksum available
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"error":   "checksum_not_available",
		"message": "No checksum file available for this platform",
	})
}

func supportedPlatforms() []string {
	return []string{"linux-amd64", "linux-arm64", "macos-arm64", "darwin-amd64", "windows-amd64"}
}
