// Package billing provides trial management for new signups.
// Every new tenant gets a 7-day free trial of their chosen tier (Seed, Horizon, or Infinite).
// On expiry without an active paid subscription the tenant is downgraded to Seed tier.
// A trial can only be started once per tenant.
package billing

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"
)

// ============================================================================
// TRIAL CONFIGURATION
// ============================================================================

const (
	// TrialDurationDays is the length of the free trial period.
	TrialDurationDays = 7

	// DowngradeTierOnExpiry is the tier tenants fall back to when their trial
	// expires without a paid subscription.
	DowngradeTierOnExpiry = string(TierSeed)
)

// ============================================================================
// TRIAL MANAGER
// ============================================================================

// TrialManager handles trial lifecycle for new users.
type TrialManager struct {
	db     *sql.DB
	email  *ResendClient
	logger *log.Logger
}

// NewTrialManager creates a new trial manager.
// Pass a ResendClient to enable lifecycle emails; pass nil to skip emails.
func NewTrialManager(db *sql.DB, email *ResendClient) *TrialManager {
	return &TrialManager{
		db:     db,
		email:  email,
		logger: log.Default(),
	}
}

// ============================================================================
// TRIAL ACTIVATION
// ============================================================================

// StartTrial activates a 7-day free trial for a new tenant on their chosen tier.
// Returns ErrTrialAlreadyUsed if the tenant has already had a trial.
func (tm *TrialManager) StartTrial(ctx context.Context, tenantID, selectedTier string) error {
	if !ValidTier(selectedTier) {
		return fmt.Errorf("invalid tier: %s", selectedTier)
	}

	// Enforce one-trial-per-tenant: reject if trial_started_at is already set.
	var alreadyStarted bool
	err := tm.db.QueryRowContext(ctx,
		`SELECT trial_started_at IS NOT NULL FROM tenants WHERE id = $1`,
		tenantID,
	).Scan(&alreadyStarted)
	if err != nil {
		return fmt.Errorf("failed to check existing trial: %w", err)
	}
	if alreadyStarted {
		return ErrTrialAlreadyUsed
	}

	trialEndsAt := time.Now().Add(time.Hour * 24 * TrialDurationDays)

	_, err = tm.db.ExecContext(ctx, `
		UPDATE tenants
		SET
			tier                 = $1,
			trial_active         = true,
			trial_tier           = $1,
			trial_started_at     = CURRENT_TIMESTAMP,
			trial_ends_at        = $2,
			subscription_status  = 'trial',
			status               = 'active',
			updated_at           = CURRENT_TIMESTAMP
		WHERE id = $3
	`, selectedTier, trialEndsAt, tenantID)
	if err != nil {
		return fmt.Errorf("failed to start trial: %w", err)
	}

	tm.logger.Printf("[Trial] Started 7-day trial: tenant=%s tier=%s ends_at=%s",
		tenantID, selectedTier, trialEndsAt.Format(time.RFC3339))

	// Send welcome email (non-fatal if Resend is not configured)
	if tm.email != nil {
		var tenantEmail string
		_ = tm.db.QueryRowContext(ctx,
			`SELECT email FROM tenants WHERE id = $1`, tenantID,
		).Scan(&tenantEmail)

		if tenantEmail != "" {
			if err := tm.email.SendTrialStartEmail(tenantEmail, selectedTier, trialEndsAt); err != nil {
				tm.logger.Printf("[Trial] Failed to send welcome email: tenant=%s error=%v", tenantID, err)
			}
		}
	}

	return nil
}

// ErrTrialAlreadyUsed is returned when a tenant tries to start a second trial.
var ErrTrialAlreadyUsed = fmt.Errorf("trial already used: each account is eligible for one 7-day trial")

// ============================================================================
// TRIAL STATUS CHECKS
// ============================================================================

// TrialStatus holds current trial information for a tenant.
type TrialStatus struct {
	Active      bool
	TrialTier   string
	CurrentTier string
	StartedAt   *time.Time
	EndsAt      *time.Time
	DaysLeft    int
}

// GetTrialStatus returns the current trial status for a tenant.
func (tm *TrialManager) GetTrialStatus(ctx context.Context, tenantID string) (*TrialStatus, error) {
	var status TrialStatus

	err := tm.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(trial_active, false),
			COALESCE(trial_tier, ''),
			trial_started_at,
			trial_ends_at,
			tier
		FROM tenants
		WHERE id = $1
	`, tenantID).Scan(
		&status.Active,
		&status.TrialTier,
		&status.StartedAt,
		&status.EndsAt,
		&status.CurrentTier,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get trial status: %w", err)
	}

	if status.Active && status.EndsAt != nil {
		daysLeft := int(time.Until(*status.EndsAt).Hours() / 24)
		if daysLeft < 0 {
			daysLeft = 0
		}
		status.DaysLeft = daysLeft
	}

	return &status, nil
}

// ============================================================================
// TRIAL EXPIRATION (run daily via cron)
// ============================================================================

// ExpireTrials finds all expired trials and either converts them to paid
// subscriptions (if the tenant has a Polar subscription) or downgrades them
// to the Seed tier. Returns the number of trials processed.
func (tm *TrialManager) ExpireTrials(ctx context.Context) (int, error) {
	rows, err := tm.db.QueryContext(ctx, `
		SELECT id, trial_tier, email, name
		FROM tenants
		WHERE trial_active = true
		  AND trial_ends_at < CURRENT_TIMESTAMP
	`)
	if err != nil {
		return 0, fmt.Errorf("failed to query expired trials: %w", err)
	}
	defer rows.Close()

	processed := 0

	for rows.Next() {
		var tenantID, trialTier, email, name string
		if err := rows.Scan(&tenantID, &trialTier, &email, &name); err != nil {
			tm.logger.Printf("[Trial] Failed to scan tenant: %v", err)
			continue
		}

		hasPayment, err := tm.hasActiveSubscription(ctx, tenantID)
		if err != nil {
			tm.logger.Printf("[Trial] Failed to check payment for tenant %s: %v", tenantID, err)
			continue
		}

		if hasPayment {
			if err := tm.convertTrialToPaid(ctx, tenantID, trialTier); err != nil {
				tm.logger.Printf("[Trial] Failed to convert trial to paid: tenant=%s error=%v", tenantID, err)
				continue
			}
			tm.logger.Printf("[Trial] Converted to paid: tenant=%s tier=%s", tenantID, trialTier)

			if tm.email != nil && email != "" {
				if err := tm.email.SendUpgradeEmail(email, trialTier); err != nil {
					tm.logger.Printf("[Trial] Failed to send conversion email: %v", err)
				}
			}
		} else {
			if err := tm.downgradeTrial(ctx, tenantID); err != nil {
				tm.logger.Printf("[Trial] Failed to downgrade trial: tenant=%s error=%v", tenantID, err)
				continue
			}
			tm.logger.Printf("[Trial] Downgraded to Seed: tenant=%s (trial expired, no payment)", tenantID)

			if tm.email != nil && email != "" {
				if err := tm.email.SendTrialExpiredEmail(email, trialTier); err != nil {
					tm.logger.Printf("[Trial] Failed to send expiry email: %v", err)
				}
			}
		}

		processed++
	}

	if err := rows.Err(); err != nil {
		return processed, fmt.Errorf("error iterating expired trials: %w", err)
	}

	tm.logger.Printf("[Trial] Processed %d expired trials", processed)
	return processed, nil
}

// hasActiveSubscription checks whether the tenant has an active paid Polar subscription.
// We check polar_subscription_id IS NOT NULL + subscription_status = 'active',
// which is set by the Polar webhook handler when payment is confirmed.
func (tm *TrialManager) hasActiveSubscription(ctx context.Context, tenantID string) (bool, error) {
	var has bool
	err := tm.db.QueryRowContext(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM tenants
			WHERE id = $1
			  AND polar_subscription_id IS NOT NULL
			  AND subscription_status = 'active'
		)
	`, tenantID).Scan(&has)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return has, err
}

// convertTrialToPaid transitions a trial tenant to a paid subscription.
func (tm *TrialManager) convertTrialToPaid(ctx context.Context, tenantID, tier string) error {
	_, err := tm.db.ExecContext(ctx, `
		UPDATE tenants
		SET
			trial_active             = false,
			tier                     = $1,
			subscription_status      = 'active',
			subscription_started_at  = CURRENT_TIMESTAMP,
			trial_converted_at       = CURRENT_TIMESTAMP,
			updated_at               = CURRENT_TIMESTAMP
		WHERE id = $2
	`, tier, tenantID)
	return err
}

// downgradeTrial expires the trial and falls back to the Seed tier.
func (tm *TrialManager) downgradeTrial(ctx context.Context, tenantID string) error {
	_, err := tm.db.ExecContext(ctx, `
		UPDATE tenants
		SET
			trial_active        = false,
			tier                = $1,
			subscription_status = 'expired',
			trial_expired_at    = CURRENT_TIMESTAMP,
			updated_at          = CURRENT_TIMESTAMP
		WHERE id = $2
	`, DowngradeTierOnExpiry, tenantID)
	return err
}

// ============================================================================
// TRIAL REMINDER EMAILS (run daily via cron)
// ============================================================================

// SendTrialReminders sends reminder emails at 3 days and 1 day before expiry.
// Each tenant only receives one reminder per milestone (tracked by trial_reminder_sent_at).
func (tm *TrialManager) SendTrialReminders(ctx context.Context) error {
	if tm.email == nil {
		return nil
	}

	milestones := []int{3, 1}

	for _, daysLeft := range milestones {
		windowStart := time.Now().Add(time.Hour * 24 * time.Duration(daysLeft))
		windowEnd := windowStart.Add(time.Hour * 24)

		rows, err := tm.db.QueryContext(ctx, `
			SELECT id, email, name, trial_tier
			FROM tenants
			WHERE trial_active = true
			  AND trial_ends_at >= $1
			  AND trial_ends_at < $2
			  AND trial_reminder_sent_at IS NULL
		`, windowStart, windowEnd)
		if err != nil {
			tm.logger.Printf("[Trial] Failed to query reminders (%d days): %v", daysLeft, err)
			continue
		}

		count := 0
		for rows.Next() {
			var tenantID, email, name, trialTier string
			if err := rows.Scan(&tenantID, &email, &name, &trialTier); err != nil {
				continue
			}

			if err := tm.email.SendTrialReminderEmail(email, trialTier, daysLeft); err != nil {
				tm.logger.Printf("[Trial] Failed to send reminder email: tenant=%s error=%v", tenantID, err)
				continue
			}

			tm.db.ExecContext(ctx, `
				UPDATE tenants
				SET trial_reminder_sent_at = CURRENT_TIMESTAMP
				WHERE id = $1
			`, tenantID)

			count++
		}
		rows.Close()

		if count > 0 {
			tm.logger.Printf("[Trial] Sent %d reminder emails (%d days left)", count, daysLeft)
		}
	}

	return nil
}

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

// ExtendTrial extends the trial period by N additional days.
func (tm *TrialManager) ExtendTrial(ctx context.Context, tenantID string, additionalDays int) error {
	_, err := tm.db.ExecContext(ctx, `
		UPDATE tenants
		SET
			trial_ends_at = trial_ends_at + ($1 * INTERVAL '1 day'),
			updated_at    = CURRENT_TIMESTAMP
		WHERE id = $2 AND trial_active = true
	`, additionalDays, tenantID)
	if err != nil {
		return fmt.Errorf("failed to extend trial: %w", err)
	}
	tm.logger.Printf("[Trial] Extended trial: tenant=%s additional_days=%d", tenantID, additionalDays)
	return nil
}

// CancelTrial immediately ends the trial and downgrades to Seed tier.
func (tm *TrialManager) CancelTrial(ctx context.Context, tenantID string) error {
	return tm.downgradeTrial(ctx, tenantID)
}
