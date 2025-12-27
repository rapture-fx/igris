package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
)

// FleetConfig holds fleet-related configuration
type FleetConfig struct {
	DBEnabled bool
	DB        *sql.DB
}

// RegisterRequest represents agent registration payload
type RegisterRequest struct {
	AgentID      string            `json:"agent_id"`
	Hostname     string            `json:"hostname"`
	Platform     string            `json:"platform"`
	Version      string            `json:"version"`
	Capabilities []string          `json:"capabilities"`
	Location     *string           `json:"location,omitempty"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

// RegisterResponse represents registration response
type RegisterResponse struct {
	Success       bool   `json:"success"`
	FleetID       string `json:"fleet_id"`
	AssignedRole  string `json:"assigned_role"`
	ConfigVersion int64  `json:"config_version"`
}

// TelemetryData represents telemetry payload from agent
type TelemetryData struct {
	AgentID    string             `json:"agent_id"`
	Timestamp  int64              `json:"timestamp"`
	Metrics    map[string]float64 `json:"metrics"`
	Logs       []LogEntry         `json:"logs"`
	Status     AgentStatus        `json:"status"`
}

// LogEntry represents a log entry
type LogEntry struct {
	Timestamp int64             `json:"timestamp"`
	Level     string            `json:"level"`
	Message   string            `json:"message"`
	Metadata  map[string]string `json:"metadata,omitempty"`
}

// AgentStatus represents agent health status
type AgentStatus struct {
	Health           string  `json:"health"`
	UptimeSecs       int64   `json:"uptime_secs"`
	CPUUsagePercent  float32 `json:"cpu_usage_percent"`
	MemoryUsageMB    int64   `json:"memory_usage_mb"`
	ActiveTasks      int32   `json:"active_tasks"`
}

// ConfigSyncResponse represents configuration sync response
type ConfigSyncResponse struct {
	Version         int64           `json:"version"`
	Config          json.RawMessage `json:"config"`
	RequiresRestart bool            `json:"requires_restart"`
}

// AgentListItem represents a single agent in the fleet list
type AgentListItem struct {
	AgentID      string    `json:"agent_id"`
	FleetID      string    `json:"fleet_id"`
	Hostname     string    `json:"hostname"`
	Platform     string    `json:"platform"`
	Version      string    `json:"version"`
	Status       string    `json:"status"`
	Health       string    `json:"health"`
	LastSeen     time.Time `json:"last_seen"`
	RegisteredAt time.Time `json:"registered_at"`
}

// RegisterFleetRoutes registers fleet management endpoints
func RegisterFleetRoutes(app *fiber.App, config FleetConfig) error {
	log.Println("[Routes] Registering fleet management endpoints...")

	if !config.DBEnabled || config.DB == nil {
		log.Println("[Routes] ⚠️  Fleet management disabled (database not available)")
		return nil
	}

	// Fleet API group
	fleet := app.Group("/api/fleet")

	// POST /api/fleet/register - Register a new fleet agent
	fleet.Post("/register", func(c *fiber.Ctx) error {
		var req RegisterRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{
				"error": "Invalid request body",
			})
		}

		// Validate required fields
		if req.AgentID == "" || req.Hostname == "" || req.Platform == "" || req.Version == "" {
			return c.Status(400).JSON(fiber.Map{
				"error": "Missing required fields (agent_id, hostname, platform, version)",
			})
		}

		// Convert capabilities to JSONB
		capabilitiesJSON, err := json.Marshal(req.Capabilities)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"error": "Failed to serialize capabilities",
			})
		}

		// Convert metadata to JSONB
		var metadataJSON []byte
		if req.Metadata != nil {
			metadataJSON, err = json.Marshal(req.Metadata)
			if err != nil {
				return c.Status(500).JSON(fiber.Map{
					"error": "Failed to serialize metadata",
				})
			}
		}

		// Call database function to register agent
		var fleetID string
		var configVersion int64

		query := `
			SELECT fleet_id, config_version
			FROM register_fleet_agent($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)
		`

		err = config.DB.QueryRow(
			query,
			req.AgentID,
			req.Hostname,
			req.Platform,
			req.Version,
			capabilitiesJSON,
			req.Location,
			metadataJSON,
		).Scan(&fleetID, &configVersion)

		if err != nil {
			log.Printf("[Fleet] Registration error: %v", err)
			return c.Status(500).JSON(fiber.Map{
				"error": "Failed to register agent",
			})
		}

		log.Printf("[Fleet] Agent registered: %s (fleet: %s, config: %d)", req.AgentID, fleetID, configVersion)

		return c.JSON(RegisterResponse{
			Success:       true,
			FleetID:       fleetID,
			AssignedRole:  "edge-worker",
			ConfigVersion: configVersion,
		})
	})
	log.Println("[Routes] ✓ POST /api/fleet/register")

	// POST /api/fleet/:fleet_id/telemetry - Upload telemetry data
	fleet.Post("/:fleet_id/telemetry", func(c *fiber.Ctx) error {
		fleetID := c.Params("fleet_id")

		var telemetry TelemetryData
		if err := c.BodyParser(&telemetry); err != nil {
			return c.Status(400).JSON(fiber.Map{
				"error": "Invalid telemetry data",
			})
		}

		// Validate required fields
		if telemetry.AgentID == "" {
			return c.Status(400).JSON(fiber.Map{
				"error": "Missing agent_id in telemetry data",
			})
		}

		// Convert metrics to JSONB
		var metricsJSON []byte
		var err error
		if telemetry.Metrics != nil {
			metricsJSON, err = json.Marshal(telemetry.Metrics)
			if err != nil {
				return c.Status(500).JSON(fiber.Map{
					"error": "Failed to serialize metrics",
				})
			}
		}

		// Convert logs to JSONB
		var logsJSON []byte
		if len(telemetry.Logs) > 0 {
			logsJSON, err = json.Marshal(telemetry.Logs)
			if err != nil {
				return c.Status(500).JSON(fiber.Map{
					"error": "Failed to serialize logs",
				})
			}
		}

		// Record telemetry in database
		query := `
			SELECT record_fleet_telemetry(
				$1, $2, $3, $4::decimal, $5, $6, $7::jsonb, $8::jsonb
			)
		`

		var telemetryID string
		err = config.DB.QueryRow(
			query,
			telemetry.AgentID,
			telemetry.Status.Health,
			telemetry.Status.UptimeSecs,
			telemetry.Status.CPUUsagePercent,
			telemetry.Status.MemoryUsageMB,
			telemetry.Status.ActiveTasks,
			metricsJSON,
			logsJSON,
		).Scan(&telemetryID)

		if err != nil {
			log.Printf("[Fleet] Telemetry error for %s: %v", telemetry.AgentID, err)
			return c.Status(500).JSON(fiber.Map{
				"error": "Failed to record telemetry",
			})
		}

		log.Printf("[Fleet] Telemetry recorded: %s (agent: %s, health: %s)",
			telemetryID, telemetry.AgentID, telemetry.Status.Health)

		return c.JSON(fiber.Map{
			"success": true,
			"id":      telemetryID,
		})
	})
	log.Println("[Routes] ✓ POST /api/fleet/:fleet_id/telemetry")

	// GET /api/fleet/:fleet_id/config - Get configuration for fleet
	fleet.Get("/:fleet_id/config", func(c *fiber.Ctx) error {
		fleetID := c.Params("fleet_id")

		// In a real implementation, you would look up the agent by fleet_id
		// For now, we'll return a default config
		query := `
			SELECT version, config_data, requires_restart
			FROM fleet_configs
			WHERE fleet_id = $1 OR fleet_id IS NULL
			ORDER BY
				CASE WHEN fleet_id = $1 THEN 1 ELSE 2 END,
				version DESC
			LIMIT 1
		`

		var version int64
		var configData []byte
		var requiresRestart bool

		err := config.DB.QueryRow(query, fleetID).Scan(&version, &configData, &requiresRestart)
		if err == sql.ErrNoRows {
			// Return default config if none found
			return c.JSON(ConfigSyncResponse{
				Version:         1,
				Config:          json.RawMessage(`{"model": "gpt-4o-mini", "temperature": 0.7}`),
				RequiresRestart: false,
			})
		}
		if err != nil {
			log.Printf("[Fleet] Config fetch error: %v", err)
			return c.Status(500).JSON(fiber.Map{
				"error": "Failed to fetch configuration",
			})
		}

		return c.JSON(ConfigSyncResponse{
			Version:         version,
			Config:          json.RawMessage(configData),
			RequiresRestart: requiresRestart,
		})
	})
	log.Println("[Routes] ✓ GET /api/fleet/:fleet_id/config")

	// GET /api/fleet/agents - List all fleet agents
	fleet.Get("/agents", func(c *fiber.Ctx) error {
		query := `
			SELECT agent_id, fleet_id, hostname, platform, version,
			       status, health, last_seen, registered_at
			FROM fleet_agents
			ORDER BY last_seen DESC
			LIMIT 100
		`

		rows, err := config.DB.Query(query)
		if err != nil {
			log.Printf("[Fleet] List agents error: %v", err)
			return c.Status(500).JSON(fiber.Map{
				"error": "Failed to list agents",
			})
		}
		defer rows.Close()

		agents := make([]AgentListItem, 0)
		for rows.Next() {
			var agent AgentListItem
			err := rows.Scan(
				&agent.AgentID,
				&agent.FleetID,
				&agent.Hostname,
				&agent.Platform,
				&agent.Version,
				&agent.Status,
				&agent.Health,
				&agent.LastSeen,
				&agent.RegisteredAt,
			)
			if err != nil {
				log.Printf("[Fleet] Scan error: %v", err)
				continue
			}
			agents = append(agents, agent)
		}

		return c.JSON(fiber.Map{
			"agents": agents,
			"total":  len(agents),
		})
	})
	log.Println("[Routes] ✓ GET /api/fleet/agents")

	// GET /api/fleet/agents/:agent_id - Get specific agent details
	fleet.Get("/agents/:agent_id", func(c *fiber.Ctx) error {
		agentID := c.Params("agent_id")

		query := `
			SELECT agent_id, fleet_id, hostname, platform, version,
			       status, health, last_seen, registered_at, config_version,
			       assigned_role, capabilities, metadata
			FROM fleet_agents
			WHERE agent_id = $1
		`

		var agent struct {
			AgentID       string          `json:"agent_id"`
			FleetID       string          `json:"fleet_id"`
			Hostname      string          `json:"hostname"`
			Platform      string          `json:"platform"`
			Version       string          `json:"version"`
			Status        string          `json:"status"`
			Health        string          `json:"health"`
			LastSeen      time.Time       `json:"last_seen"`
			RegisteredAt  time.Time       `json:"registered_at"`
			ConfigVersion int64           `json:"config_version"`
			AssignedRole  *string         `json:"assigned_role,omitempty"`
			Capabilities  json.RawMessage `json:"capabilities"`
			Metadata      json.RawMessage `json:"metadata"`
		}

		err := config.DB.QueryRow(query, agentID).Scan(
			&agent.AgentID,
			&agent.FleetID,
			&agent.Hostname,
			&agent.Platform,
			&agent.Version,
			&agent.Status,
			&agent.Health,
			&agent.LastSeen,
			&agent.RegisteredAt,
			&agent.ConfigVersion,
			&agent.AssignedRole,
			&agent.Capabilities,
			&agent.Metadata,
		)

		if err == sql.ErrNoRows {
			return c.Status(404).JSON(fiber.Map{
				"error": "Agent not found",
			})
		}
		if err != nil {
			log.Printf("[Fleet] Get agent error: %v", err)
			return c.Status(500).JSON(fiber.Map{
				"error": "Failed to get agent details",
			})
		}

		return c.JSON(agent)
	})
	log.Println("[Routes] ✓ GET /api/fleet/agents/:agent_id")

	// GET /api/fleet/health - Get fleet health overview
	fleet.Get("/health", func(c *fiber.Ctx) error {
		query := `
			SELECT
				fleet_id,
				total_agents,
				active_agents,
				healthy_agents,
				degraded_agents,
				unhealthy_agents,
				offline_agents
			FROM v_fleet_health
		`

		rows, err := config.DB.Query(query)
		if err != nil {
			log.Printf("[Fleet] Health query error: %v", err)
			return c.Status(500).JSON(fiber.Map{
				"error": "Failed to get fleet health",
			})
		}
		defer rows.Close()

		type FleetHealth struct {
			FleetID         string `json:"fleet_id"`
			TotalAgents     int    `json:"total_agents"`
			ActiveAgents    int    `json:"active_agents"`
			HealthyAgents   int    `json:"healthy_agents"`
			DegradedAgents  int    `json:"degraded_agents"`
			UnhealthyAgents int    `json:"unhealthy_agents"`
			OfflineAgents   int    `json:"offline_agents"`
		}

		fleets := make([]FleetHealth, 0)
		for rows.Next() {
			var health FleetHealth
			err := rows.Scan(
				&health.FleetID,
				&health.TotalAgents,
				&health.ActiveAgents,
				&health.HealthyAgents,
				&health.DegradedAgents,
				&health.UnhealthyAgents,
				&health.OfflineAgents,
			)
			if err != nil {
				log.Printf("[Fleet] Health scan error: %v", err)
				continue
			}
			fleets = append(fleets, health)
		}

		return c.JSON(fiber.Map{
			"fleets": fleets,
		})
	})
	log.Println("[Routes] ✓ GET /api/fleet/health")

	log.Println("[Routes] All fleet management routes registered successfully")
	return nil
}
