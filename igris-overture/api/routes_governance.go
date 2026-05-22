// Package api — execution governance routes.
//
// These endpoints expose the tenant-wide execution trust surface that backs the
// console Overview page: aggregate verification, policy, recovery, and boundary
// counts plus a recent critical-event stream. Every value is a safe summary —
// counts, IDs, statuses, and operator reasons only. No secrets, resume tokens,
// signatures, or raw payloads are returned here.
package api

import (
	"database/sql"
	"net/http"

	"github.com/gofiber/fiber/v2"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// RegisterGovernanceRoutes wires the execution governance summary endpoints.
//
//	GET /v1/execution/governance/summary — tenant-wide execution trust summary
func RegisterGovernanceRoutes(app *fiber.App, db *sql.DB) {
	store := coordinator.NewCheckpointStore(db)

	g := app.Group("/v1/execution/governance")
	g.Use(middleware.BetterAuth(db))

	g.Get("/summary", func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}

		summary, err := store.GovernanceSummaryReport(tenantID, 15)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(summary)
	})
}
