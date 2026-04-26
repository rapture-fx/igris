package api

import (
	"crypto/ed25519"
	"crypto/rand"
	"database/sql/driver"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"
)

func signRuntimeRegisterRequest(t *testing.T, privateKey ed25519.PrivateKey, req map[string]any) string {
	t.Helper()
	message := strings.Join([]string{
		"runtime_register.v1",
		req["machine_id"].(string),
		req["hostname"].(string),
		req["platform"].(string),
		req["runtime_version"].(string),
		req["public_key_ed25519"].(string),
		runtimeRequestStringValue(req["endpoint"]),
		int64String(req["timestamp_unix_ms"].(int64)),
	}, ":")
	return base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, []byte(message)))
}

func signRuntimeMachineRequest(t *testing.T, privateKey ed25519.PrivateKey, purpose string, req map[string]any) string {
	t.Helper()
	btHash := ""
	if raw, ok := req["bt_state"]; ok {
		encoded, err := json.Marshal(raw)
		require.NoError(t, err)
		btHash = runtimeBtStateHash(encoded)
	}
	message := strings.Join([]string{
		purpose,
		req["machine_id"].(string),
		int64String(req["timestamp_unix_ms"].(int64)),
		btHash,
	}, ":")
	return base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, []byte(message)))
}

func signRuntimeCommandAckRequest(t *testing.T, privateKey ed25519.PrivateKey, req map[string]any) string {
	t.Helper()
	keys, ok := req["delivery_keys"].([]string)
	require.True(t, ok)
	sorted := append([]string(nil), keys...)
	sort.Strings(sorted)
	message := strings.Join([]string{
		"runtime_commands_ack.v1",
		req["machine_id"].(string),
		int64String(req["timestamp_unix_ms"].(int64)),
		strings.Join(sorted, ","),
	}, ":")
	return base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, []byte(message)))
}

func int64String(value int64) string {
	return strconv.FormatInt(value, 10)
}

func runtimeRequestStringValue(value any) string {
	if value == nil {
		return ""
	}
	if s, ok := value.(string); ok {
		return s
	}
	return ""
}

func TestRuntimeRegisterPersistsVerifiedPublicKey(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"runtime_id", "public_key_ed25519"},
			rows:    [][]driver.Value{},
		},
		{
			columns: []string{"runtime_id"},
			rows:    [][]driver.Value{{"runtime-1"}},
		},
	})

	handler := NewRuntimeHandler(db, nil)
	app := fiber.New()
	app.Post("/register", func(c *fiber.Ctx) error {
		c.Locals("tenant_id", "tenant-1")
		return handler.Register(c)
	})

	body := map[string]any{
		"machine_id":         "dev-machine-1",
		"hostname":           "host-a",
		"platform":           "linux-amd64",
		"runtime_version":    "1.8.0",
		"public_key_ed25519": hex.EncodeToString(publicKey),
		"timestamp_unix_ms":  time.Now().UnixMilli(),
	}
	body["signature"] = signRuntimeRegisterRequest(t, privateKey, body)
	payload, err := json.Marshal(body)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/register", strings.NewReader(string(payload)))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestRuntimeHeartbeatRejectsInvalidSignature(t *testing.T) {
	publicKey, _, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{"public_key_ed25519"},
		rows:    [][]driver.Value{{hex.EncodeToString(publicKey)}},
	}})

	handler := NewRuntimeHandler(db, nil)
	app := fiber.New()
	app.Post("/heartbeat", func(c *fiber.Ctx) error {
		c.Locals("tenant_id", "tenant-1")
		return handler.Heartbeat(c)
	})

	reqBody := `{"machine_id":"dev-machine-1","timestamp_unix_ms":` + int64String(time.Now().UnixMilli()) + `,"signature":"invalid"}`
	req := httptest.NewRequest(http.MethodPost, "/heartbeat", strings.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestRuntimeGetPendingCommandsRejectsUnsignedRequest(t *testing.T) {
	publicKey, _, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{"public_key_ed25519"},
		rows:    [][]driver.Value{{hex.EncodeToString(publicKey)}},
	}})

	handler := NewRuntimeHandler(db, nil)
	app := fiber.New()
	app.Get("/commands", func(c *fiber.Ctx) error {
		c.Locals("tenant_id", "tenant-1")
		return handler.GetPendingCommands(c)
	})

	url := "/commands?machine_id=dev-machine-1&timestamp_unix_ms=" + int64String(time.Now().UnixMilli()) + "&signature=invalid"
	req := httptest.NewRequest(http.MethodGet, url, nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestRuntimeAckPendingCommandsRejectsUnsignedRequest(t *testing.T) {
	publicKey, _, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{"public_key_ed25519"},
		rows:    [][]driver.Value{{hex.EncodeToString(publicKey)}},
	}})

	handler := NewRuntimeHandler(db, nil)
	app := fiber.New()
	app.Post("/commands/ack", func(c *fiber.Ctx) error {
		c.Locals("tenant_id", "tenant-1")
		return handler.AckPendingCommands(c)
	})

	body := `{"machine_id":"dev-machine-1","delivery_keys":["cmd-1"],"timestamp_unix_ms":` + int64String(time.Now().UnixMilli()) + `,"signature":"invalid"}`
	req := httptest.NewRequest(http.MethodPost, "/commands/ack", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}
