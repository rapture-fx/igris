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
	"strconv"

	"github.com/gofiber/fiber/v2"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// RegisterGovernanceRoutes wires the execution governance summary endpoints.
//
//	GET /v1/execution/governance/summary — tenant-wide execution trust summary
//	GET /v1/execution/governance/policy-decisions — action policy decisions
//	GET /v1/execution/governance/recovery-events — task recovery events
//	GET /v1/execution/governance/handoff-events — runtime handoff events
//	GET /v1/execution/governance/boundaries — execution runtime boundaries
//	GET /v1/execution/governance/boundary-violations — boundary violations
//	GET /v1/execution/governance/verification-results — proof verification results
//	GET /v1/execution/governance/runtimes — runtime operations summaries
//	GET /v1/execution/governance/runtimes/:runtime_id — one runtime operations summary
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

	g.Get("/policy-decisions", func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		result, err := store.ListActionPolicyDecisions(tenantID, governanceListOptions(c))
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(result)
	})

	g.Get("/recovery-events", func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		result, err := store.ListTaskRecoveryEvents(tenantID, governanceListOptions(c))
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(result)
	})

	g.Get("/handoff-events", func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		result, err := store.ListRuntimeHandoffEvents(tenantID, governanceListOptions(c))
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(result)
	})

	g.Get("/boundaries", func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		result, err := store.ListExecutionBoundaries(tenantID, governanceListOptions(c))
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(result)
	})

	g.Get("/boundary-violations", func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		result, err := store.ListBoundaryViolations(tenantID, governanceListOptions(c))
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(result)
	})

	g.Get("/verification-results", func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		result, err := store.ListVerificationResults(tenantID, governanceListOptions(c))
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(result)
	})

	g.Get("/runtimes", func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		result, err := store.ListRuntimeOperations(tenantID, governanceListOptions(c))
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(result)
	})

	g.Get("/runtimes/:runtime_id", func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		opts := governanceListOptions(c)
		opts.RuntimeID = c.Params("runtime_id")
		opts.Limit = 1
		result, err := store.ListRuntimeOperations(tenantID, opts)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		if len(result.Items) == 0 {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "runtime_not_found"})
		}
		return c.JSON(result.Items[0])
	})
}

func governanceListOptions(c *fiber.Ctx) coordinator.GovernanceListOptions {
	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	opts := coordinator.GovernanceListOptions{
		Limit:           limit,
		Offset:          offset,
		Sort:            c.Query("sort", "desc"),
		TaskID:          c.Query("task_id"),
		AgentID:         c.Query("agent_id"),
		RuntimeID:       c.Query("runtime_id"),
		Action:          c.Query("action"),
		Decision:        c.Query("decision"),
		RiskLevel:       c.Query("risk_level"),
		ReplayClass:     c.Query("replay_class"),
		EventType:       c.Query("event_type"),
		HandoffDecision: c.Query("handoff_decision", c.Query("decision")),
		Severity:        c.Query("severity"),
		Status:          c.Query("status"),
		ExecutionID:     c.Query("execution_id"),
		TimeRange:       c.Query("range"),
	}
	if value := c.Query("irreversible"); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			opts.Irreversible = &parsed
		}
	}
	if value := c.Query("human_gated"); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			opts.HumanGated = &parsed
		}
	}
	return opts
}
