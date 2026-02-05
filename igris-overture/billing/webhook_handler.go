// Package billing provides webhook handling for Polar.sh events
package billing

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/google/uuid"
)

// ============================================================================
// WEBHOOK EVENT TYPES
// ============================================================================

const (
	EventSubscriptionCreated  = "subscription.created"
	EventSubscriptionUpdated  = "subscription.updated"
	EventSubscriptionCanceled = "subscription.canceled"
	EventSubscriptionExpired  = "subscription.expired"
	EventSubscriptionTrialEnd = "subscription.trial_end"
)

// WebhookEvent represents a Polar webhook event
type WebhookEvent struct {
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data"`
	CreatedAt time.Time       `json:"created_at"`
}

// SubscriptionEventData represents subscription data in webhook
type SubscriptionEventData struct {
	ID               string            `json:"id"`
	CustomerID       string            `json:"customer_id"`
	CustomerEmail    string            `json:"customer_email"`
	ProductID        string            `json:"product_id"`
	PriceID          string            `json:"price_id"`
	Status           string            `json:"status"`
	CurrentPeriodEnd string            `json:"current_period_end"`
	TrialEnd         *string           `json:"trial_end,omitempty"`
	CanceledAt       *string           `json:"canceled_at,omitempty"`
	Metadata         map[string]string `json:"metadata,omitempty"`
}

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

// WebhookHandler processes Polar webhook events
type WebhookHandler struct {
	client *PolarClient
	db     *sql.DB
	logger *log.Logger
}

// NewWebhookHandler creates a webhook handler
func NewWebhookHandler(client *PolarClient, db *sql.DB) *WebhookHandler {
	return &WebhookHandler{
		client: client,
		db:     db,
		logger: log.Default(),
	}
}

// HandleWebhook processes incoming webhook requests
func (h *WebhookHandler) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	// Only accept POST
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		h.logger.Printf("[Webhook] Failed to read body: %v", err)
		http.Error(w, "Failed to read body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Verify signature
	signature := r.Header.Get("X-Polar-Signature")
	if !h.verifySignature(body, signature) {
		h.logger.Printf("[Webhook] Invalid signature")
		http.Error(w, "Invalid signature", http.StatusUnauthorized)
		return
	}

	// Parse event
	var event WebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		h.logger.Printf("[Webhook] Failed to parse event: %v", err)
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	h.logger.Printf("[Webhook] Received event: type=%s created=%s",
		event.Type, event.CreatedAt.Format(time.RFC3339))

	// Route to handler
	if err := h.routeEvent(&event); err != nil {
		h.logger.Printf("[Webhook] Handler failed: %v", err)
		http.Error(w, "Handler failed", http.StatusInternalServerError)
		return
	}

	// Return 200 OK
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

// verifySignature validates HMAC signature
func (h *WebhookHandler) verifySignature(body []byte, signature string) bool {
	// Skip verification if no secret configured (development only)
	if h.client.webhookSecret == "" {
		h.logger.Println("[Webhook] WARNING: Signature verification skipped (no secret)")
		return true
	}

	// Compute HMAC
	mac := hmac.New(sha256.New, []byte(h.client.webhookSecret))
	mac.Write(body)
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	// Compare signatures (constant time)
	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

// routeEvent routes webhook event to appropriate handler
func (h *WebhookHandler) routeEvent(event *WebhookEvent) error {
	switch event.Type {
	case EventSubscriptionCreated:
		return h.handleSubscriptionCreated(event)
	case EventSubscriptionUpdated:
		return h.handleSubscriptionUpdated(event)
	case EventSubscriptionCanceled:
		return h.handleSubscriptionCanceled(event)
	case EventSubscriptionExpired:
		return h.handleSubscriptionExpired(event)
	case EventSubscriptionTrialEnd:
		return h.handleSubscriptionTrialEnd(event)
	default:
		h.logger.Printf("[Webhook] Unhandled event type: %s", event.Type)
		return nil
	}
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

// handleSubscriptionCreated processes subscription.created events
func (h *WebhookHandler) handleSubscriptionCreated(event *WebhookEvent) error {
	var data SubscriptionEventData
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return fmt.Errorf("failed to parse subscription data: %w", err)
	}

	h.logger.Printf("[Webhook] Subscription created: customer=%s price=%s status=%s",
		data.CustomerID, data.PriceID, data.Status)

	// Convert to internal subscription
	sub := h.convertToSubscription(&data)

	// Map price ID to tier
	tier := h.mapPriceIDToTier(data.PriceID)

	// Generate license key
	licenseKey, err := models.GenerateLicenseKey(tier)
	if err != nil {
		return fmt.Errorf("failed to generate license key: %w", err)
	}

	// Store license in database
	ctx := context.Background()
	if err := h.storeLicense(ctx, licenseKey, tier, data.CustomerEmail, data.CustomerID); err != nil {
		return fmt.Errorf("failed to store license: %w", err)
	}

	// Update cache
	if err := h.client.UpdateSubscription(ctx, sub); err != nil {
		return fmt.Errorf("failed to update subscription: %w", err)
	}

	// Send welcome email with license key (async)
	go h.sendWelcomeEmail(data.CustomerID, data.CustomerEmail, sub, licenseKey)

	h.logger.Printf("[Webhook] License generated: key=%s tier=%s customer=%s",
		maskKey(licenseKey), tier, data.CustomerEmail)

	return nil
}

// handleSubscriptionUpdated processes subscription.updated events
func (h *WebhookHandler) handleSubscriptionUpdated(event *WebhookEvent) error {
	var data SubscriptionEventData
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return fmt.Errorf("failed to parse subscription data: %w", err)
	}

	h.logger.Printf("[Webhook] Subscription updated: customer=%s status=%s",
		data.CustomerID, data.Status)

	// Convert to internal subscription
	sub := h.convertToSubscription(&data)

	// Update cache
	ctx := context.Background()
	if err := h.client.UpdateSubscription(ctx, sub); err != nil {
		return fmt.Errorf("failed to update subscription: %w", err)
	}

	// TODO: Update database tier
	// This should be done when auto-upgrade is triggered from tier_enforcer.go
	// Example:
	// if h.db != nil {
	//     _, err := h.db.ExecContext(ctx, `
	//         UPDATE tenants
	//         SET tier = $1, tier_upgraded_at = CURRENT_TIMESTAMP
	//         WHERE id = $2
	//     `, sub.Metadata["tier"], data.CustomerID)
	//     if err != nil {
	//         h.logger.Printf("[Webhook] Failed to update tenant tier: %v", err)
	//     }
	// }

	// If upgraded tier, send congratulations email
	if sub.Status == StatusActive {
		go h.sendUpgradeEmail(data.CustomerID, data.CustomerEmail, sub)
	}

	return nil
}

// handleSubscriptionCanceled processes subscription.canceled events
func (h *WebhookHandler) handleSubscriptionCanceled(event *WebhookEvent) error {
	var data SubscriptionEventData
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return fmt.Errorf("failed to parse subscription data: %w", err)
	}

	h.logger.Printf("[Webhook] Subscription canceled: customer=%s", data.CustomerID)

	// Convert to internal subscription
	sub := h.convertToSubscription(&data)
	sub.Status = StatusCanceled

	// Update license status to suspended
	ctx := context.Background()
	if err := h.updateLicenseStatus(ctx, data.CustomerID, "suspended"); err != nil {
		h.logger.Printf("[Webhook] Failed to update license status: %v", err)
		// Continue even if license update fails
	}

	// Update cache
	if err := h.client.UpdateSubscription(ctx, sub); err != nil {
		return fmt.Errorf("failed to update subscription: %w", err)
	}

	// Send cancellation feedback email
	go h.sendCancellationEmail(data.CustomerID, data.CustomerEmail)

	return nil
}

// handleSubscriptionExpired processes subscription.expired events
func (h *WebhookHandler) handleSubscriptionExpired(event *WebhookEvent) error {
	var data SubscriptionEventData
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return fmt.Errorf("failed to parse subscription data: %w", err)
	}

	h.logger.Printf("[Webhook] Subscription expired: customer=%s", data.CustomerID)

	// Mark as canceled
	sub := h.convertToSubscription(&data)
	sub.Status = StatusCanceled

	// Update license status to expired
	ctx := context.Background()
	if err := h.updateLicenseStatus(ctx, data.CustomerID, "expired"); err != nil {
		h.logger.Printf("[Webhook] Failed to update license status: %v", err)
		// Continue even if license update fails
	}

	if err := h.client.UpdateSubscription(ctx, sub); err != nil {
		return fmt.Errorf("failed to update subscription: %w", err)
	}

	return nil
}

// handleSubscriptionTrialEnd processes subscription.trial_end events
func (h *WebhookHandler) handleSubscriptionTrialEnd(event *WebhookEvent) error {
	var data SubscriptionEventData
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return fmt.Errorf("failed to parse subscription data: %w", err)
	}

	h.logger.Printf("[Webhook] Trial ended: customer=%s status=%s",
		data.CustomerID, data.Status)

	// Send trial end email with upgrade CTA
	go h.sendTrialEndEmail(data.CustomerID, data.CustomerEmail)

	return nil
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// convertToSubscription converts webhook data to internal subscription
func (h *WebhookHandler) convertToSubscription(data *SubscriptionEventData) *Subscription {
	periodEnd, _ := time.Parse(time.RFC3339, data.CurrentPeriodEnd)

	var trialEnd *time.Time
	if data.TrialEnd != nil {
		t, _ := time.Parse(time.RFC3339, *data.TrialEnd)
		trialEnd = &t
	}

	var canceledAt *time.Time
	if data.CanceledAt != nil {
		t, _ := time.Parse(time.RFC3339, *data.CanceledAt)
		canceledAt = &t
	}

	// Determine tier from price ID
	tier := "develop" // default
	if tierPlan, err := GetTierByPriceID(data.PriceID); err == nil {
		tier = tierPlan.ID
	}

	metadata := data.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}
	metadata["tier"] = tier

	return &Subscription{
		ID:               data.ID,
		CustomerID:       data.CustomerID,
		ProductID:        data.ProductID,
		PriceID:          data.PriceID,
		Status:           SubscriptionStatus(data.Status),
		CurrentPeriodEnd: periodEnd,
		TrialEnd:         trialEnd,
		CanceledAt:       canceledAt,
		CreatedAt:        time.Now(),
		Metadata:         metadata,
	}
}

// ============================================================================
// EMAIL NOTIFICATIONS (Placeholders)
// ============================================================================

// sendWelcomeEmail sends welcome email to new subscriber
func (h *WebhookHandler) sendWelcomeEmail(tenantID, email string, sub *Subscription, licenseKey string) {
	h.logger.Printf("[Email] Welcome email queued: tenant=%s email=%s tier=%s license=%s",
		tenantID, email, sub.Metadata["tier"], maskKey(licenseKey))
	// TODO: Integrate with email service (Postmark, SendGrid, etc.)
	// Email should include:
	// - Welcome message
	// - License key: licenseKey
	// - Getting started guide: https://docs.igrisinertial.com/runtime/quickstart
	// - What's included in their tier
}

// sendUpgradeEmail sends upgrade congratulations email
func (h *WebhookHandler) sendUpgradeEmail(tenantID, email string, sub *Subscription) {
	h.logger.Printf("[Email] Upgrade email queued: tenant=%s email=%s tier=%s",
		tenantID, email, sub.Metadata["tier"])
	// TODO: Integrate with email service
}

// sendCancellationEmail sends cancellation feedback email
func (h *WebhookHandler) sendCancellationEmail(tenantID, email string) {
	h.logger.Printf("[Email] Cancellation email queued: tenant=%s email=%s", tenantID, email)
	// TODO: Integrate with email service
}

// sendTrialEndEmail sends trial end notification with upgrade CTA
func (h *WebhookHandler) sendTrialEndEmail(tenantID, email string) {
	h.logger.Printf("[Email] Trial end email queued: tenant=%s email=%s", tenantID, email)
	// TODO: Integrate with email service
}

// ============================================================================
// LICENSE MANAGEMENT
// ============================================================================

// mapPriceIDToTier maps Polar price ID to tier name
func (h *WebhookHandler) mapPriceIDToTier(priceID string) string {
	// TODO: Configure price ID mapping in environment or config
	// This is a placeholder mapping - actual price IDs come from Polar dashboard
	tierMapping := map[string]string{
		// These are example price IDs - replace with actual ones from Polar
		"price_horizon_monthly":   "horizon",
		"price_infinite_monthly":  "infinite",
		"price_enterprise_custom": "enterprise",
	}

	if tier, ok := tierMapping[priceID]; ok {
		return tier
	}

	// Default to seed for unknown price IDs (shouldn't happen)
	h.logger.Printf("[Webhook] WARNING: Unknown price ID %s, defaulting to seed tier", priceID)
	return "seed"
}

// storeLicense creates a new license in the database
func (h *WebhookHandler) storeLicense(ctx context.Context, licenseKey, tier, customerEmail, customerID string) error {
	if h.db == nil {
		return fmt.Errorf("database connection not configured")
	}

	licenseID := uuid.New().String()
	devicesLimit := models.GetDevicesLimit(tier)

	_, err := h.db.ExecContext(ctx, `
		INSERT INTO licenses (id, license_key, tier, customer_email, customer_id, devices_limit, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
		ON CONFLICT (license_key) DO UPDATE SET
			tier = EXCLUDED.tier,
			customer_email = EXCLUDED.customer_email,
			customer_id = EXCLUDED.customer_id,
			devices_limit = EXCLUDED.devices_limit,
			status = 'active'
	`, licenseID, licenseKey, tier, customerEmail, customerID, devicesLimit)

	if err != nil {
		return fmt.Errorf("failed to insert license: %w", err)
	}

	h.logger.Printf("[License] Stored: id=%s tier=%s email=%s devices_limit=%d",
		licenseID, tier, customerEmail, devicesLimit)

	return nil
}

// updateLicenseStatus updates license status (for cancellation/expiration)
func (h *WebhookHandler) updateLicenseStatus(ctx context.Context, customerID, status string) error {
	if h.db == nil {
		return fmt.Errorf("database connection not configured")
	}

	result, err := h.db.ExecContext(ctx, `
		UPDATE licenses
		SET status = $1
		WHERE customer_id = $2
	`, status, customerID)

	if err != nil {
		return fmt.Errorf("failed to update license status: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	h.logger.Printf("[License] Updated status: customer=%s status=%s rows=%d",
		customerID, status, rowsAffected)

	return nil
}

// maskKey masks a license key for logging
func maskKey(key string) string {
	if len(key) <= 10 {
		return "****"
	}
	return key[:8] + "****" + key[len(key)-4:]
}
