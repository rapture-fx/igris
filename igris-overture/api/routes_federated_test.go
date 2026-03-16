package api

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// helper: build a test app with federated routes, bypassing BetterAuth
func newFederatedTestApp() *fiber.App {
	app := fiber.New()
	// Register handlers directly (nil DB → demo data path)
	app.Get("/v1/federated/status", handleFederatedStatus(nil))
	app.Get("/v1/federated/participants", handleFederatedParticipants(nil))
	app.Get("/v1/federated/rounds", handleFederatedRounds(nil))
	app.Post("/v1/federated/rounds/start", handleFederatedStartRound(nil))
	app.Get("/v1/federated/config", handleFederatedGetConfig(nil))
	app.Put("/v1/federated/config", handleFederatedUpdateConfig(nil))
	return app
}

func TestFederatedStatus_ReturnsDemo(t *testing.T) {
	app := newFederatedTestApp()

	req := httptest.NewRequest("GET", "/v1/federated/status", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var status FederatedStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if status.TotalRounds == 0 {
		t.Error("expected non-zero TotalRounds in demo data")
	}
	if status.Participants == 0 {
		t.Error("expected non-zero Participants in demo data")
	}
}

func TestFederatedParticipants_ReturnsDemo(t *testing.T) {
	app := newFederatedTestApp()

	req := httptest.NewRequest("GET", "/v1/federated/participants", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var participants []FederatedParticipant
	if err := json.NewDecoder(resp.Body).Decode(&participants); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if len(participants) == 0 {
		t.Error("expected at least one demo participant")
	}
	for _, p := range participants {
		if p.ID == "" {
			t.Error("participant missing ID")
		}
		if p.Hostname == "" {
			t.Error("participant missing Hostname")
		}
		if p.Status == "" {
			t.Error("participant missing Status")
		}
	}
}

func TestFederatedRounds_ReturnsDemo(t *testing.T) {
	app := newFederatedTestApp()

	req := httptest.NewRequest("GET", "/v1/federated/rounds", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var rounds []FederatedRound
	if err := json.NewDecoder(resp.Body).Decode(&rounds); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if len(rounds) == 0 {
		t.Error("expected at least one demo round")
	}
	// Latest round (index 0) should be running
	if rounds[0].Status != "running" {
		t.Errorf("expected first demo round status 'running', got %q", rounds[0].Status)
	}
}

func TestFederatedStartRound_DemoReturnsSuccess(t *testing.T) {
	app := newFederatedTestApp()

	req := httptest.NewRequest("POST", "/v1/federated/rounds/start", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if body["success"] != true {
		t.Errorf("expected success=true, got %v", body["success"])
	}
}

func TestFederatedGetConfig_ReturnsDefaults(t *testing.T) {
	app := newFederatedTestApp()

	req := httptest.NewRequest("GET", "/v1/federated/config", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var cfg FederatedConfig
	if err := json.NewDecoder(resp.Body).Decode(&cfg); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if cfg.MinParticipants == 0 {
		t.Error("expected non-zero MinParticipants in default config")
	}
	if cfg.PrivacyBudget <= 0 {
		t.Error("expected positive PrivacyBudget in default config")
	}
}

func TestFederatedUpdateConfig_InvalidBody(t *testing.T) {
	app := newFederatedTestApp()

	req := httptest.NewRequest("PUT", "/v1/federated/config", strings.NewReader("not-json"))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 400 {
		t.Fatalf("expected 400 for invalid body, got %d", resp.StatusCode)
	}
}

func TestFederatedUpdateConfig_ValidBody_NoDB(t *testing.T) {
	app := newFederatedTestApp()

	cfg := FederatedConfig{
		Enabled:           true,
		MinParticipants:   5,
		PrivacyBudget:     0.5,
		NoiseScale:        0.2,
		RoundIntervalMins: 30,
		MaxRoundsPerDay:   24,
	}
	body, _ := json.Marshal(cfg)

	req := httptest.NewRequest("PUT", "/v1/federated/config", strings.NewReader(string(body)))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	// With nil DB the handler just returns success
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200 with nil DB, got %d", resp.StatusCode)
	}
}

func TestDemoFederatedParticipants_HasExpectedStatuses(t *testing.T) {
	participants := demoFederatedParticipants()
	validStatuses := map[string]bool{"active": true, "idle": true, "uploading": true, "aggregating": true}
	for _, p := range participants {
		if !validStatuses[p.Status] {
			t.Errorf("unexpected status %q for participant %s", p.Status, p.ID)
		}
	}
}

func TestDemoFederatedRounds_LossOnlyOnCompleted(t *testing.T) {
	rounds := demoFederatedRounds()
	for _, r := range rounds {
		if r.Status == "running" && r.AggregationLoss != nil {
			t.Errorf("round %d is running but has aggregation_loss set", r.ID)
		}
		if r.Status == "completed" && r.AggregationLoss == nil {
			t.Errorf("round %d is completed but missing aggregation_loss", r.ID)
		}
	}
}
