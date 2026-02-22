package cognitive

import (
	"context"
	"database/sql"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/policies"
	"github.com/Igris-inertial/system/igris-overture/router"
)

// Worker runs the cognitive advisor on a schedule
type Worker struct {
	advisor   *Advisor
	applier   *Applier
	interval  time.Duration
	ctx       context.Context
	cancel    context.CancelFunc
}

// NewWorker creates a new cognitive worker
func NewWorker(
	db *sql.DB,
	policyEngine *policies.AdvancedPolicyEngine,
	semanticRouter *router.SemanticRouter,
) *Worker {
	advisor := NewAdvisor(db)
	applier := NewApplier(db, policyEngine, semanticRouter)

	return &Worker{
		advisor:  advisor,
		applier:  applier,
		interval: 15 * time.Minute,
	}
}

// Start starts the cognitive worker background process
func (w *Worker) Start(ctx context.Context) {
	w.ctx, w.cancel = context.WithCancel(ctx)

	log.Info().
		Dur("interval", w.interval).
		Msg("Starting Cognitive Advisor Worker")

	// Run initial analysis immediately
	go func() {
		if err := w.advisor.AnalyzeAndGenerateProposals(w.ctx); err != nil {
			log.Error().Err(err).Msg("Initial cognitive analysis failed")
		}
	}()

	// Start periodic analysis
	go w.run()

	// FIX-2026-02: cognitive-advisor — enable autonomous self-tuning via auto-apply
	go w.runAutoApply()
}

// Stop stops the cognitive worker
func (w *Worker) Stop() {
	if w.cancel != nil {
		log.Info().Msg("Stopping Cognitive Advisor Worker")
		w.cancel()
	}
}

// run executes the analysis loop
func (w *Worker) run() {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-w.ctx.Done():
			log.Info().Msg("Cognitive worker shutting down")
			return

		case <-ticker.C:
			log.Debug().Msg("Starting cognitive analysis cycle")

			if err := w.advisor.AnalyzeAndGenerateProposals(w.ctx); err != nil {
				log.Error().Err(err).Msg("Cognitive analysis failed")
			}

			// Cleanup expired proposals (older than 7 days, pending status)
			if err := w.cleanupExpiredProposals(); err != nil {
				log.Error().Err(err).Msg("Failed to cleanup expired proposals")
			}
		}
	}
}

// cleanupExpiredProposals marks old pending proposals as expired
func (w *Worker) cleanupExpiredProposals() error {
	query := `
		UPDATE cognitive_proposals
		SET status = 'expired'
		WHERE status = 'pending'
			AND generated_at < NOW() - INTERVAL '7 days'
	`

	result, err := w.advisor.db.ExecContext(w.ctx, query)
	if err != nil {
		return err
	}

	rows, _ := result.RowsAffected()
	if rows > 0 {
		log.Info().Int64("expired_count", rows).Msg("Expired old pending proposals")
	}

	return nil
}

// runAutoApply starts the autonomous proposal auto-apply loop.
// FIX-2026-02: cognitive-advisor — implements the previously-commented-out goroutine.
// Runs inside the worker's context so it shuts down with the worker.
func (w *Worker) runAutoApply() {
	if w.ctx == nil {
		return // context not yet initialised (should not happen in normal Start flow)
	}
	aa := NewAutoApplier(w.advisor.db, w.applier)
	aa.Start(w.ctx)
	// Block until context is cancelled so the goroutine doesn't return prematurely
	<-w.ctx.Done()
	aa.Stop()
}

// GetAdvisor returns the advisor instance
func (w *Worker) GetAdvisor() *Advisor {
	return w.advisor
}

// GetApplier returns the applier instance
func (w *Worker) GetApplier() *Applier {
	return w.applier
}

// StartAdvisorWorker is a convenience function to start the cognitive worker
func StartAdvisorWorker(
	ctx context.Context,
	db *sql.DB,
	policyEngine *policies.AdvancedPolicyEngine,
	semanticRouter *router.SemanticRouter,
) *Worker {
	worker := NewWorker(db, policyEngine, semanticRouter)
	worker.Start(ctx)
	return worker
}
