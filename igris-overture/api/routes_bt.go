// Package api provides Behavior Tree (BT) editor endpoints.
// Pages served: BT Templates (public) and BT Definitions (tenant-scoped CRUD).
package api

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// BTDefinition is the response shape for a single behavior-tree definition.
type BTDefinition struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Nodes       json.RawMessage `json:"nodes"`
	Edges       json.RawMessage `json:"edges"`
	CreatedAt   string          `json:"created_at"`
	UpdatedAt   string          `json:"updated_at"`
}

// RegisterBTRoutes registers the /v1/bt/* endpoints.
func RegisterBTRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Warn().Msg("[Routes] BT endpoints disabled — database not available")
		return
	}

	v1 := app.Group("/v1/bt")
	v1.Get("/templates", getBTTemplates)
	v1.Get("/definitions", middleware.BetterAuth(db), listBTDefinitions(db))
	v1.Get("/definitions/:id", middleware.BetterAuth(db), getBTDefinition(db))
	v1.Post("/definitions", middleware.BetterAuth(db), saveBTDefinition(db))
	v1.Delete("/definitions/:id", middleware.BetterAuth(db), deleteBTDefinition(db))

	log.Info().Msg("[Routes] Registered BT endpoints (/v1/bt/templates, /v1/bt/definitions, /v1/bt/definitions/:id)")
}

// ── GET /v1/bt/templates ────────────────────────────────────────────────────

func getBTTemplates(c *fiber.Ctx) error {
	templates := []fiber.Map{
		{
			"id":          "tpl-patrol",
			"name":        "Patrol Loop",
			"description": "Repeating patrol with obstacle avoidance",
			"nodes": json.RawMessage(`[
				{"id":"n1","type":"sequence","label":"Root Sequence","x":300,"y":50},
				{"id":"n2","type":"condition","label":"Path Clear?","x":150,"y":150},
				{"id":"n3","type":"action","label":"Move Forward","x":300,"y":150},
				{"id":"n4","type":"action","label":"Avoid Obstacle","x":450,"y":150}
			]`),
			"edges": json.RawMessage(`[
				{"id":"e1","source":"n1","target":"n2"},
				{"id":"e2","source":"n1","target":"n3"},
				{"id":"e3","source":"n1","target":"n4"}
			]`),
		},
		{
			"id":          "tpl-navigate",
			"name":        "Navigate to Goal",
			"description": "Navigate with fallback retry",
			"nodes": json.RawMessage(`[
				{"id":"n1","type":"selector","label":"Root Selector","x":300,"y":50},
				{"id":"n2","type":"sequence","label":"Navigate Sequence","x":200,"y":150},
				{"id":"n3","type":"action","label":"Compute Path","x":100,"y":250},
				{"id":"n4","type":"action","label":"Follow Path","x":300,"y":250},
				{"id":"n5","type":"action","label":"Retry Navigation","x":500,"y":150}
			]`),
			"edges": json.RawMessage(`[
				{"id":"e1","source":"n1","target":"n2"},
				{"id":"e2","source":"n1","target":"n5"},
				{"id":"e3","source":"n2","target":"n3"},
				{"id":"e4","source":"n2","target":"n4"}
			]`),
		},
		{
			"id":          "tpl-monitor",
			"name":        "Health Monitor",
			"description": "Continuous system health check",
			"nodes": json.RawMessage(`[
				{"id":"n1","type":"sequence","label":"Monitor Sequence","x":300,"y":50},
				{"id":"n2","type":"condition","label":"Battery OK?","x":150,"y":150},
				{"id":"n3","type":"condition","label":"Sensors OK?","x":300,"y":150},
				{"id":"n4","type":"action","label":"Report Status","x":450,"y":150}
			]`),
			"edges": json.RawMessage(`[
				{"id":"e1","source":"n1","target":"n2"},
				{"id":"e2","source":"n1","target":"n3"},
				{"id":"e3","source":"n1","target":"n4"}
			]`),
		},
		{
			"id":          "tpl-task-alloc",
			"name":        "Task Allocation",
			"description": "Parallel task allocation selector",
			"nodes": json.RawMessage(`[
				{"id":"n1","type":"parallel","label":"Parallel Root","x":300,"y":50},
				{"id":"n2","type":"sequence","label":"Task A","x":100,"y":150},
				{"id":"n3","type":"sequence","label":"Task B","x":300,"y":150},
				{"id":"n4","type":"action","label":"Execute A","x":100,"y":250},
				{"id":"n5","type":"action","label":"Execute B","x":300,"y":250}
			]`),
			"edges": json.RawMessage(`[
				{"id":"e1","source":"n1","target":"n2"},
				{"id":"e2","source":"n1","target":"n3"},
				{"id":"e3","source":"n2","target":"n4"},
				{"id":"e4","source":"n3","target":"n5"}
			]`),
		},
	}
	return c.JSON(templates)
}

// ── GET /v1/bt/definitions/:id ──────────────────────────────────────────────

func getBTDefinition(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		id := c.Params("id")

		var def BTDefinition
		var createdAt, updatedAt time.Time
		err := db.QueryRow(`
			SELECT id, name, description, nodes, edges, created_at, updated_at
			FROM bt_definitions
			WHERE id = $1 AND tenant_id = $2
		`, id, tenantID).Scan(
			&def.ID, &def.Name, &def.Description, &def.Nodes, &def.Edges,
			&createdAt, &updatedAt,
		)
		if err == sql.ErrNoRows {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "definition not found"})
		}
		if err != nil {
			log.Error().Err(err).Str("id", id).Msg("[BT] Failed to get definition")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		def.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		def.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		return c.JSON(def)
	}
}

// ── GET /v1/bt/definitions ───────────────────────────────────────────────────

func listBTDefinitions(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		rows, err := db.Query(`
			SELECT id, name, description, created_at, updated_at
			FROM bt_definitions
			WHERE tenant_id = $1
			ORDER BY updated_at DESC
			LIMIT 50
		`, tenantID)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[BT] Failed to list definitions")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		defer rows.Close()

		type ListItem struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			Description string `json:"description"`
			CreatedAt   string `json:"created_at"`
			UpdatedAt   string `json:"updated_at"`
		}

		items := make([]ListItem, 0)
		for rows.Next() {
			var item ListItem
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&item.ID, &item.Name, &item.Description, &createdAt, &updatedAt); err != nil {
				continue
			}
			item.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			items = append(items, item)
		}
		return c.JSON(items)
	}
}

// ── POST /v1/bt/definitions ──────────────────────────────────────────────────

func saveBTDefinition(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		var body struct {
			Name        string          `json:"name"`
			Description string          `json:"description"`
			Nodes       json.RawMessage `json:"nodes"`
			Edges       json.RawMessage `json:"edges"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
		}
		if body.Name == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
		}
		if len(body.Nodes) == 0 {
			body.Nodes = json.RawMessage(`[]`)
		}
		if len(body.Edges) == 0 {
			body.Edges = json.RawMessage(`[]`)
		}

		var def BTDefinition
		var createdAt, updatedAt time.Time

		err := db.QueryRow(`
			INSERT INTO bt_definitions (tenant_id, name, description, nodes, edges)
			VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
			ON CONFLICT (tenant_id, name) DO UPDATE
				SET nodes       = EXCLUDED.nodes,
				    edges       = EXCLUDED.edges,
				    description = EXCLUDED.description,
				    updated_at  = NOW()
			RETURNING id, name, description, nodes, edges, created_at, updated_at
		`, tenantID, body.Name, body.Description, body.Nodes, body.Edges).Scan(
			&def.ID, &def.Name, &def.Description, &def.Nodes, &def.Edges,
			&createdAt, &updatedAt,
		)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[BT] Failed to save definition")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		def.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		def.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		return c.Status(fiber.StatusOK).JSON(def)
	}
}

// ── DELETE /v1/bt/definitions/:id ───────────────────────────────────────────

func deleteBTDefinition(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		id := c.Params("id")

		result, err := db.Exec(`
			DELETE FROM bt_definitions
			WHERE id = $1 AND tenant_id = $2
		`, id, tenantID)
		if err != nil {
			log.Error().Err(err).Str("id", id).Msg("[BT] Failed to delete definition")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		n, _ := result.RowsAffected()
		if n == 0 {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "definition not found"})
		}
		return c.SendStatus(fiber.StatusNoContent)
	}
}
