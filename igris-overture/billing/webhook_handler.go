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

	"github.com/Igris-inertial/system/igris-overture/metrics"
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
	email  *ResendClient
	logger *log.Logger
}

// NewWebhookHandler creates a webhook handler
func NewWebhookHandler(client *PolarClient, db *sql.DB) *WebhookHandler {
	return &WebhookHandler{
		client: client,
		db:     db,
		email:  NewResendClient(),
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
		metrics.BillingWebhookFailuresTotal.Inc()
		http.Error(w, "Failed to read body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Verify signature
	signature := r.Header.Get("X-Polar-Signature")
	if !h.verifySignature(body, signature) {
		h.logger.Printf("[Webhook] Invalid signature")
		metrics.BillingWebhookFailuresTotal.Inc()
		http.Error(w, "Invalid signature", http.StatusUnauthorized)
		return
	}

	// Parse event
	var event WebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		h.logger.Printf("[Webhook] Failed to parse event: %v", err)
		metrics.BillingWebhookFailuresTotal.Inc()
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	h.logger.Printf("[Webhook] Received event: type=%s created=%s",
		event.Type, event.CreatedAt.Format(time.RFC3339))

	// Route to handler
	if err := h.routeEvent(&event); err != nil {
		h.logger.Printf("[Webhook] Handler failed: %v", err)
		metrics.BillingWebhookFailuresTotal.Inc()
		http.Error(w, "Handler failed", http.StatusInternalServerError)
		return
	}

	// Return 200 OK
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

// verifySignature validates HMAC signature
func (h *WebhookHandler) verifySignature(body []byte, signature string) bool {
	// SECURITY: Reject all webhooks if no secret is configured
	if h.client.webhookSecret == "" {
		h.logger.Println("[Webhook] REJECTED: No webhook secret configured. Set POLAR_WEBHOOK_SECRET.")
		return false
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
	tier, err := h.mapPriceIDToTier(data.PriceID)
	if err != nil {
		return fmt.Errorf("failed to resolve tier for price %s: %w", data.PriceID, err)
	}

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

	// Update tenant subscription status and tier in the tenants table
	if h.db != nil {
		if _, dbErr := h.db.ExecContext(ctx, `
			UPDATE tenants
			SET subscription_status = 'active',
			    tier = $1,
			    tier_upgraded_at = CURRENT_TIMESTAMP
			WHERE tenant_email = $2
		`, tier, data.CustomerEmail); dbErr != nil {
			h.logger.Printf("[Webhook] Failed to update tenant status for %s: %v", data.CustomerEmail, dbErr)
		} else {
			h.logger.Printf("[Webhook] Tenant updated: email=%s tier=%s status=active", data.CustomerEmail, tier)
		}
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

	// Update tenant tier and subscription status in database (match by email)
	if h.db != nil {
		newStatus := string(sub.Status)
		if newStatus == "" {
			newStatus = "active"
		}
		if _, dbErr := h.db.ExecContext(ctx, `
			UPDATE tenants
			SET tier = $1,
			    subscription_status = $2,
			    tier_upgraded_at = CURRENT_TIMESTAMP
			WHERE tenant_email = $3
		`, sub.Metadata["tier"], newStatus, data.CustomerEmail); dbErr != nil {
			h.logger.Printf("[Webhook] Failed to update tenant tier/status for %s: %v", data.CustomerEmail, dbErr)
		}
	}

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

	// Reset tenant subscription status
	if h.db != nil {
		if _, dbErr := h.db.ExecContext(ctx, `
			UPDATE tenants SET subscription_status = 'none' WHERE tenant_email = $1
		`, data.CustomerEmail); dbErr != nil {
			h.logger.Printf("[Webhook] Failed to reset tenant status for %s: %v", data.CustomerEmail, dbErr)
		}
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

	var canceledAt *time.Time
	if data.CanceledAt != nil {
		t, _ := time.Parse(time.RFC3339, *data.CanceledAt)
		canceledAt = &t
	}

	// Determine tier from price ID
	metadata := data.Metadata
	if metadata == nil {
		metadata = make(map[string]string)
	}

	if tier, err := ResolveTierID(metadata, data.PriceID); err == nil {
		metadata["tier"] = tier
	} else {
		h.logger.Printf("[Webhook] WARNING: leaving subscription tier unset for customer=%s price=%s: %v",
			data.CustomerID, data.PriceID, err)
	}

	return &Subscription{
		ID:               data.ID,
		CustomerID:       data.CustomerID,
		ProductID:        data.ProductID,
		PriceID:          data.PriceID,
		Status:           SubscriptionStatus(data.Status),
		CurrentPeriodEnd: periodEnd,
		CanceledAt:       canceledAt,
		CreatedAt:        time.Now(),
		Metadata:         metadata,
	}
}

// ============================================================================
// EMAIL NOTIFICATIONS (Placeholders)
// ============================================================================

// sendWelcomeEmail sends welcome email to new subscriber via Resend
func (h *WebhookHandler) sendWelcomeEmail(tenantID, email string, sub *Subscription, licenseKey string) {
	tier := sub.Metadata["tier"]
	h.logger.Printf("[Email] Sending welcome email: tenant=%s email=%s tier=%s license=%s",
		tenantID, email, tier, maskKey(licenseKey))

	if err := h.email.SendWelcomeEmail(email, tier, licenseKey); err != nil {
		h.logger.Printf("[Email] Failed to send welcome email: %v", err)
	}
}

// sendUpgradeEmail sends upgrade congratulations email via Resend
func (h *WebhookHandler) sendUpgradeEmail(tenantID, email string, sub *Subscription) {
	tier := sub.Metadata["tier"]
	h.logger.Printf("[Email] Sending upgrade email: tenant=%s email=%s tier=%s", tenantID, email, tier)

	if err := h.email.SendUpgradeEmail(email, tier); err != nil {
		h.logger.Printf("[Email] Failed to send upgrade email: %v", err)
	}
}

// sendCancellationEmail sends cancellation feedback email via Resend
func (h *WebhookHandler) sendCancellationEmail(tenantID, email string) {
	h.logger.Printf("[Email] Sending cancellation email: tenant=%s email=%s", tenantID, email)

	if err := h.email.SendCancellationEmail(email); err != nil {
		h.logger.Printf("[Email] Failed to send cancellation email: %v", err)
	}
}

// sendTrialEndEmail sends trial end notification with upgrade CTA via Resend
func (h *WebhookHandler) sendTrialEndEmail(tenantID, email string) {
	h.logger.Printf("[Email] Sending trial end email: tenant=%s email=%s", tenantID, email)

	if err := h.email.SendTrialEndEmail(email); err != nil {
		h.logger.Printf("[Email] Failed to send trial end email: %v", err)
	}
}

// ============================================================================
// LICENSE MANAGEMENT
// ============================================================================

// mapPriceIDToTier maps a Polar price ID to a canonical tier name.
func (h *WebhookHandler) mapPriceIDToTier(priceID string) (string, error) {
	// TODO: Replace placeholder IDs with actual Polar price IDs from dashboard
	tierMapping := map[string]string{
		"price_seed_monthly":     string(TierSeed),
		"price_horizon_monthly":  string(TierHorizon),
		"price_infinite_monthly": string(TierInfinite),
	}

	if tier, ok := tierMapping[priceID]; ok {
		return tier, nil
	}

	// Fall back to plan lookup by price ID
	if plan, err := GetTierByPriceID(priceID); err == nil {
		return string(plan.ID), nil
	}

	h.logger.Printf("[Webhook] ERROR: Unknown price ID %s", priceID)
	return "", fmt.Errorf("unknown price ID: %s", priceID)
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
