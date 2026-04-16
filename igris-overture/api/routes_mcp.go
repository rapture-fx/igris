package api

import (
	"bytes"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/gofiber/fiber/v2"
)

// RegisterMcpRoutes registers MCP proxy routes that forward JSON-RPC requests
// to the Igris Runtime's MCP server. Authentication is required when
// multi-tenancy is enabled.
func RegisterMcpRoutes(app *fiber.App, _ *middleware.TenantAuth) {
	log.Println("[Routes] Registering MCP proxy endpoints...")

	runtimeURL := os.Getenv("RUNTIME_URL")
	if runtimeURL == "" {
		runtimeURL = "http://localhost:8080"
	}

	mcpHandler := &mcpProxyHandler{
		runtimeURL: runtimeURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}

	enableMultiTenancy := os.Getenv("ENABLE_MULTI_TENANCY") == "true"

	if enableMultiTenancy {
		app.Post("/v1/mcp", mcpHandler.handleMcp)
		app.Post("/v1/mcp/stream", mcpHandler.handleMcpStream)
		log.Println("[Routes] ✓ POST /v1/mcp (CLERK AUTH REQUIRED)")
		log.Println("[Routes] ✓ POST /v1/mcp/stream (CLERK AUTH REQUIRED)")
	} else {
		app.Post("/v1/mcp", mcpHandler.handleMcp)
		app.Post("/v1/mcp/stream", mcpHandler.handleMcpStream)
		log.Println("[Routes] ✓ POST /v1/mcp")
		log.Println("[Routes] ✓ POST /v1/mcp/stream")
	}

	log.Println("[Routes] MCP proxy routes registered successfully")
}

type mcpProxyHandler struct {
	runtimeURL string
	httpClient *http.Client
}

// handleMcp forwards a JSON-RPC request to the runtime's /mcp endpoint.
func (h *mcpProxyHandler) handleMcp(c *fiber.Ctx) error {
	return h.proxyToRuntime(c, "/mcp")
}

// handleMcpStream forwards a JSON-RPC request to the runtime's /mcp/stream SSE endpoint.
func (h *mcpProxyHandler) handleMcpStream(c *fiber.Ctx) error {
	return h.proxyToRuntime(c, "/mcp/stream")
}

func (h *mcpProxyHandler) proxyToRuntime(c *fiber.Ctx, path string) error {
	targetURL := h.runtimeURL + path

	req, err := http.NewRequestWithContext(
		c.UserContext(),
		http.MethodPost,
		targetURL,
		bytes.NewReader(c.Body()),
	)
	if err != nil {
		return c.Status(500).JSON(mcpProxyErrorResponse(
			"overture",
			"mcp_proxy_request_build_failed",
			"Failed to create proxy request",
			err.Error(),
		))
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return c.Status(502).JSON(mcpProxyErrorResponse(
			"runtime",
			"runtime_unreachable",
			"Runtime unreachable",
			err.Error(),
		))
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(502).JSON(mcpProxyErrorResponse(
			"runtime",
			"runtime_response_read_failed",
			"Failed to read runtime response",
			err.Error(),
		))
	}

	c.Set("Content-Type", resp.Header.Get("Content-Type"))
	return c.Status(resp.StatusCode).Send(body)
}

func mcpProxyErrorResponse(source, failureType, message, detail string) fiber.Map {
	return fiber.Map{
		"jsonrpc": "2.0",
		"id":      nil,
		"error": fiber.Map{
			"code":    -32603,
			"message": message,
		},
		"failure": models.BuildSimpleFailureResponse(source, "mcp_proxy", failureType, message, detail),
	}
}
