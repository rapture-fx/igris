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
//   - RUNTIME_BINARIES_DIR env: path to local directory containing runtime binaries.
//     If empty the handler falls back to RUNTIME_BINARIES_URL (redirect mode).
//   - RUNTIME_BINARIES_URL env: base URL for redirect mode (e.g. private R2 bucket).
//     If neither is set, the handler returns metadata only.
//
// At construction time a startup log is emitted so operators know which mode is active.
// If neither env var is set but a ./binaries directory exists on the filesystem,
// it is used automatically as the binaries directory.
func NewDownloadHandler(db *sql.DB, redisClient *redis.Client) *DownloadHandler {
	binariesDir := os.Getenv("RUNTIME_BINARIES_DIR")
	binariesURL := os.Getenv("RUNTIME_BINARIES_URL")

	// Auto-detect a local ./binaries directory when no env vars are configured.
	if binariesDir == "" && binariesURL == "" {
		if info, err := os.Stat("./binaries"); err == nil && info.IsDir() {
			binariesDir = "./binaries"
			log.Info().Str("dir", binariesDir).Msg("[Download] Auto-detected ./binaries directory")
		}
	}

	h := &DownloadHandler{
		db:          db,
		redis:       redisClient,
		binariesDir: binariesDir,
		binariesURL: binariesURL,
	}

	// Emit a clear startup log so operators know which serving mode is active.
	switch {
	case h.binariesDir != "":
		log.Info().Str("dir", h.binariesDir).Msg("[Download] Serving binaries from local filesystem")
	case h.binariesURL != "":
		log.Info().Str("url", h.binariesURL).Msg("[Download] Redirecting downloads to remote URL")
	default:
		log.Warn().Msg("[Download] Neither RUNTIME_BINARIES_DIR nor RUNTIME_BINARIES_URL set — download returns metadata only")
	}

	return h
}

// RegisterDownloadRoutes registers the authenticated binary download endpoint.
// Uses Clerk JWT auth (Authorization: Bearer <clerk_session_token>) via ClerkAuth middleware.
func RegisterDownloadRoutes(app *fiber.App, db *sql.DB, redisClient *redis.Client, _ *middleware.TenantAuth) {
	if db == nil {
		log.Warn().Msg("[Routes] Runtime download disabled — database not available")
		return
	}

	h := NewDownloadHandler(db, redisClient)

	// Public endpoints registered directly on app to avoid group-level BetterAuth bleeding
	// from the /v1 execution group (Fiber Use middleware matches all /v1* prefixes).
	app.Get("/v1/runtime/install", h.PublicDownload)
	app.Get("/v1/runtime/checksum", h.Checksum)

	// Authenticated download endpoint — per-route middleware only
	app.Get("/v1/runtime/download", middleware.BetterAuth(db), h.Download)

	log.Info().Msg("[Routes] Registered download endpoints (GET /v1/runtime/download, /v1/runtime/install)")
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

// redirectToBinary redirects to the binary archive.
// When RUNTIME_BINARIES_URL is a GitHub Releases base URL, the format is:
//   https://github.com/org/repo/releases/download/<tag>/<file>
// RUNTIME_BINARY_VERSION should be set to the release tag, e.g. "runtime-v1.6.0".
// If set to "latest" the redirect will not work with GitHub Releases — use the exact tag.
func (h *DownloadHandler) redirectToBinary(c *fiber.Ctx, binaryName, version string) error {
	url := fmt.Sprintf("%s/%s/%s", h.binariesURL, version, binaryName)
	log.Info().Str("url", url).Str("platform", binaryName).Msg("[Download] Redirecting to binary")
	return c.Redirect(url, fiber.StatusFound)
}

// PublicDownload handles GET /v1/runtime/install?platform=linux-amd64
//
// No authentication required. The binary is useless without a valid API key
// to register with Overture — auth is enforced at runtime startup, not download time.
func (h *DownloadHandler) PublicDownload(c *fiber.Ctx) error {
	platform := c.Query("platform", "")
	if platform == "" {
		platform = detectPlatform(c.Get("User-Agent"))
	}
	platform = normalizePlatform(platform)
	binaryName, ok := platformBinaries[platform]
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":     "unsupported_platform",
			"message":   "Specify ?platform=linux-amd64 | linux-arm64 | linux-armv7 | macos-arm64 | macos-x64",
			"supported": supportedPlatforms(),
		})
	}

	version := os.Getenv("RUNTIME_BINARY_VERSION")
	if version == "" {
		version = binaryVersion
	}

	if h.binariesDir != "" {
		return h.streamBinary(c, platform, binaryName, version)
	}
	if h.binariesURL != "" {
		return h.redirectToBinary(c, binaryName, version)
	}

	return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
		"error":   "binaries_not_configured",
		"message": "Binary hosting not configured on this server",
	})
}

// verifySubscription checks that the tenant has an active subscription of any paid tier.
func (h *DownloadHandler) verifySubscription(tenantID string) error {
	var tier string
	var isActive bool
	err := h.db.QueryRowContext(context.Background(),
		`SELECT COALESCE(tier, 'seed'), COALESCE(is_active, true) FROM tenants WHERE tenant_id = $1`, tenantID,
	).Scan(&tier, &isActive)
	if errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("tenant not found")
	}
	if err != nil {
		return fmt.Errorf("db error: %w", err)
	}
	if !isActive {
		return fmt.Errorf("tenant account is not active")
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

// platformBinaries maps canonical platform keys to tar.gz archive names.
// These names MUST match what the GitHub Actions release workflow produces:
//   igris-runtime-linux-x64.tar.gz
//   igris-runtime-linux-arm64.tar.gz
//   igris-runtime-linux-armv7.tar.gz
//   igris-runtime-macos-arm64.tar.gz
//   igris-runtime-macos-x64.tar.gz
// The redirect URL becomes: RUNTIME_BINARIES_URL/<version>/<archive>
var platformBinaries = map[string]string{
	"linux-amd64":   "igris-runtime-linux-x64.tar.gz",
	"linux-x64":     "igris-runtime-linux-x64.tar.gz",
	"linux-arm64":   "igris-runtime-linux-arm64.tar.gz",
	"linux-armv7":   "igris-runtime-linux-armv7.tar.gz",
	"macos-arm64":   "igris-runtime-macos-arm64.tar.gz",
	"darwin-arm64":  "igris-runtime-macos-arm64.tar.gz",
	"macos-x64":     "igris-runtime-macos-x64.tar.gz",
}

// normalizePlatform maps aliases to canonical keys.
func normalizePlatform(p string) string {
	switch p {
	case "darwin-arm64", "macos-arm64":
		return "macos-arm64"
	case "darwin-amd64", "macos-amd64", "macos-x64":
		return "macos-x64"
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
	return []string{"linux-amd64", "linux-arm64", "linux-armv7", "macos-arm64", "macos-x64"}
}
