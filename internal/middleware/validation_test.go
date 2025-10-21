package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestInputValidationMiddleware_ValidRequest(t *testing.T) {
	app := fiber.New()
	app.Use(InputValidationMiddleware(DefaultValidationConfig))
	app.Post("/ml/predict", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	req := MLPredictRequest{
		Features: []float64{1.0, 2.0, 3.0},
		ModelID:  "test-model-123",
	}
	body, _ := json.Marshal(req)

	httpReq := httptest.NewRequest("POST", "/ml/predict", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(httpReq)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode != fiber.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}
}

func TestInputValidationMiddleware_MissingModelID(t *testing.T) {
	app := fiber.New()
	app.Use(InputValidationMiddleware(DefaultValidationConfig))
	app.Post("/ml/predict", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	req := MLPredictRequest{
		Features: []float64{1.0, 2.0, 3.0},
		ModelID:  "",
	}
	body, _ := json.Marshal(req)

	httpReq := httptest.NewRequest("POST", "/ml/predict", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(httpReq)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", resp.StatusCode)
	}

	bodyBytes, _ := io.ReadAll(resp.Body)
	var response map[string]interface{}
	json.Unmarshal(bodyBytes, &response)

	if response["field"] != "model_id" {
		t.Errorf("Expected field=model_id, got %v", response["field"])
	}
}

func TestInputValidationMiddleware_InvalidModelID(t *testing.T) {
	app := fiber.New()
	app.Use(InputValidationMiddleware(DefaultValidationConfig))
	app.Post("/ml/predict", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	testCases := []string{
		"model@123",      // Contains @
		"model#test",     // Contains #
		"model id",       // Contains space
		"model/path",     // Contains /
		"model\\path",    // Contains backslash
	}

	for _, invalidID := range testCases {
		req := MLPredictRequest{
			Features: []float64{1.0, 2.0, 3.0},
			ModelID:  invalidID,
		}
		body, _ := json.Marshal(req)

		httpReq := httptest.NewRequest("POST", "/ml/predict", bytes.NewReader(body))
		httpReq.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(httpReq)
		if err != nil {
			t.Fatalf("Request failed for model_id=%s: %v", invalidID, err)
		}

		if resp.StatusCode != fiber.StatusBadRequest {
			t.Errorf("Expected status 400 for model_id=%s, got %d", invalidID, resp.StatusCode)
		}
	}
}

func TestInputValidationMiddleware_EmptyFeatures(t *testing.T) {
	app := fiber.New()
	app.Use(InputValidationMiddleware(DefaultValidationConfig))
	app.Post("/ml/predict", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	req := MLPredictRequest{
		Features: []float64{},
		ModelID:  "test-model",
	}
	body, _ := json.Marshal(req)

	httpReq := httptest.NewRequest("POST", "/ml/predict", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(httpReq)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", resp.StatusCode)
	}

	bodyBytes, _ := io.ReadAll(resp.Body)
	var response map[string]interface{}
	json.Unmarshal(bodyBytes, &response)

	if response["field"] != "features" {
		t.Errorf("Expected field=features, got %v", response["field"])
	}
}

func TestInputValidationMiddleware_FeaturesTooLong(t *testing.T) {
	app := fiber.New()
	config := DefaultValidationConfig
	config.MaxFeaturesLength = 100 // Set low limit for testing
	app.Use(InputValidationMiddleware(config))
	app.Post("/ml/predict", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	// Create features array exceeding limit
	features := make([]float64, 150)
	for i := range features {
		features[i] = float64(i)
	}

	req := MLPredictRequest{
		Features: features,
		ModelID:  "test-model",
	}
	body, _ := json.Marshal(req)

	httpReq := httptest.NewRequest("POST", "/ml/predict", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(httpReq)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", resp.StatusCode)
	}

	bodyBytes, _ := io.ReadAll(resp.Body)
	var response map[string]interface{}
	json.Unmarshal(bodyBytes, &response)

	if response["field"] != "features" {
		t.Errorf("Expected field=features, got %v", response["field"])
	}
}

func TestInputValidationMiddleware_TraceIDGeneration(t *testing.T) {
	app := fiber.New()
	app.Use(InputValidationMiddleware(DefaultValidationConfig))
	app.Post("/ml/predict", func(c *fiber.Ctx) error {
		traceID := c.Locals("trace_id")
		if traceID == nil || traceID == "" {
			t.Error("Expected trace_id to be set in context")
		}
		return c.SendStatus(fiber.StatusOK)
	})

	req := MLPredictRequest{
		Features: []float64{1.0, 2.0, 3.0},
		ModelID:  "test-model",
	}
	body, _ := json.Marshal(req)

	httpReq := httptest.NewRequest("POST", "/ml/predict", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")

	_, err := app.Test(httpReq)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
}

func TestInputValidationMiddleware_SkipNonMLEndpoints(t *testing.T) {
	app := fiber.New()
	app.Use(InputValidationMiddleware(DefaultValidationConfig))
	app.Post("/api/other", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	// Send invalid body - should not be validated
	httpReq := httptest.NewRequest("POST", "/api/other", bytes.NewReader([]byte("{invalid json")))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(httpReq)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	// Should pass through without validation
	if resp.StatusCode != fiber.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}
}

func TestInputValidationMiddleware_InvalidJSON(t *testing.T) {
	app := fiber.New()
	app.Use(InputValidationMiddleware(DefaultValidationConfig))
	app.Post("/ml/predict", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	httpReq := httptest.NewRequest("POST", "/ml/predict", bytes.NewReader([]byte("{invalid json")))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(httpReq)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode != fiber.StatusBadRequest {
		t.Errorf("Expected status 400, got %d", resp.StatusCode)
	}
}

func TestInputValidationMiddleware_ValidModelIDFormats(t *testing.T) {
	app := fiber.New()
	app.Use(InputValidationMiddleware(DefaultValidationConfig))
	app.Post("/ml/predict", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	validModelIDs := []string{
		"model123",
		"test-model",
		"test_model",
		"MODEL_123",
		"model-v1-2-3",
		"abc_123-xyz",
	}

	for _, modelID := range validModelIDs {
		req := MLPredictRequest{
			Features: []float64{1.0, 2.0, 3.0},
			ModelID:  modelID,
		}
		body, _ := json.Marshal(req)

		httpReq := httptest.NewRequest("POST", "/ml/predict", bytes.NewReader(body))
		httpReq.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(httpReq)
		if err != nil {
			t.Fatalf("Request failed for model_id=%s: %v", modelID, err)
		}

		if resp.StatusCode != fiber.StatusOK {
			t.Errorf("Expected status 200 for valid model_id=%s, got %d", modelID, resp.StatusCode)
		}
	}
}
