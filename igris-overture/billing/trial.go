// Package billing provides trial management for new signups
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
	TrialDurationDays     = 14
	DowngradeTierOnExpiry = string(TierSeed)
)

// ============================================================================
// TRIAL MANAGER
// ============================================================================

// TrialManager handles trial lifecycle for new users
type TrialManager struct {
	db     *sql.DB
	logger *log.Logger
}

// NewTrialManager creates a new trial manager
func NewTrialManager(db *sql.DB) *TrialManager {
	return &TrialManager{
		db:     db,
		logger: log.Default(),
	}
}

// ============================================================================
// TRIAL ACTIVATION
// ============================================================================

// StartTrial activates a trial for a new tenant on the Seed tier.
func (tm *TrialManager) StartTrial(ctx context.Context, tenantID, selectedTier string) error {
	if !ValidTier(selectedTier) {
		return fmt.Errorf("invalid tier: %s", selectedTier)
	}

	// Calculate trial end date (14 days from now)
	trialEndsAt := time.Now().Add(time.Hour * 24 * TrialDurationDays)

	// Update tenant with trial info
	_, err := tm.db.ExecContext(ctx, `
		UPDATE tenants
		SET
			tier = $1,
			trial_active = true,
			trial_tier = $1,
			trial_started_at = CURRENT_TIMESTAMP,
			trial_ends_at = $2,
			status = 'active',
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $3
	`, selectedTier, trialEndsAt, tenantID)

	if err != nil {
		return fmt.Errorf("failed to start trial: %w", err)
	}

	tm.logger.Printf("[Trial] Started 14-day trial: tenant=%s tier=%s ends_at=%s",
		tenantID, selectedTier, trialEndsAt.Format(time.RFC3339))

	// TODO: Send welcome email
	// Subject: "Welcome to Igris Overture! Your 14-day {tier} trial has started"
	// Body:
	//   Hi there!
	//
	//   Your 14-day {tier} trial is now active. You have full access to:
	//   - [List of tier features]
	//
	//   Trial ends: {trial_ends_at}
	//   After your trial, you'll be downgraded to Develop tier unless you add payment.
	//
	//   Get started: {dashboard_url}

	return nil
}

// ============================================================================
// TRIAL STATUS CHECKS
// ============================================================================

// GetTrialStatus returns current trial status for a tenant
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

	// Calculate days left
	if status.Active && status.EndsAt != nil {
		daysLeft := int(time.Until(*status.EndsAt).Hours() / 24)
		if daysLeft < 0 {
			daysLeft = 0
		}
		status.DaysLeft = daysLeft
	}

	return &status, nil
}

// TrialStatus represents trial information
type TrialStatus struct {
	Active      bool
	TrialTier   string
	CurrentTier string
	StartedAt   *time.Time
	EndsAt      *time.Time
	DaysLeft    int
}

// ============================================================================
// TRIAL EXPIRATION
// ============================================================================

// ExpireTrials checks for expired trials and downgrades tenants
// This should run daily via cron job
func (tm *TrialManager) ExpireTrials(ctx context.Context) (int, error) {
	// Find all expired trials
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

	expiredCount := 0

	for rows.Next() {
		var tenantID, trialTier, email, name string
		if err := rows.Scan(&tenantID, &trialTier, &email, &name); err != nil {
			tm.logger.Printf("[Trial] Failed to scan tenant: %v", err)
			continue
		}

		// Check if tenant has active payment method
		hasPayment, err := tm.hasPaymentMethod(ctx, tenantID)
		if err != nil {
			tm.logger.Printf("[Trial] Failed to check payment for tenant %s: %v", tenantID, err)
			continue
		}

		if hasPayment {
			// Convert trial to paid subscription
			if err := tm.convertTrialToPaid(ctx, tenantID, trialTier); err != nil {
				tm.logger.Printf("[Trial] Failed to convert trial to paid: tenant=%s error=%v", tenantID, err)
				continue
			}

			tm.logger.Printf("[Trial] Converted to paid: tenant=%s tier=%s", tenantID, trialTier)
			expiredCount++

			// TODO: Send conversion email
			// Subject: "Your trial has been converted to {tier} plan"
		} else {
			// Downgrade to Seed tier
			if err := tm.downgradeTrial(ctx, tenantID); err != nil {
				tm.logger.Printf("[Trial] Failed to downgrade trial: tenant=%s error=%v", tenantID, err)
				continue
			}

			tm.logger.Printf("[Trial] Downgraded to Seed: tenant=%s (trial expired, no payment)", tenantID)
			expiredCount++

			// TODO: Send downgrade email
			// Subject: "Your trial has ended - now on Seed tier"
			// Body:
			//   Your 14-day trial has ended.
			//
			//   You've been moved to our Seed tier ($29/month).
			//   Upgrade to Horizon or Infinite to scale your runtime fleet.
			//
			//   Upgrade now: {upgrade_url}
		}
	}

	if err := rows.Err(); err != nil {
		return expiredCount, fmt.Errorf("error iterating expired trials: %w", err)
	}

	tm.logger.Printf("[Trial] Processed %d expired trials", expiredCount)

	return expiredCount, nil
}

// hasPaymentMethod checks if tenant has valid payment method
func (tm *TrialManager) hasPaymentMethod(ctx context.Context, tenantID string) (bool, error) {
	var hasPayment bool

	err := tm.db.QueryRowContext(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM payment_methods
			WHERE tenant_id = $1
			  AND status = 'active'
			  AND expires_at > CURRENT_TIMESTAMP
		)
	`, tenantID).Scan(&hasPayment)

	if err == sql.ErrNoRows {
		return false, nil
	}

	return hasPayment, err
}

// convertTrialToPaid converts trial to paid subscription
func (tm *TrialManager) convertTrialToPaid(ctx context.Context, tenantID, tier string) error {
	_, err := tm.db.ExecContext(ctx, `
		UPDATE tenants
		SET
			trial_active = false,
			tier = $1,
			subscription_status = 'active',
			subscription_started_at = CURRENT_TIMESTAMP,
			trial_converted_at = CURRENT_TIMESTAMP,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`, tier, tenantID)

	return err
}

// downgradeTrial downgrades expired trial to Develop tier
func (tm *TrialManager) downgradeTrial(ctx context.Context, tenantID string) error {
	_, err := tm.db.ExecContext(ctx, `
		UPDATE tenants
		SET
			trial_active = false,
			tier = $1,
			trial_expired_at = CURRENT_TIMESTAMP,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`, DowngradeTierOnExpiry, tenantID)

	return err
}

// ============================================================================
// TRIAL REMINDER EMAILS
// ============================================================================

// SendTrialReminders sends reminder emails at key milestones
// This should run daily via cron job
func (tm *TrialManager) SendTrialReminders(ctx context.Context) error {
	// Send reminders at 7 days, 3 days, 1 day before expiry

	milestones := []struct {
		daysLeft int
		message  string
	}{
		{7, "7 days left in your trial"},
		{3, "3 days left - upgrade now"},
		{1, "Last day of your trial"},
	}

	for _, milestone := range milestones {
		targetDate := time.Now().Add(time.Hour * 24 * time.Duration(milestone.daysLeft))
		startOfDay := time.Date(targetDate.Year(), targetDate.Month(), targetDate.Day(), 0, 0, 0, 0, targetDate.Location())
		endOfDay := startOfDay.Add(time.Hour * 24)

		// Find trials expiring at this milestone
		rows, err := tm.db.QueryContext(ctx, `
			SELECT id, email, name, trial_tier
			FROM tenants
			WHERE trial_active = true
			  AND trial_ends_at >= $1
			  AND trial_ends_at < $2
			  AND trial_reminder_sent_at IS NULL
		`, startOfDay, endOfDay)

		if err != nil {
			tm.logger.Printf("[Trial] Failed to query reminders for %d days: %v", milestone.daysLeft, err)
			continue
		}

		count := 0
		for rows.Next() {
			var tenantID, email, name, trialTier string
			if err := rows.Scan(&tenantID, &email, &name, &trialTier); err != nil {
				continue
			}

			// TODO: Send reminder email via AlertQueue
			// Subject: "{milestone.message}"
			// Body template based on days left

			// Mark reminder as sent
			tm.db.ExecContext(ctx, `
				UPDATE tenants
				SET trial_reminder_sent_at = CURRENT_TIMESTAMP
				WHERE id = $1
			`, tenantID)

			count++
		}
		rows.Close()

		if count > 0 {
			tm.logger.Printf("[Trial] Sent %d reminders for %d-day milestone", count, milestone.daysLeft)
		}
	}

	return nil
}

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

// ExtendTrial extends trial period by N days
func (tm *TrialManager) ExtendTrial(ctx context.Context, tenantID string, additionalDays int) error {
	_, err := tm.db.ExecContext(ctx, `
		UPDATE tenants
		SET
			trial_ends_at = trial_ends_at + INTERVAL '1 day' * $1,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = $2 AND trial_active = true
	`, additionalDays, tenantID)

	if err != nil {
		return fmt.Errorf("failed to extend trial: %w", err)
	}

	tm.logger.Printf("[Trial] Extended trial: tenant=%s additional_days=%d", tenantID, additionalDays)

	return nil
}

// CancelTrial immediately cancels trial and downgrades to Develop
func (tm *TrialManager) CancelTrial(ctx context.Context, tenantID string) error {
	return tm.downgradeTrial(ctx, tenantID)
}
