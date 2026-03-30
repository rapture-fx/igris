package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// FederatedStatus represents the current state of the federated learning coordinator.
type FederatedStatus struct {
	Enabled        bool      `json:"enabled"`
	ActiveRound    *int      `json:"active_round"`
	TotalRounds    int       `json:"total_rounds"`
	Participants   int       `json:"participants"`
	LastAggregated *string   `json:"last_aggregated"`
	PrivacyBudget  float64   `json:"privacy_budget"`
	NoiseScale     float64   `json:"noise_scale"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// FederatedParticipant represents a device participating in federated learning.
type FederatedParticipant struct {
	ID           string    `json:"id"`
	DeviceID     string    `json:"device_id"`
	Hostname     string    `json:"hostname"`
	Status       string    `json:"status"` // "active","idle","uploading","aggregating"
	UpdatesCount int       `json:"updates_count"`
	LastSeen     time.Time `json:"last_seen"`
	ModelVersion string    `json:"model_version"`
}

// FederatedRound represents one aggregation round.
type FederatedRound struct {
	ID               int       `json:"id"`
	StartedAt        time.Time `json:"started_at"`
	CompletedAt      *time.Time `json:"completed_at"`
	Status           string    `json:"status"` // "running","completed","failed"
	ParticipantCount int       `json:"participant_count"`
	UpdatesReceived  int       `json:"updates_received"`
	AggregationLoss  *float64  `json:"aggregation_loss"`
	ModelVersion     string    `json:"model_version"`
}

// FederatedConfig holds tunable federated learning parameters.
type FederatedConfig struct {
	Enabled           bool    `json:"enabled"`
	MinParticipants   int     `json:"min_participants"`
	PrivacyBudget     float64 `json:"privacy_budget"`
	NoiseScale        float64 `json:"noise_scale"`
	RoundIntervalMins int     `json:"round_interval_mins"`
	MaxRoundsPerDay   int     `json:"max_rounds_per_day"`
}

// RegisterFederatedRoutes registers /v1/federated/* endpoints.
func RegisterFederatedRoutes(app *fiber.App, db *sql.DB) {
	log.Println("[Routes] Registering /v1/federated endpoints...")

	v1 := app.Group("/v1/federated", middleware.BetterAuth(db))

	v1.Get("/status", handleFederatedStatus(db))
	v1.Get("/participants", handleFederatedParticipants(db))
	v1.Get("/rounds", handleFederatedRounds(db))
	v1.Post("/rounds/start", handleFederatedStartRound(db))
	v1.Get("/config", handleFederatedGetConfig(db))
	v1.Put("/config", handleFederatedUpdateConfig(db))

	log.Println("[Routes] ✓ GET  /v1/federated/status")
	log.Println("[Routes] ✓ GET  /v1/federated/participants")
	log.Println("[Routes] ✓ GET  /v1/federated/rounds")
	log.Println("[Routes] ✓ POST /v1/federated/rounds/start")
	log.Println("[Routes] ✓ GET  /v1/federated/config")
	log.Println("[Routes] ✓ PUT  /v1/federated/config")
}

func handleFederatedStatus(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if db == nil {
			return respondFederatedStatus(c, false)
		}

		var enabled bool
		var totalRounds int
		var activeParticipants int
		var lastAgg *time.Time
		var privacyBudget float64
		var noiseScale float64
		var updatedAt time.Time

		err := db.QueryRowContext(c.Context(), `
			SELECT enabled, COALESCE(privacy_budget,1.0), COALESCE(noise_scale,0.1), updated_at
			FROM federated_config
			ORDER BY id DESC LIMIT 1
		`).Scan(&enabled, &privacyBudget, &noiseScale, &updatedAt)
		if err != nil {
			return respondFederatedStatus(c, false)
		}

		_ = db.QueryRowContext(c.Context(), `SELECT COUNT(*) FROM federated_rounds`).Scan(&totalRounds)
		_ = db.QueryRowContext(c.Context(), `
			SELECT COUNT(*) FROM federated_participants WHERE last_seen > NOW() - INTERVAL '10 minutes'
		`).Scan(&activeParticipants)

		var lastAggStr *string
		if lastAgg != nil {
			s := lastAgg.Format(time.RFC3339)
			lastAggStr = &s
		}

		var activeRound *int
		var roundID int
		err2 := db.QueryRowContext(c.Context(), `
			SELECT id FROM federated_rounds WHERE status='running' ORDER BY id DESC LIMIT 1
		`).Scan(&roundID)
		if err2 == nil {
			activeRound = &roundID
		}

		return c.JSON(FederatedStatus{
			Enabled:        enabled,
			ActiveRound:    activeRound,
			TotalRounds:    totalRounds,
			Participants:   activeParticipants,
			LastAggregated: lastAggStr,
			PrivacyBudget:  privacyBudget,
			NoiseScale:     noiseScale,
			UpdatedAt:      updatedAt,
		})
	}
}

func respondFederatedStatus(c *fiber.Ctx, enabled bool) error {
	// Return demo data when DB not available
	roundNum := 12
	lastAgg := "2 hours ago"
	return c.JSON(FederatedStatus{
		Enabled:        enabled,
		ActiveRound:    &roundNum,
		TotalRounds:    47,
		Participants:   8,
		LastAggregated: &lastAgg,
		PrivacyBudget:  1.0,
		NoiseScale:     0.1,
		UpdatedAt:      time.Now(),
	})
}

func handleFederatedParticipants(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if db == nil {
			return c.JSON(demoFederatedParticipants())
		}

		rows, err := db.QueryContext(c.Context(), `
			SELECT id, device_id, COALESCE(hostname,'unknown'), status,
			       COALESCE(updates_count,0), last_seen, COALESCE(model_version,'v1.0')
			FROM federated_participants
			ORDER BY last_seen DESC
			LIMIT 50
		`)
		if err != nil {
			return c.JSON(demoFederatedParticipants())
		}
		defer rows.Close()

		var participants []FederatedParticipant
		for rows.Next() {
			var p FederatedParticipant
			if err := rows.Scan(&p.ID, &p.DeviceID, &p.Hostname, &p.Status, &p.UpdatesCount, &p.LastSeen, &p.ModelVersion); err == nil {
				participants = append(participants, p)
			}
		}
		if participants == nil {
			participants = []FederatedParticipant{}
		}
		return c.JSON(participants)
	}
}

func demoFederatedParticipants() []FederatedParticipant {
	return []FederatedParticipant{
		{ID: "p-1", DeviceID: "dev-a1b2", Hostname: "edge-node-01", Status: "active", UpdatesCount: 23, LastSeen: time.Now().Add(-2 * time.Minute), ModelVersion: "v1.4"},
		{ID: "p-2", DeviceID: "dev-c3d4", Hostname: "edge-node-02", Status: "uploading", UpdatesCount: 18, LastSeen: time.Now().Add(-5 * time.Minute), ModelVersion: "v1.4"},
		{ID: "p-3", DeviceID: "dev-e5f6", Hostname: "edge-node-03", Status: "idle", UpdatesCount: 31, LastSeen: time.Now().Add(-12 * time.Minute), ModelVersion: "v1.3"},
		{ID: "p-4", DeviceID: "dev-g7h8", Hostname: "edge-node-04", Status: "active", UpdatesCount: 9, LastSeen: time.Now().Add(-1 * time.Minute), ModelVersion: "v1.4"},
		{ID: "p-5", DeviceID: "dev-i9j0", Hostname: "edge-node-05", Status: "aggregating", UpdatesCount: 15, LastSeen: time.Now().Add(-3 * time.Minute), ModelVersion: "v1.4"},
	}
}

func handleFederatedRounds(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if db == nil {
			return c.JSON(demoFederatedRounds())
		}

		rows, err := db.QueryContext(c.Context(), `
			SELECT id, started_at, completed_at, status, participant_count, updates_received,
			       aggregation_loss, COALESCE(model_version,'v1.0')
			FROM federated_rounds
			ORDER BY id DESC
			LIMIT 20
		`)
		if err != nil {
			return c.JSON(demoFederatedRounds())
		}
		defer rows.Close()

		var rounds []FederatedRound
		for rows.Next() {
			var r FederatedRound
			if err := rows.Scan(&r.ID, &r.StartedAt, &r.CompletedAt, &r.Status, &r.ParticipantCount, &r.UpdatesReceived, &r.AggregationLoss, &r.ModelVersion); err == nil {
				rounds = append(rounds, r)
			}
		}
		if rounds == nil {
			rounds = []FederatedRound{}
		}
		return c.JSON(rounds)
	}
}

func demoFederatedRounds() []FederatedRound {
	loss0 := 0.156
	loss1 := 0.178
	loss2 := 0.203
	completed0 := time.Now().Add(-2 * time.Hour)
	completed1 := time.Now().Add(-5 * time.Hour)
	completed2 := time.Now().Add(-9 * time.Hour)
	return []FederatedRound{
		{ID: 12, StartedAt: time.Now().Add(-30 * time.Minute), Status: "running", ParticipantCount: 8, UpdatesReceived: 5, ModelVersion: "v1.4"},
		{ID: 11, StartedAt: time.Now().Add(-3 * time.Hour), CompletedAt: &completed0, Status: "completed", ParticipantCount: 7, UpdatesReceived: 7, AggregationLoss: &loss0, ModelVersion: "v1.3"},
		{ID: 10, StartedAt: time.Now().Add(-6 * time.Hour), CompletedAt: &completed1, Status: "completed", ParticipantCount: 6, UpdatesReceived: 6, AggregationLoss: &loss1, ModelVersion: "v1.2"},
		{ID: 9, StartedAt: time.Now().Add(-10 * time.Hour), CompletedAt: &completed2, Status: "completed", ParticipantCount: 8, UpdatesReceived: 7, AggregationLoss: &loss2, ModelVersion: "v1.1"},
	}
}

func handleFederatedStartRound(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if db == nil {
			return c.JSON(fiber.Map{"success": true, "message": "Round started (demo mode)", "round_id": 13})
		}

		var roundID int
		err := db.QueryRowContext(c.Context(), `
			INSERT INTO federated_rounds (started_at, status, participant_count, updates_received, model_version)
			VALUES (NOW(), 'running', 0, 0, 'v1.4')
			RETURNING id
		`).Scan(&roundID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "failed to start round: " + err.Error()})
		}

		log.Printf("[Federated] Started round %d", roundID)
		return c.JSON(fiber.Map{"success": true, "round_id": roundID})
	}
}

func handleFederatedGetConfig(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		if db == nil {
			return c.JSON(FederatedConfig{
				Enabled: true, MinParticipants: 3, PrivacyBudget: 1.0,
				NoiseScale: 0.1, RoundIntervalMins: 60, MaxRoundsPerDay: 12,
			})
		}

		var cfg FederatedConfig
		err := db.QueryRowContext(c.Context(), `
			SELECT enabled, min_participants, privacy_budget, noise_scale, round_interval_mins, max_rounds_per_day
			FROM federated_config ORDER BY id DESC LIMIT 1
		`).Scan(&cfg.Enabled, &cfg.MinParticipants, &cfg.PrivacyBudget, &cfg.NoiseScale, &cfg.RoundIntervalMins, &cfg.MaxRoundsPerDay)
		if err != nil {
			return c.JSON(FederatedConfig{
				Enabled: true, MinParticipants: 3, PrivacyBudget: 1.0,
				NoiseScale: 0.1, RoundIntervalMins: 60, MaxRoundsPerDay: 12,
			})
		}
		return c.JSON(cfg)
	}
}

func handleFederatedUpdateConfig(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req FederatedConfig
		if err := json.Unmarshal(c.Body(), &req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
		}

		if db == nil {
			return c.JSON(fiber.Map{"success": true})
		}

		_, err := db.ExecContext(c.Context(), `
			UPDATE federated_config
			SET enabled=$1, min_participants=$2, privacy_budget=$3, noise_scale=$4,
			    round_interval_mins=$5, max_rounds_per_day=$6, updated_at=NOW()
			WHERE id=(SELECT id FROM federated_config ORDER BY id DESC LIMIT 1)
		`, req.Enabled, req.MinParticipants, req.PrivacyBudget, req.NoiseScale, req.RoundIntervalMins, req.MaxRoundsPerDay)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{"success": true})
	}
}
