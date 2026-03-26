package api

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// RegisterAgentRoutes registers the agent blackboard (shared KV) endpoints.
// All endpoints require BetterAuth (Clerk) session.
func RegisterAgentRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Warn().Msg("[Routes] Agent blackboard endpoints disabled — database not available")
		return
	}

	auth := middleware.BetterAuth(db)
	v1 := app.Group("/v1/agents/memory")

	v1.Get("/", auth, listBlackboard(db))
	v1.Get("/:key", auth, getBlackboard(db))
	v1.Put("/:key", auth, putBlackboard(db))
	v1.Delete("/:key", auth, deleteBlackboard(db))

	log.Info().Msg("[Routes] Registered agent blackboard endpoints (/v1/agents/memory)")
}

// blackboardEntry is the response shape for a single KV entry.
type blackboardEntry struct {
	Key        string          `json:"key"`
	Value      json.RawMessage `json:"value"`
	UpdatedAt  string          `json:"updated_at"`
	TTLSeconds *int            `json:"ttl_seconds,omitempty"`
}

// listBlackboard handles GET /v1/agents/memory — lists all KV entries for tenant.
func listBlackboard(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		rows, err := db.QueryContext(c.Context(), `
			SELECT key, value, updated_at, ttl_seconds
			FROM agent_blackboard
			WHERE tenant_id = $1
			  AND (ttl_seconds IS NULL OR updated_at + (ttl_seconds || ' seconds')::interval > NOW())
			ORDER BY updated_at DESC
		`, tenantID)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Blackboard] List failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		defer rows.Close()

		entries := make([]blackboardEntry, 0)
		for rows.Next() {
			var e blackboardEntry
			var updatedAt time.Time
			var ttl sql.NullInt64
			if err := rows.Scan(&e.Key, &e.Value, &updatedAt, &ttl); err != nil {
				continue
			}
			e.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			if ttl.Valid {
				v := int(ttl.Int64)
				e.TTLSeconds = &v
			}
			entries = append(entries, e)
		}
		return c.JSON(fiber.Map{"entries": entries, "count": len(entries)})
	}
}

// getBlackboard handles GET /v1/agents/memory/:key.
func getBlackboard(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		key := c.Params("key")

		var e blackboardEntry
		var updatedAt time.Time
		var ttl sql.NullInt64
		err := db.QueryRowContext(c.Context(), `
			SELECT key, value, updated_at, ttl_seconds
			FROM agent_blackboard
			WHERE tenant_id = $1 AND key = $2
			  AND (ttl_seconds IS NULL OR updated_at + (ttl_seconds || ' seconds')::interval > NOW())
		`, tenantID, key).Scan(&e.Key, &e.Value, &updatedAt, &ttl)

		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "key not found"})
		}
		if err != nil {
			log.Error().Err(err).Str("key", key).Msg("[Blackboard] Get failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		e.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		if ttl.Valid {
			v := int(ttl.Int64)
			e.TTLSeconds = &v
		}
		return c.JSON(e)
	}
}

// putBlackboard handles PUT /v1/agents/memory/:key — upserts a value with optional TTL.
// Body: { "value": <any JSON>, "ttl_seconds": <int optional> }
func putBlackboard(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		key := c.Params("key")

		var body struct {
			Value      json.RawMessage `json:"value"`
			TTLSeconds *int            `json:"ttl_seconds,omitempty"`
		}
		if err := c.BodyParser(&body); err != nil || len(body.Value) == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "value is required"})
		}

		var ttlParam interface{}
		if body.TTLSeconds != nil {
			if *body.TTLSeconds <= 0 {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ttl_seconds must be positive"})
			}
			ttlParam = *body.TTLSeconds
		}

		var updatedAt time.Time
		err := db.QueryRowContext(c.Context(), `
			INSERT INTO agent_blackboard (tenant_id, key, value, ttl_seconds, updated_at)
			VALUES ($1, $2, $3::jsonb, $4, NOW())
			ON CONFLICT (tenant_id, key) DO UPDATE
			  SET value = EXCLUDED.value,
			      ttl_seconds = EXCLUDED.ttl_seconds,
			      updated_at = NOW()
			RETURNING updated_at
		`, tenantID, key, string(body.Value), ttlParam).Scan(&updatedAt)
		if err != nil {
			log.Error().Err(err).Str("key", key).Msg("[Blackboard] Put failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}

		resp := blackboardEntry{
			Key:        key,
			Value:      body.Value,
			UpdatedAt:  updatedAt.UTC().Format(time.RFC3339),
			TTLSeconds: body.TTLSeconds,
		}
		return c.Status(fiber.StatusOK).JSON(resp)
	}
}

// deleteBlackboard handles DELETE /v1/agents/memory/:key.
func deleteBlackboard(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		key := c.Params("key")

		result, err := db.ExecContext(c.Context(), `
			DELETE FROM agent_blackboard WHERE tenant_id = $1 AND key = $2
		`, tenantID, key)
		if err != nil {
			log.Error().Err(err).Str("key", key).Msg("[Blackboard] Delete failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		n, _ := result.RowsAffected()
		if n == 0 {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "key not found"})
		}
		return c.JSON(fiber.Map{"deleted": true, "key": key})
	}
}

