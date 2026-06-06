package api

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"database/sql/driver"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
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
	if purpose == "runtime_heartbeat.v2" {
		message := strings.Join([]string{
			purpose,
			req["machine_id"].(string),
			int64String(req["timestamp_unix_ms"].(int64)),
			btHash,
			strconv.FormatUint(uint64Value(req["local_command_spool_depth"]), 10),
			strconv.FormatUint(uint64Value(req["local_command_clear_generation"]), 10),
		}, ":")
		return base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, []byte(message)))
	}
	if purpose == "runtime_heartbeat.v3" {
		statusesJSON, err := json.Marshal(req["local_command_statuses"])
		require.NoError(t, err)
		statusHash := sha256.Sum256(statusesJSON)
		message := strings.Join([]string{
			purpose,
			req["machine_id"].(string),
			int64String(req["timestamp_unix_ms"].(int64)),
			btHash,
			strconv.FormatUint(uint64Value(req["local_command_spool_depth"]), 10),
			strconv.FormatUint(uint64Value(req["local_command_clear_generation"]), 10),
			hex.EncodeToString(statusHash[:]),
		}, ":")
		return base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, []byte(message)))
	}
	message := strings.Join([]string{
		purpose,
		req["machine_id"].(string),
		int64String(req["timestamp_unix_ms"].(int64)),
		btHash,
	}, ":")
	return base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, []byte(message)))
}

func TestRuntimeHeartbeatAcceptsCommandStatusesV3(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"public_key_ed25519"},
			rows:    [][]driver.Value{{hex.EncodeToString(publicKey)}},
		},
		{
			columns: []string{"jsonb_array_length", "coalesce"},
			rows:    [][]driver.Value{{int64(0), int64(1)}},
		},
	}, queuedRouteExecExpectation{rowsAffected: 1})

	handler := NewRuntimeHandler(db, nil)
	app := fiber.New()
	app.Post("/heartbeat", func(c *fiber.Ctx) error {
		c.Locals("tenant_id", "tenant-1")
		return handler.Heartbeat(c)
	})

	body := map[string]any{
		"machine_id":                     "dev-machine-1",
		"timestamp_unix_ms":              time.Now().UnixMilli(),
		"local_command_spool_depth":      uint64(1),
		"local_command_clear_generation": uint64(12),
		"local_command_statuses": []map[string]any{
			{
				"delivery_key":       "cmd-1",
				"command_type":       "ros_publish",
				"state":              "owned",
				"updated_at_unix_ms": uint64(1700000000000),
			},
		},
	}
	body["signature"] = signRuntimeMachineRequest(t, privateKey, "runtime_heartbeat.v3", body)
	payload, err := json.Marshal(body)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/heartbeat", strings.NewReader(string(payload)))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func signRuntimeCommandFetchRequest(t *testing.T, privateKey ed25519.PrivateKey, req map[string]any) string {
	t.Helper()
	message := strings.Join([]string{
		"runtime_commands.v1",
		req["machine_id"].(string),
		int64String(req["timestamp_unix_ms"].(int64)),
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
		strconv.FormatUint(uint64Value(req["expected_clear_generation"]), 10),
	}, ":")
	return base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, []byte(message)))
}

func int64String(value int64) string {
	return strconv.FormatInt(value, 10)
}

func uint64Value(value any) uint64 {
	switch v := value.(type) {
	case uint64:
		return v
	case int:
		return uint64(v)
	case int64:
		return uint64(v)
	case float64:
		return uint64(v)
	default:
		return 0
	}
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
		"endpoint":           " http://runtime.test/ ",
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

func TestRuntimeRegisterRejectsInvalidEndpoint(t *testing.T) {
	for _, endpoint := range []string{"", "   ", "runtime.test", "ftp://runtime.test", "://bad", "http://user:pass@runtime.test"} {
		t.Run(endpoint, func(t *testing.T) {
			publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
			require.NoError(t, err)

			db, queued := newQueuedRouteDB(t, nil)
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
				"endpoint":           endpoint,
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
			require.Equal(t, http.StatusBadRequest, resp.StatusCode)

			raw, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			require.Contains(t, string(raw), "invalid_runtime_endpoint")
			if strings.TrimSpace(endpoint) != "" {
				require.NotContains(t, string(raw), endpoint)
			}
			require.Equal(t, 0, queued.remainingQueries())
			require.Equal(t, 0, queued.remainingExecs())
		})
	}
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

func TestRuntimeHeartbeatCountsLocalSpoolAsPending(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"public_key_ed25519"},
			rows:    [][]driver.Value{{hex.EncodeToString(publicKey)}},
		},
		{
			columns: []string{"jsonb_array_length", "coalesce"},
			rows:    [][]driver.Value{{int64(0), int64(2)}},
		},
	}, queuedRouteExecExpectation{rowsAffected: 1})

	handler := NewRuntimeHandler(db, nil)
	app := fiber.New()
	app.Post("/heartbeat", func(c *fiber.Ctx) error {
		c.Locals("tenant_id", "tenant-1")
		return handler.Heartbeat(c)
	})

	body := map[string]any{
		"machine_id":                     "dev-machine-1",
		"timestamp_unix_ms":              time.Now().UnixMilli(),
		"local_command_spool_depth":      uint64(2),
		"local_command_clear_generation": uint64(9),
	}
	body["signature"] = signRuntimeMachineRequest(t, privateKey, "runtime_heartbeat.v2", body)
	payload, err := json.Marshal(body)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/heartbeat", strings.NewReader(string(payload)))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var responseBody map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&responseBody))
	require.Equal(t, true, responseBody["has_pending_commands"])
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

func TestRuntimeGetPendingCommandsDecoratesDeliveryKeys(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"public_key_ed25519"},
			rows:    [][]driver.Value{{hex.EncodeToString(publicKey)}},
		},
		{
			columns: []string{"pending_commands", "pending_commands_clear_generation"},
			rows: [][]driver.Value{{
				[]byte(`[{"command_id":"cmd-1","type":"ros_publish","topic":"/igris/prompt","message_type":"std_msgs/String","payload":{"data":"hello"}}]`),
				int64(7),
			}},
		},
	})

	handler := NewRuntimeHandler(db, nil)
	app := fiber.New()
	app.Get("/commands", func(c *fiber.Ctx) error {
		c.Locals("tenant_id", "tenant-1")
		return handler.GetPendingCommands(c)
	})

	params := map[string]any{
		"machine_id":        "dev-machine-1",
		"timestamp_unix_ms": time.Now().UnixMilli(),
	}
	signature := signRuntimeCommandFetchRequest(t, privateKey, params)
	query := url.Values{}
	query.Set("machine_id", "dev-machine-1")
	query.Set("timestamp_unix_ms", int64String(params["timestamp_unix_ms"].(int64)))
	query.Set("signature", signature)
	req := httptest.NewRequest(http.MethodGet, "/commands?"+query.Encode(), nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body struct {
		Commands        []map[string]any `json:"commands"`
		ClearGeneration int64            `json:"clear_generation"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Len(t, body.Commands, 1)
	require.Equal(t, "cmd-1", body.Commands[0]["delivery_key"])
	require.Equal(t, int64(7), body.ClearGeneration)
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

func TestRuntimeAckPendingCommandsRemovesDeliveryKeys(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	db, queued := newQueuedRouteDB(
		t,
		[]queuedRouteQueryExpectation{
			{
				columns: []string{"public_key_ed25519"},
				rows:    [][]driver.Value{{hex.EncodeToString(publicKey)}},
			},
			{
				columns: []string{"pending_commands", "pending_commands_clear_generation"},
				rows: [][]driver.Value{{
					[]byte(`[{"command_id":"cmd-1","type":"ros_publish"},{"command_id":"cmd-2","type":"config_push"}]`),
					int64(0),
				}},
			},
		},
		queuedRouteExecExpectation{rowsAffected: 1},
	)

	handler := NewRuntimeHandler(db, nil)
	app := fiber.New()
	app.Post("/commands/ack", func(c *fiber.Ctx) error {
		c.Locals("tenant_id", "tenant-1")
		return handler.AckPendingCommands(c)
	})

	body := map[string]any{
		"machine_id":                "dev-machine-1",
		"delivery_keys":             []string{"cmd-1"},
		"expected_clear_generation": uint64(0),
		"timestamp_unix_ms":         time.Now().UnixMilli(),
	}
	body["signature"] = signRuntimeCommandAckRequest(t, privateKey, body)
	payload, err := json.Marshal(body)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/commands/ack", strings.NewReader(string(payload)))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var responseBody map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&responseBody))
	require.Equal(t, float64(1), responseBody["acked_count"])
	require.Equal(t, true, responseBody["ownership_granted"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestRuntimeAckPendingCommandsRejectsGenerationMismatch(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	require.NoError(t, err)

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"public_key_ed25519"},
			rows:    [][]driver.Value{{hex.EncodeToString(publicKey)}},
		},
		{
			columns: []string{"pending_commands", "pending_commands_clear_generation"},
			rows: [][]driver.Value{{
				[]byte(`[{"command_id":"cmd-1","type":"ros_publish"}]`),
				int64(8),
			}},
		},
	})

	handler := NewRuntimeHandler(db, nil)
	app := fiber.New()
	app.Post("/commands/ack", func(c *fiber.Ctx) error {
		c.Locals("tenant_id", "tenant-1")
		return handler.AckPendingCommands(c)
	})

	body := map[string]any{
		"machine_id":                "dev-machine-1",
		"delivery_keys":             []string{"cmd-1"},
		"expected_clear_generation": uint64(7),
		"timestamp_unix_ms":         time.Now().UnixMilli(),
	}
	body["signature"] = signRuntimeCommandAckRequest(t, privateKey, body)
	payload, err := json.Marshal(body)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/commands/ack", strings.NewReader(string(payload)))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var responseBody map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&responseBody))
	require.Equal(t, false, responseBody["ownership_granted"])
	require.Equal(t, float64(8), responseBody["clear_generation"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}
