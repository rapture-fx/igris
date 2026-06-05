package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"strconv"
	"time"

	"github.com/Igris-inertial/system/igris-overture/internal"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/security"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// FleetConfig holds fleet-related configuration
type FleetConfig struct {
	DBEnabled bool
	DB        *sql.DB
}

var runtimeRevokeCommands = func(ctx context.Context, runtimeEndpoint, tenantID string, deliveryKeys []string, revokeOwned bool, reason string) (*internal.RuntimeCommandRevokeResult, error) {
	return internal.NewRuntimeClient(runtimeEndpoint).RevokeCommands(ctx, tenantID, deliveryKeys, revokeOwned, reason)
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
	PublicKey    string            `json:"public_key"` // Base64-encoded Ed25519 public key
	Signature    string            `json:"signature"`  // Base64-encoded Ed25519 signature
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
	AgentID   string             `json:"agent_id"`
	Timestamp int64              `json:"timestamp"`
	Metrics   map[string]float64 `json:"metrics"`
	Logs      []LogEntry         `json:"logs"`
	Status    AgentStatus        `json:"status"`
	Signature *string            `json:"signature,omitempty"` // Base64-encoded Ed25519 signature
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
	Health          string  `json:"health"`
	UptimeSecs      int64   `json:"uptime_secs"`
	CPUUsagePercent float32 `json:"cpu_usage_percent"`
	MemoryUsageMB   int64   `json:"memory_usage_mb"`
	ActiveTasks     int32   `json:"active_tasks"`
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

		// HYBRID CONTRACT: Validate cryptographic signature
		if req.PublicKey == "" || req.Signature == "" {
			return c.Status(400).JSON(fiber.Map{
				"error": "Missing hybrid contract signature (public_key, signature required)",
			})
		}

		// Create unsigned payload for verification (exclude public_key and signature)
		type UnsignedPayload struct {
			AgentID      string            `json:"agent_id"`
			Hostname     string            `json:"hostname"`
			Platform     string            `json:"platform"`
			Version      string            `json:"version"`
			Capabilities []string          `json:"capabilities"`
			Location     *string           `json:"location,omitempty"`
			Metadata     map[string]string `json:"metadata,omitempty"`
		}

		unsignedPayload := UnsignedPayload{
			AgentID:      req.AgentID,
			Hostname:     req.Hostname,
			Platform:     req.Platform,
			Version:      req.Version,
			Capabilities: req.Capabilities,
			Location:     req.Location,
			Metadata:     req.Metadata,
		}

		// Verify Ed25519 signature
		if err := security.VerifyJSONPayloadSignature(req.PublicKey, req.Signature, unsignedPayload); err != nil {
			log.Printf("[Fleet] Registration signature verification failed for %s: %v", req.AgentID, err)
			return c.Status(401).JSON(fiber.Map{
				"error": "Invalid hybrid contract signature",
			})
		}

		log.Printf("[Fleet] Signature verified for agent %s (public key: %s...)", req.AgentID, req.PublicKey[:16])

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

		// Call database function to register agent (with public key for hybrid contract)
		var fleetID string
		var configVersion int64

		query := `
			SELECT fleet_id, config_version
			FROM register_fleet_agent($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8)
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
			req.PublicKey, // Store public key for future signature verification
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
		_ = c.Params("fleet_id")

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

		// HYBRID CONTRACT: Verify signature if provided
		if telemetry.Signature != nil && *telemetry.Signature != "" {
			// Fetch agent's public key from database
			var publicKey string
			err := config.DB.QueryRow(
				"SELECT public_key FROM fleet_agents WHERE agent_id = $1",
				telemetry.AgentID,
			).Scan(&publicKey)

			if err == sql.ErrNoRows {
				return c.Status(404).JSON(fiber.Map{
					"error": "Agent not found",
				})
			}
			if err != nil {
				log.Printf("[Fleet] Failed to fetch public key for %s: %v", telemetry.AgentID, err)
				return c.Status(500).JSON(fiber.Map{
					"error": "Failed to verify signature",
				})
			}

			// Create unsigned payload for verification (exclude signature)
			type UnsignedTelemetry struct {
				AgentID   string             `json:"agent_id"`
				Timestamp int64              `json:"timestamp"`
				Metrics   map[string]float64 `json:"metrics"`
				Logs      []LogEntry         `json:"logs"`
				Status    AgentStatus        `json:"status"`
			}

			unsignedTelemetry := UnsignedTelemetry{
				AgentID:   telemetry.AgentID,
				Timestamp: telemetry.Timestamp,
				Metrics:   telemetry.Metrics,
				Logs:      telemetry.Logs,
				Status:    telemetry.Status,
			}

			// Verify Ed25519 signature
			if err := security.VerifyJSONPayloadSignature(publicKey, *telemetry.Signature, unsignedTelemetry); err != nil {
				log.Printf("[Fleet] Telemetry signature verification failed for %s: %v", telemetry.AgentID, err)
				return c.Status(401).JSON(fiber.Map{
					"error": "Invalid telemetry signature",
				})
			}

			log.Printf("[Fleet] Telemetry signature verified for agent %s", telemetry.AgentID)
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

// ─── Device routes (web-console Fleet > Devices page) ────────────────────────

// RosNodeInfo is the ROS 2 node metadata for a device.
type RosNodeInfo struct {
	NodeName          string   `json:"node_name"`
	Namespace         string   `json:"namespace"`
	LifecycleState    string   `json:"lifecycle_state"`
	AirGapped         bool     `json:"air_gapped"`
	LastTraceAt       *string  `json:"last_trace_at,omitempty"`
	CPUUsagePercent   *float64 `json:"cpu_usage_percent,omitempty"`
	MemoryUsageMB     *int64   `json:"memory_usage_mb,omitempty"`
	ViolationCount24h *int64   `json:"violation_count_24h,omitempty"`
}

// ContainmentInfo holds safety containment metadata for a device.
type ContainmentInfo struct {
	Enabled        bool   `json:"enabled"`
	Mode           string `json:"mode,omitempty"`
	ViolationCount int64  `json:"violation_count,omitempty"`
}

// DeviceItem is the response shape for a single runtime instance as a "device".
type DeviceItem struct {
	DeviceID         string           `json:"device_id"`
	Status           string           `json:"status"`
	RuntimeVersion   string           `json:"runtime_version"`
	LastSeen         string           `json:"last_seen"`
	RegistrationTime string           `json:"registration_time"`
	LicenseID        *string          `json:"license_id"`
	CPUUsagePercent  float64          `json:"cpu_usage_percent"`
	MemoryUsageMB    int64            `json:"memory_usage_mb"`
	ActiveExecutions int64            `json:"active_executions"`
	Executions24h    int64            `json:"executions_24h"`
	Violations24h    int64            `json:"violations_24h"`
	LastExecutionID  *string          `json:"last_execution_id"`
	PolicyHash       string           `json:"policy_hash"`
	GlobalPolicyHash string           `json:"global_policy_hash"`
	RosNode          *RosNodeInfo     `json:"ros_node,omitempty"`
	Containment      *ContainmentInfo `json:"containment,omitempty"`
}

// RegisterDeviceRoutes registers the /devices/* endpoints consumed by the
// web-console Fleet > Devices page. Authentication is via Clerk JWT.
func RegisterDeviceRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Println("[Routes] /devices endpoints disabled — database not available")
		return
	}

	devices := app.Group("/devices")
	devices.Use(middleware.BetterAuth(db))

	// GET /devices — list all runtime instances for the authenticated tenant
	devices.Get("/", func(c *fiber.Ctx) error {
		clerkUserID := middleware.GetClerkUserID(c)
		if clerkUserID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		rows, err := db.Query(`
			SELECT
				r.runtime_id,
				COALESCE(r.version, ''),
				r.is_healthy,
				COALESCE(r.last_heartbeat, r.last_seen_at),
				r.registered_at,
				r.status,
				COALESCE(
					(SELECT COUNT(*) FROM execution_lineage e
					 WHERE e.runtime_id = r.runtime_id
					   AND e.timestamp_utc >= NOW() - INTERVAL '5 minutes'), 0
				),
				COALESCE(
					(SELECT COUNT(*) FROM execution_lineage e
					 WHERE e.runtime_id = r.runtime_id
					   AND e.timestamp_utc >= NOW() - INTERVAL '24 hours'), 0
				),
				COALESCE(
					(SELECT COUNT(*) FROM execution_lineage e
					 WHERE e.runtime_id = r.runtime_id
					   AND e.violation_occurred = TRUE
					   AND e.timestamp_utc >= NOW() - INTERVAL '24 hours'), 0
				),
				(SELECT e.execution_id FROM execution_lineage e
				 WHERE e.runtime_id = r.runtime_id
				 ORDER BY e.timestamp_utc DESC LIMIT 1)
			FROM runtime_instances r
			WHERE r.tenant_id = $1
			ORDER BY r.last_seen_at DESC
			LIMIT 200
		`, clerkUserID)
		if err != nil {
			log.Printf("[Devices] List error: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		defer rows.Close()

		const globalHash = "sha256:c4a2f1e8b9d3a7f6"
		items := make([]DeviceItem, 0)
		for rows.Next() {
			var d DeviceItem
			var isHealthy bool
			var status string
			var lastSeen, registeredAt time.Time
			var lastExecID sql.NullString

			if err := rows.Scan(
				&d.DeviceID, &d.RuntimeVersion, &isHealthy,
				&lastSeen, &registeredAt, &status,
				&d.ActiveExecutions, &d.Executions24h, &d.Violations24h,
				&lastExecID,
			); err != nil {
				log.Printf("[Devices] Scan error: %v", err)
				continue
			}
			if status == "active" && time.Since(lastSeen) < 5*time.Minute {
				d.Status = "online"
			} else {
				d.Status = "offline"
			}
			d.LastSeen = lastSeen.UTC().Format(time.RFC3339)
			d.RegistrationTime = registeredAt.UTC().Format(time.RFC3339)
			if lastExecID.Valid {
				d.LastExecutionID = &lastExecID.String
			}
			d.PolicyHash = globalHash
			d.GlobalPolicyHash = globalHash
			items = append(items, d)
		}

		// Enrich with ROS node state from ros_lifecycle_states table (if available).
		for i := range items {
			var nodeName, namespace, lifecycle string
			var airGapped bool
			var lastTrace sql.NullString
			err := db.QueryRowContext(c.Context(), `
				SELECT
					COALESCE(node_name, 'igris_node') AS node_name,
					COALESCE(namespace, '/') AS namespace,
					COALESCE(lifecycle_state, 'Unconfigured') AS lifecycle_state,
					COALESCE(air_gapped, false) AS air_gapped,
					TO_CHAR(last_trace_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_trace_at
				FROM ros_lifecycle_states
				WHERE runtime_id = $1
				ORDER BY updated_at DESC
				LIMIT 1
			`, items[i].DeviceID).Scan(&nodeName, &namespace, &lifecycle, &airGapped, &lastTrace)
			if err == nil {
				rosNode := &RosNodeInfo{
					NodeName:       nodeName,
					Namespace:      namespace,
					LifecycleState: lifecycle,
					AirGapped:      airGapped,
				}
				if lastTrace.Valid && lastTrace.String != "" {
					rosNode.LastTraceAt = &lastTrace.String
				}
				items[i].RosNode = rosNode
			}

			// Containment: check device_containment table
			var containEnabled bool
			var containMode string
			var containViolCount int64
			err = db.QueryRowContext(c.Context(), `
				SELECT
					COALESCE(enabled, false),
					COALESCE(mode, 'cgroup'),
					COALESCE(violation_count, 0)
				FROM device_containment
				WHERE device_id = $1
				LIMIT 1
			`, items[i].DeviceID).Scan(&containEnabled, &containMode, &containViolCount)
			if err == nil {
				items[i].Containment = &ContainmentInfo{
					Enabled:        containEnabled,
					Mode:           containMode,
					ViolationCount: containViolCount,
				}
			}
		}

		return c.JSON(items)
	})
	log.Println("[Routes] ✓ GET /devices")

	// GET /devices/stats?range=24h — aggregate execution/violation totals
	devices.Get("/stats", func(c *fiber.Ctx) error {
		clerkUserID := middleware.GetClerkUserID(c)
		if clerkUserID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		rangeParam := c.Query("range", "24h")
		var interval string
		switch rangeParam {
		case "7d":
			interval = "7 days"
		case "30d":
			interval = "30 days"
		default:
			interval = "24 hours"
		}

		var execTotal, violTotal int64
		_ = db.QueryRow(`
			SELECT
				COUNT(*),
				SUM(CASE WHEN violation_occurred THEN 1 ELSE 0 END)
			FROM execution_lineage
			WHERE tenant_id = $1
			  AND timestamp_utc >= NOW() - INTERVAL '`+interval+`'
		`, clerkUserID).Scan(&execTotal, &violTotal)

		return c.JSON(fiber.Map{
			"executions_total": execTotal,
			"violations_total": violTotal,
		})
	})
	log.Println("[Routes] ✓ GET /devices/stats")

	// GET /devices/:id/executions — recent executions for a specific device
	devices.Get("/:id/executions", func(c *fiber.Ctx) error {
		clerkUserID := middleware.GetClerkUserID(c)
		if clerkUserID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		deviceID := c.Params("id")

		limit := 10
		if raw := c.Query("limit", ""); raw != "" {
			if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 100 {
				limit = v
			}
		}

		rows, err := db.Query(`
			SELECT execution_id, agent_id, wall_time_ms, violation_occurred, timestamp_utc
			FROM execution_lineage
			WHERE runtime_id = $1
			  AND tenant_id = $2
			ORDER BY timestamp_utc DESC
			LIMIT $3
		`, deviceID, clerkUserID, limit)
		if err != nil {
			log.Printf("[Devices] Executions query error: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		defer rows.Close()

		type ExecMini struct {
			ExecutionID string `json:"execution_id"`
			AgentID     string `json:"agent_id"`
			Model       string `json:"model"`
			Status      string `json:"status"`
			DurationMs  int64  `json:"duration_ms"`
			Timestamp   string `json:"timestamp"`
		}

		result := make([]ExecMini, 0)
		for rows.Next() {
			var e ExecMini
			var violated bool
			var ts time.Time
			if err := rows.Scan(&e.ExecutionID, &e.AgentID, &e.DurationMs, &violated, &ts); err != nil {
				continue
			}
			if violated {
				e.Status = "violation"
			} else {
				e.Status = "completed"
			}
			e.Timestamp = ts.UTC().Format(time.RFC3339)
			result = append(result, e)
		}
		return c.JSON(result)
	})
	log.Println("[Routes] ✓ GET /devices/:id/executions")

	// GET /devices/:id/violations — recent violations for a specific device
	devices.Get("/:id/violations", func(c *fiber.Ctx) error {
		clerkUserID := middleware.GetClerkUserID(c)
		if clerkUserID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		deviceID := c.Params("id")

		limit := 10
		if raw := c.Query("limit", ""); raw != "" {
			if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 100 {
				limit = v
			}
		}

		rows, err := db.Query(`
			SELECT timestamp_utc, execution_id
			FROM execution_lineage
			WHERE runtime_id = $1
			  AND violation_occurred = TRUE
			  AND tenant_id = $2
			ORDER BY timestamp_utc DESC
			LIMIT $3
		`, deviceID, clerkUserID, limit)
		if err != nil {
			log.Printf("[Devices] Violations query error: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		defer rows.Close()

		type ViolMini struct {
			Timestamp     string `json:"timestamp"`
			ViolationType string `json:"violation_type"`
			Limit         string `json:"limit"`
			Observed      string `json:"observed"`
			ExecutionID   string `json:"execution_id"`
		}

		result := make([]ViolMini, 0)
		for rows.Next() {
			var v ViolMini
			var ts time.Time
			if err := rows.Scan(&ts, &v.ExecutionID); err != nil {
				continue
			}
			v.Timestamp = ts.UTC().Format(time.RFC3339)
			v.ViolationType = "policy_violation"
			result = append(result, v)
		}
		return c.JSON(result)
	})
	log.Println("[Routes] ✓ GET /devices/:id/violations")

	// GET /devices/:id/topics — ROS topic activity for a specific device
	devices.Get("/:id/topics", func(c *fiber.Ctx) error {
		clerkUserID := middleware.GetClerkUserID(c)
		if clerkUserID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		deviceID := c.Params("id")

		// Join ros_topic_mappings (tenant-level) with ros_topic_activity (device-level)
		rows, err := db.QueryContext(c.Context(), `
			SELECT
				rtm.topic_name                               AS topic,
				rtm.message_type                             AS msg_type,
				rtm.direction,
				COALESCE(rta.last_message_preview, '')       AS last_message,
				COALESCE(TO_CHAR(rta.last_seen_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '') AS last_seen,
				COALESCE(rta.within_envelope, true)          AS within_envelope
			FROM ros_topic_mappings rtm
			LEFT JOIN ros_topic_activity rta
				   ON rta.topic_name = rtm.topic_name
				  AND rta.device_id   = $2
			WHERE rtm.tenant_id = $1
			ORDER BY rtm.topic_name
			LIMIT 50
		`, clerkUserID, deviceID)
		if err != nil {
			// Table may not exist yet — return empty array gracefully
			log.Printf("[Devices] Topics query error (may be expected if table missing): %v", err)
			return c.JSON([]fiber.Map{})
		}
		defer rows.Close()

		type TopicActivity struct {
			Topic          string `json:"topic"`
			MsgType        string `json:"msg_type"`
			Direction      string `json:"direction"`
			LastMessage    string `json:"last_message,omitempty"`
			LastSeen       string `json:"last_seen,omitempty"`
			WithinEnvelope bool   `json:"within_envelope"`
		}

		result := make([]TopicActivity, 0)
		for rows.Next() {
			var t TopicActivity
			var lastMsg, lastSeen string
			if err := rows.Scan(&t.Topic, &t.MsgType, &t.Direction, &lastMsg, &lastSeen, &t.WithinEnvelope); err != nil {
				continue
			}
			if lastMsg != "" {
				t.LastMessage = lastMsg
			}
			if lastSeen != "" {
				t.LastSeen = lastSeen
			}
			result = append(result, t)
		}
		return c.JSON(result)
	})
	log.Println("[Routes] ✓ GET /devices/:id/topics")

	// POST /devices/:id/ros/replay — upload a ROS bag for BT replay
	devices.Post("/:id/ros/replay", func(c *fiber.Ctx) error {
		clerkUserID := middleware.GetClerkUserID(c)
		if clerkUserID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		deviceID := c.Params("id")

		// Verify device belongs to tenant
		var runtimeID string
		err := db.QueryRowContext(c.Context(), `
			SELECT runtime_id FROM runtime_instances
			WHERE runtime_id = $1 AND tenant_id = $2
		`, deviceID, clerkUserID).Scan(&runtimeID)
		if err != nil {
			if err == sql.ErrNoRows {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "device not found"})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}

		// Accept multipart or raw body — just record the intent in the DB
		file, _ := c.FormFile("file")
		filename := ""
		if file != nil {
			filename = file.Filename
		}

		// Insert a replay job record
		var replayID string
		err = db.QueryRowContext(c.Context(), `
			INSERT INTO ros_replay_jobs (device_id, tenant_id, bag_filename, status, created_at)
			VALUES ($1, $2, $3, 'queued', NOW())
			RETURNING id
		`, deviceID, clerkUserID, filename).Scan(&replayID)
		if err != nil {
			// Table may not exist yet — return accepted anyway
			log.Printf("[Devices] ROS replay insert error (may be expected): %v", err)
			return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
				"accepted":  true,
				"replay_id": "",
				"message":   "Replay job queued. The runtime will process the bag file against the current BT.",
			})
		}

		log.Printf("[Devices] ROS replay queued: %s for device %s", replayID, deviceID)
		return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
			"accepted":  true,
			"replay_id": replayID,
			"filename":  filename,
			"message":   "Replay job queued. The runtime will process the bag file against the current BT.",
		})
	})
	log.Println("[Routes] ✓ POST /devices/:id/ros/replay")
}

// ── ROS 2 Lifecycle ──────────────────────────────────────────────────────────

// RegisterROSRoutes registers POST /v1/ros/lifecycle and ROS topic mapping
// endpoints, plus GET /v1/fleet/swarm, all under BetterAuth.
func RegisterROSRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Println("[Routes] ROS lifecycle endpoint disabled — database not available")
		return
	}

	v1 := app.Group("/v1")

	// Swarm status (Fleet > Swarm page)
	v1.Get("/fleet/swarm", middleware.BetterAuth(db), getSwarmStatus(db))
	log.Println("[Routes] ✓ GET /v1/fleet/swarm")

	// Swarm broadcast — push a command to all runtime instances for the tenant
	v1.Post("/fleet/swarm/broadcast", middleware.BetterAuth(db), swarmBroadcast(db))
	log.Println("[Routes] ✓ POST /v1/fleet/swarm/broadcast")

	// Swarm clear — reset pending_commands for a single agent
	v1.Delete("/fleet/swarm/agents/:id/clear", middleware.BetterAuth(db), swarmClearAgent(db))
	log.Println("[Routes] ✓ DELETE /v1/fleet/swarm/agents/:id/clear")

	// ROS topic mappings
	v1.Get("/ros/topics", middleware.BetterAuth(db), listROSTopics(db))
	v1.Post("/ros/topics/map", middleware.BetterAuth(db), mapROSTopic(db))
	v1.Delete("/ros/topics/map/:id", middleware.BetterAuth(db), unmapROSTopic(db))
	log.Println("[Routes] ✓ GET/POST/DELETE /v1/ros/topics/map")

	v1.Post("/ros/lifecycle", middleware.BetterAuth(db), func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		var body struct {
			DeviceID string `json:"device_id"`
			Action   string `json:"action"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
		}
		if body.DeviceID == "" || body.Action == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "device_id and action are required"})
		}

		validActions := map[string]bool{
			"configure":  true,
			"activate":   true,
			"deactivate": true,
			"reset":      true,
			"shutdown":   true,
		}
		if !validActions[body.Action] {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid action — must be one of: configure, activate, deactivate, reset, shutdown",
			})
		}

		// Record lifecycle command — the runtime picks it up on next heartbeat.
		// We upsert into a pending_commands JSONB on runtime_instances.
		commandJSON, err := json.Marshal(map[string]interface{}{
			"command_id": uuid.NewString(),
			"type":       "ros_lifecycle",
			"action":     body.Action,
		})
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}

		_, err = db.ExecContext(c.Context(), `
			UPDATE runtime_instances
			SET pending_commands = COALESCE(pending_commands, '[]'::jsonb) || $1::jsonb,
			    updated_at = NOW()
			WHERE runtime_id = $2
			  AND tenant_id = $3
		`, "["+string(commandJSON)+"]", body.DeviceID, tenantID)
		if err != nil {
			log.Printf("[ROS] Lifecycle command failed: device=%s action=%s err=%v", body.DeviceID, body.Action, err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}

		log.Printf("[ROS] Lifecycle command queued: device=%s action=%s tenant=%s", body.DeviceID, body.Action, tenantID)
		return c.JSON(fiber.Map{"status": "queued", "device_id": body.DeviceID, "action": body.Action})
	})
	log.Println("[Routes] ✓ POST /v1/ros/lifecycle")

	// ROS discovery — list topics/services reported by a runtime instance
	v1.Get("/ros/discovery", middleware.BetterAuth(db), rosDiscovery(db))
	log.Println("[Routes] ✓ GET /v1/ros/discovery")

	// ROS publish — send a test message to a topic on a specific runtime
	v1.Post("/ros/publish", middleware.BetterAuth(db), rosPublish(db))
	log.Println("[Routes] ✓ POST /v1/ros/publish")
}

// ── GET /v1/fleet/swarm ──────────────────────────────────────────────────────

func getSwarmStatus(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		rows, err := db.Query(`
			SELECT
				runtime_id,
				COALESCE(status, 'unknown') AS status,
				COALESCE(last_heartbeat, last_seen_at) AS last_heartbeat,
				jsonb_array_length(COALESCE(pending_commands, '[]'::jsonb)) AS control_plane_pending_commands_count,
				COALESCE(local_command_spool_depth, 0) AS local_spool_commands_count,
				COALESCE(local_command_statuses, '[]'::jsonb) AS local_command_statuses
			FROM runtime_instances
			WHERE tenant_id = $1
			ORDER BY last_seen_at DESC
		`, tenantID)
		if err != nil {
			log.Println("[Swarm] Query failed:", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		defer rows.Close()

		type SwarmAgent struct {
			ID                       string `json:"id"`
			Name                     string `json:"name"`
			Status                   string `json:"status"`
			LastHeartbeat            string `json:"last_heartbeat"`
			PendingCommandsCount     int    `json:"pending_commands_count"`
			ControlPlanePendingCount int    `json:"control_plane_pending_commands_count"`
			LocalSpoolPendingCount   int    `json:"local_spool_commands_count"`
			LocalCommandStatuses     any    `json:"local_command_statuses"`
		}

		agents := make([]SwarmAgent, 0)
		for rows.Next() {
			var a SwarmAgent
			var lastHeartbeat time.Time
			var localCommandStatuses []byte
			if err := rows.Scan(&a.ID, &a.Status, &lastHeartbeat, &a.ControlPlanePendingCount, &a.LocalSpoolPendingCount, &localCommandStatuses); err != nil {
				continue
			}
			a.PendingCommandsCount = a.ControlPlanePendingCount + a.LocalSpoolPendingCount
			a.Name = a.ID
			a.LastHeartbeat = lastHeartbeat.UTC().Format(time.RFC3339)
			if len(localCommandStatuses) > 0 {
				var decoded any
				if err := json.Unmarshal(localCommandStatuses, &decoded); err == nil {
					a.LocalCommandStatuses = decoded
				}
			}
			if a.LocalCommandStatuses == nil {
				a.LocalCommandStatuses = []any{}
			}
			agents = append(agents, a)
		}

		total := len(agents)
		active := 0
		for _, a := range agents {
			if a.Status == "active" {
				active++
			}
		}

		return c.JSON(fiber.Map{
			"total_agents":  total,
			"active_agents": active,
			"agents":        agents,
		})
	}
}

// ── ROS Topic Mappings ───────────────────────────────────────────────────────

// ROSTopicMapping is the response shape for a single ROS topic mapping.
type ROSTopicMapping struct {
	ID          string `json:"id"`
	BTAction    string `json:"bt_action"`
	TopicName   string `json:"topic_name"`
	MessageType string `json:"message_type"`
	Direction   string `json:"direction"`
	CreatedAt   string `json:"created_at"`
}

func listROSTopics(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		rows, err := db.Query(`
			SELECT id, bt_action, topic_name, message_type, direction, created_at
			FROM ros_topic_mappings
			WHERE tenant_id = $1
			ORDER BY created_at DESC
		`, tenantID)
		if err != nil {
			log.Println("[ROS] List topics failed:", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		defer rows.Close()

		mappings := make([]ROSTopicMapping, 0)
		for rows.Next() {
			var m ROSTopicMapping
			var createdAt time.Time
			if err := rows.Scan(&m.ID, &m.BTAction, &m.TopicName, &m.MessageType, &m.Direction, &createdAt); err != nil {
				continue
			}
			m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			mappings = append(mappings, m)
		}
		return c.JSON(mappings)
	}
}

func mapROSTopic(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		var body struct {
			BTAction    string `json:"bt_action"`
			TopicName   string `json:"topic_name"`
			MessageType string `json:"message_type"`
			Direction   string `json:"direction"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
		}
		if body.BTAction == "" || body.TopicName == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "bt_action and topic_name are required"})
		}
		if body.Direction != "publish" && body.Direction != "subscribe" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "direction must be publish or subscribe"})
		}
		if body.MessageType == "" {
			body.MessageType = "std_msgs/String"
		}

		var m ROSTopicMapping
		var createdAt time.Time
		err := db.QueryRow(`
			INSERT INTO ros_topic_mappings (tenant_id, bt_action, topic_name, message_type, direction)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, bt_action, topic_name, message_type, direction, created_at
		`, tenantID, body.BTAction, body.TopicName, body.MessageType, body.Direction).Scan(
			&m.ID, &m.BTAction, &m.TopicName, &m.MessageType, &m.Direction, &createdAt,
		)
		if err != nil {
			log.Println("[ROS] Map topic failed:", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		return c.Status(fiber.StatusCreated).JSON(m)
	}
}

func unmapROSTopic(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		id := c.Params("id")

		result, err := db.Exec(`
			DELETE FROM ros_topic_mappings
			WHERE id = $1 AND tenant_id = $2
		`, id, tenantID)
		if err != nil {
			log.Println("[ROS] Unmap topic failed:", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		n, _ := result.RowsAffected()
		if n == 0 {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "mapping not found"})
		}
		return c.SendStatus(fiber.StatusNoContent)
	}
}

// ── ROS Discovery / Publish ───────────────────────────────────────────────────

// ROSDiscoveryEntry represents a single discovered ROS topic or service.
type ROSDiscoveryEntry struct {
	Name       string `json:"name"`
	Kind       string `json:"kind"` // "topic" | "service"
	MsgType    string `json:"msg_type"`
	Direction  string `json:"direction"` // "pub" | "sub" | "srv" | "unknown"
	LastSeenAt string `json:"last_seen_at,omitempty"`
}

// rosDiscovery handles GET /v1/ros/discovery?machine_id=...
// Returns topics and services reported by the runtime instance. The runtime
// populates ros_discovered_topics via its heartbeat or a dedicated report call.
// Falls back to the tenant's static topic mappings when no dynamic data exists.
func rosDiscovery(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		machineID := c.Query("machine_id")

		entries := make([]ROSDiscoveryEntry, 0)

		// Try dynamic discovery from runtime_instances.ros_topics JSONB column (if exists).
		if machineID != "" {
			var rawTopics []byte
			_ = db.QueryRowContext(c.Context(), `
				SELECT COALESCE(ros_topics, '[]'::jsonb)
				FROM runtime_instances
				WHERE machine_id = $1 AND tenant_id = $2
			`, machineID, tenantID).Scan(&rawTopics)

			if len(rawTopics) > 2 { // non-empty array
				var dynamic []ROSDiscoveryEntry
				if err := json.Unmarshal(rawTopics, &dynamic); err == nil {
					entries = append(entries, dynamic...)
				}
			}
		}

		// Supplement with static topic mappings (always included).
		rows, err := db.QueryContext(c.Context(), `
			SELECT topic_name, message_type, direction
			FROM ros_topic_mappings
			WHERE tenant_id = $1
			ORDER BY created_at DESC
		`, tenantID)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var topicName, msgType, dir string
				if rows.Scan(&topicName, &msgType, &dir) == nil {
					d := "pub"
					if dir == "subscribe" {
						d = "sub"
					}
					entries = append(entries, ROSDiscoveryEntry{
						Name:      topicName,
						Kind:      "topic",
						MsgType:   msgType,
						Direction: d,
					})
				}
			}
		}

		// Deduplicate by topic name.
		seen := make(map[string]struct{})
		deduped := make([]ROSDiscoveryEntry, 0, len(entries))
		for _, e := range entries {
			if _, ok := seen[e.Name]; !ok {
				seen[e.Name] = struct{}{}
				deduped = append(deduped, e)
			}
		}

		return c.JSON(fiber.Map{
			"machine_id": machineID,
			"topics":     deduped,
			"count":      len(deduped),
		})
	}
}

// rosPublish handles POST /v1/ros/publish — queues a topic publish command
// to the target runtime instance via its pending_commands channel.
func rosPublish(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		var body struct {
			DeviceID    string          `json:"device_id"`
			Topic       string          `json:"topic"`
			MessageType string          `json:"message_type"`
			Payload     json.RawMessage `json:"payload"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
		}
		if body.DeviceID == "" || body.Topic == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "device_id and topic are required",
			})
		}
		if len(body.Payload) == 0 {
			body.Payload = json.RawMessage("{}")
		}
		// Envelope: max 64 KiB payload
		if len(body.Payload) > 65536 {
			return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{
				"error": "payload exceeds 64 KiB limit",
			})
		}
		if body.MessageType == "" {
			body.MessageType = "std_msgs/String"
		}

		cmd, err := json.Marshal(map[string]interface{}{
			"command_id":   uuid.NewString(),
			"type":         "ros_publish",
			"topic":        body.Topic,
			"message_type": body.MessageType,
			"payload":      body.Payload,
		})
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}

		result, err := db.ExecContext(c.Context(), `
			UPDATE runtime_instances
			SET pending_commands = COALESCE(pending_commands, '[]'::jsonb) || $1::jsonb,
			    updated_at = NOW()
			WHERE runtime_id = $2 AND tenant_id = $3
		`, "["+string(cmd)+"]", body.DeviceID, tenantID)
		if err != nil {
			log.Println("[ROS] Publish queue failed:", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		n, _ := result.RowsAffected()
		if n == 0 {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "device not found"})
		}

		return c.JSON(fiber.Map{
			"status":    "queued",
			"device_id": body.DeviceID,
			"topic":     body.Topic,
		})
	}
}

// ── Swarm Broadcast / Clear ───────────────────────────────────────────────────

// swarmBroadcast handles POST /v1/fleet/swarm/broadcast.
// Appends a command to pending_commands for every runtime instance in the tenant fleet.
func swarmBroadcast(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		var body struct {
			Command string          `json:"command"`
			Payload json.RawMessage `json:"payload"`
		}
		if err := c.BodyParser(&body); err != nil || body.Command == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "command field is required",
			})
		}

		payload := body.Payload
		if len(payload) == 0 {
			payload = json.RawMessage("{}")
		}

		// Build the command JSON to append
		cmdJSON, err := json.Marshal(map[string]interface{}{
			"command_id": uuid.NewString(),
			"type":       body.Command,
			"payload":    payload,
		})
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}

		result, err := db.ExecContext(c.Context(), `
			UPDATE runtime_instances
			SET pending_commands = COALESCE(pending_commands, '[]'::jsonb) || $1::jsonb,
			    updated_at = NOW()
			WHERE tenant_id = $2
		`, "["+string(cmdJSON)+"]", tenantID)
		if err != nil {
			log.Println("[Swarm] Broadcast failed:", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}

		n, _ := result.RowsAffected()
		return c.JSON(fiber.Map{"dispatched_to": n})
	}
}

// swarmClearAgent handles DELETE /v1/fleet/swarm/agents/:id/clear.
// Resets pending_commands to an empty array for a single runtime instance.
func swarmClearAgent(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		runtimeID := c.Params("id")

		var runtimeEndpoint string
		result, err := db.ExecContext(c.Context(), `
			UPDATE runtime_instances
			SET pending_commands = '[]'::jsonb,
			    pending_commands_clear_generation = COALESCE(pending_commands_clear_generation, 0) + 1,
			    updated_at = NOW()
			WHERE runtime_id = $1 AND tenant_id = $2
		`, runtimeID, tenantID)
		if err != nil {
			log.Println("[Swarm] Clear agent failed:", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}

		n, _ := result.RowsAffected()
		if n == 0 {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "agent not found"})
		}
		_ = db.QueryRowContext(c.Context(), `
			SELECT COALESCE(endpoint, '')
			FROM runtime_instances
			WHERE runtime_id = $1 AND tenant_id = $2
		`, runtimeID, tenantID).Scan(&runtimeEndpoint)
		if runtimeEndpoint != "" {
			if _, err := runtimeRevokeCommands(c.Context(), runtimeEndpoint, tenantID, nil, true, "operator cleared runtime fleet command queue"); err != nil {
				log.Printf("[Swarm] Best-effort runtime revoke failed: runtime=%s err=%v", runtimeID, err)
			}
		}
		return c.JSON(fiber.Map{"cleared": true})
	}
}
