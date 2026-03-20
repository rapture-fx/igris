// Package billing provides email delivery via Resend API
package billing

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// ResendClient sends transactional emails via Resend API
type ResendClient struct {
	apiKey  string
	fromEmail string
	baseURL string
	logger  *log.Logger
}

// ResendEmail represents an email to send
type ResendEmail struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

// ResendResponse represents the Resend API response
type ResendResponse struct {
	ID string `json:"id"`
}

// NewResendClient creates a new Resend email client
func NewResendClient() *ResendClient {
	apiKey := os.Getenv("RESEND_API_KEY")
	fromEmail := os.Getenv("RESEND_FROM_EMAIL")
	if fromEmail == "" {
		fromEmail = "Igris Inertial <noreply@igrisinertial.com>"
	}

	return &ResendClient{
		apiKey:    apiKey,
		fromEmail: fromEmail,
		baseURL:   "https://api.resend.com",
		logger:    log.Default(),
	}
}

// IsEnabled returns true if Resend is configured
func (r *ResendClient) IsEnabled() bool {
	return r.apiKey != ""
}

// Send sends an email via Resend
func (r *ResendClient) Send(to, subject, html string) error {
	if !r.IsEnabled() {
		r.logger.Printf("[Resend] Email skipped (no API key): to=%s subject=%s", to, subject)
		return nil
	}

	email := ResendEmail{
		From:    r.fromEmail,
		To:      []string{to},
		Subject: subject,
		HTML:    html,
	}

	body, err := json.Marshal(email)
	if err != nil {
		return fmt.Errorf("failed to marshal email: %w", err)
	}

	req, err := http.NewRequest("POST", r.baseURL+"/emails", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+r.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	var result ResendResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		r.logger.Printf("[Resend] Email sent but failed to parse response: %v", err)
		return nil
	}

	r.logger.Printf("[Resend] Email sent: id=%s to=%s subject=%s", result.ID, to, subject)
	return nil
}

// SendWelcomeEmail sends the welcome email with license key
func (r *ResendClient) SendWelcomeEmail(email, tier, licenseKey string) error {
	subject := "Welcome to Igris Inertial — Your License Key"

	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="border-bottom: 2px solid #0a0a0a; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Igris Inertial</h1>
  </div>

  <p style="font-size: 16px; line-height: 1.6;">Welcome to Igris Inertial. Your <strong>%s</strong> tier subscription is now active.</p>

  <div style="background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #666;">Your License Key</p>
    <code style="display: block; font-size: 16px; font-weight: 600; color: #0a0a0a; word-break: break-all;">%s</code>
  </div>

  <h3 style="font-size: 16px; margin-top: 32px;">Get Started</h3>
  <div style="background: #0a0a0a; color: #e0e0e0; border-radius: 8px; padding: 16px; font-family: 'SF Mono', Monaco, monospace; font-size: 14px; line-height: 1.8;">
    <div><span style="color: #666;"># Install the runtime</span></div>
    <div>curl -fsSL https://get.igrisinertial.com | sh</div>
    <br>
    <div><span style="color: #666;"># Set your license key</span></div>
    <div>export IGRIS_LICENSE_KEY=%s</div>
    <br>
    <div><span style="color: #666;"># Start the runtime</span></div>
    <div>igris-runtime serve</div>
  </div>

  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #666;">
    <p><a href="https://console.igrisinertial.com" style="color: #0a0a0a;">Dashboard</a> · <a href="https://docs.igrisinertial.com" style="color: #0a0a0a;">Documentation</a> · <a href="https://docs.igrisinertial.com/runtime/quickstart" style="color: #0a0a0a;">Quick Start Guide</a></p>
  </div>
</body>
</html>`, tier, licenseKey, licenseKey)

	return r.Send(email, subject, html)
}

// SendUpgradeEmail sends the upgrade confirmation email
func (r *ResendClient) SendUpgradeEmail(email, newTier string) error {
	subject := "Plan Upgraded — Igris Inertial"

	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="border-bottom: 2px solid #0a0a0a; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Igris Inertial</h1>
  </div>

  <p style="font-size: 16px; line-height: 1.6;">Your plan has been upgraded to <strong>%s</strong>. Your new limits are now active.</p>

  <p style="font-size: 14px; color: #666;">
    <a href="https://console.igrisinertial.com/dashboard/settings" style="color: #0a0a0a;">View your updated plan details</a>
  </p>
</body>
</html>`, newTier)

	return r.Send(email, subject, html)
}

// SendCancellationEmail sends the cancellation confirmation email
func (r *ResendClient) SendCancellationEmail(email string) error {
	subject := "Subscription Canceled — Igris Inertial"

	html := `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="border-bottom: 2px solid #0a0a0a; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Igris Inertial</h1>
  </div>

  <p style="font-size: 16px; line-height: 1.6;">Your subscription has been canceled. Your license will remain active until the end of your current billing period.</p>

  <p style="font-size: 14px; color: #666;">
    Changed your mind? <a href="https://igrisinertial.com/pricing" style="color: #0a0a0a;">Resubscribe anytime</a>.
  </p>
</body>
</html>`

	return r.Send(email, subject, html)
}

// SendTrialStartEmail sends the trial welcome email when a tenant starts their trial.
func (r *ResendClient) SendTrialStartEmail(email, tier string, endsAt time.Time) error {
	subject := fmt.Sprintf("Your 7-day %s trial has started — Igris Inertial", capitalize(tier))

	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="border-bottom: 2px solid #0a0a0a; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Igris Inertial</h1>
  </div>

  <p style="font-size: 16px; line-height: 1.6;">Your 7-day <strong>%s</strong> trial is now active.</p>

  <p style="font-size: 14px; color: #444; line-height: 1.6;">
    You have full access to all %s tier features until <strong>%s</strong>.
    No credit card required during the trial.
  </p>

  <h3 style="font-size: 16px; margin-top: 32px;">Get Started</h3>
  <div style="background: #0a0a0a; color: #e0e0e0; border-radius: 8px; padding: 16px; font-family: 'SF Mono', Monaco, monospace; font-size: 14px; line-height: 1.8;">
    <div><span style="color: #666;"># Download and install the runtime</span></div>
    <div>curl -fsSL https://get.igrisinertial.com | sh</div>
    <br>
    <div><span style="color: #666;"># Start the runtime</span></div>
    <div>igris-runtime serve</div>
  </div>

  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #666;">
    <p><a href="https://console.igrisinertial.com" style="color: #0a0a0a;">Dashboard</a> · <a href="https://docs.igrisinertial.com" style="color: #0a0a0a;">Documentation</a> · <a href="https://igrisinertial.com/pricing" style="color: #0a0a0a;">Pricing</a></p>
  </div>
</body>
</html>`, capitalize(tier), capitalize(tier), endsAt.Format("January 2, 2006"))

	return r.Send(email, subject, html)
}

// SendTrialReminderEmail sends a trial expiry reminder at a given days-left milestone.
func (r *ResendClient) SendTrialReminderEmail(email, tier string, daysLeft int) error {
	subject := fmt.Sprintf("%d day%s left in your %s trial — Igris Inertial",
		daysLeft, pluralS(daysLeft), capitalize(tier))

	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="border-bottom: 2px solid #0a0a0a; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Igris Inertial</h1>
  </div>

  <p style="font-size: 16px; line-height: 1.6;">Your <strong>%s</strong> trial ends in <strong>%d day%s</strong>.</p>

  <p style="font-size: 14px; color: #444; line-height: 1.6;">
    Subscribe now to keep your runtime fleet running without interruption.
    If you don't subscribe, your account will be moved to the Seed tier when the trial ends.
  </p>

  <div style="margin: 24px 0;">
    <a href="https://igrisinertial.com/pricing" style="display: inline-block; background: #0a0a0a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">Subscribe Now</a>
  </div>

  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #666;">
    <p><a href="https://console.igrisinertial.com/settings/billing" style="color: #0a0a0a;">Manage billing</a> · <a href="https://igrisinertial.com/pricing" style="color: #0a0a0a;">View plans</a></p>
  </div>
</body>
</html>`, capitalize(tier), daysLeft, pluralS(daysLeft))

	return r.Send(email, subject, html)
}

// SendTrialExpiredEmail notifies the tenant their trial expired and they were downgraded.
func (r *ResendClient) SendTrialExpiredEmail(email, previousTier string) error {
	subject := "Your trial has ended — Igris Inertial"

	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="border-bottom: 2px solid #0a0a0a; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Igris Inertial</h1>
  </div>

  <p style="font-size: 16px; line-height: 1.6;">Your <strong>%s</strong> trial has ended.</p>

  <p style="font-size: 14px; color: #444; line-height: 1.6;">
    Your account has been moved to the <strong>Seed</strong> tier (3 runtime instances).
    Subscribe to restore your previous limits.
  </p>

  <div style="margin: 24px 0;">
    <a href="https://igrisinertial.com/pricing" style="display: inline-block; background: #0a0a0a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">Resubscribe</a>
  </div>

  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #666;">
    <p><a href="https://console.igrisinertial.com/settings/billing" style="color: #0a0a0a;">Manage billing</a></p>
  </div>
</body>
</html>`, capitalize(previousTier))

	return r.Send(email, subject, html)
}

// SendTrialEndEmail is kept for backwards compatibility.
func (r *ResendClient) SendTrialEndEmail(email string) error {
	return r.SendTrialReminderEmail(email, "your", 1)
}

func capitalize(s string) string {
	if len(s) == 0 {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func pluralS(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}
