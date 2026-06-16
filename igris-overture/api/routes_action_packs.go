package api

import (
	"database/sql"
	"net/http"

	"github.com/gofiber/fiber/v2"

	"github.com/Igris-inertial/system/igris-overture/actionpack"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// RegisterActionPackRoutes exposes built-in Action Pack listing and install.
// Install creates registered actions only — it never submits raw tasks.
func RegisterActionPackRoutes(app *fiber.App, db *sql.DB) {
	v1 := app.Group("/v1/action-packs")
	v1.Use(middleware.BetterAuth(db))

	v1.Get("", handleActionPackList())
	v1.Post("/:name/install", handleActionPackInstall(db))
}

func handleActionPackList() fiber.Handler {
	return func(c *fiber.Ctx) error {
		packs := actionpack.ListBuiltin()
		summaries := make([]actionpack.PackSummary, 0, len(packs))
		for _, pack := range packs {
			summaries = append(summaries, actionpack.Summarize(pack))
		}
		return c.JSON(fiber.Map{"packs": summaries})
	}
}

func handleActionPackInstall(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		pack, ok := actionpack.GetBuiltin(c.Params("name"))
		if !ok {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{
				"error":   "pack_not_found",
				"message": "No built-in Action Pack with that name.",
			})
		}
		result, err := actionpack.Install(c.Context(), actionpack.SQLActionCreator{DB: db}, tenantID, pack)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "invalid_action_pack",
				"message": err.Error(),
			})
		}
		return c.Status(http.StatusCreated).JSON(result)
	}
}