package api

import (
	"encoding/base64"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

// helper: build a test app with multimodal routes, bypassing BetterAuth
func newMultimodalTestApp() *fiber.App {
	app := fiber.New()
	app.Post("/v1/infer/multimodal", handleMultimodalInfer(nil))
	app.Get("/v1/infer/multimodal/stats", handleMultimodalStats(nil))
	return app
}

func TestMultimodalInfer_TextOnly(t *testing.T) {
	app := newMultimodalTestApp()

	req := MultimodalRequest{Prompt: "Hello, what is 2+2?"}
	body, _ := json.Marshal(req)

	httpReq := httptest.NewRequest("POST", "/v1/infer/multimodal", strings.NewReader(string(body)))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(httpReq)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var result MultimodalResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if result.ID == "" {
		t.Error("expected non-empty ID")
	}
	if result.Provider == "" {
		t.Error("expected non-empty Provider")
	}
	if result.Model == "" {
		t.Error("expected non-empty Model")
	}
	if len(result.Modalities) == 0 {
		t.Error("expected at least one modality")
	}
	if result.Modalities[0] != "text" {
		t.Errorf("expected first modality 'text', got %q", result.Modalities[0])
	}
}

func TestMultimodalInfer_WithImage(t *testing.T) {
	app := newMultimodalTestApp()

	// Minimal valid base64 (just some bytes)
	fakeImage := base64.StdEncoding.EncodeToString([]byte("fake-image-bytes"))
	req := MultimodalRequest{
		Prompt:    "Describe this image",
		ImageData: fakeImage,
		ImageMime: "image/jpeg",
	}
	body, _ := json.Marshal(req)

	httpReq := httptest.NewRequest("POST", "/v1/infer/multimodal", strings.NewReader(string(body)))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(httpReq)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var result MultimodalResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode error: %v", err)
	}

	hasImage := false
	for _, m := range result.Modalities {
		if m == "image" {
			hasImage = true
		}
	}
	if !hasImage {
		t.Errorf("expected 'image' in modalities, got %v", result.Modalities)
	}
}

func TestMultimodalInfer_WithAudio(t *testing.T) {
	app := newMultimodalTestApp()

	fakeAudio := base64.StdEncoding.EncodeToString([]byte("fake-audio-bytes"))
	req := MultimodalRequest{
		Prompt:    "Transcribe this",
		AudioData: fakeAudio,
		AudioMime: "audio/wav",
	}
	body, _ := json.Marshal(req)

	httpReq := httptest.NewRequest("POST", "/v1/infer/multimodal", strings.NewReader(string(body)))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(httpReq)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var result MultimodalResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode error: %v", err)
	}

	hasAudio := false
	for _, m := range result.Modalities {
		if m == "audio" {
			hasAudio = true
		}
	}
	if !hasAudio {
		t.Errorf("expected 'audio' in modalities, got %v", result.Modalities)
	}
}

func TestMultimodalInfer_EmptyRequest_Returns400(t *testing.T) {
	app := newMultimodalTestApp()

	req := MultimodalRequest{} // no prompt, no image, no audio
	body, _ := json.Marshal(req)

	httpReq := httptest.NewRequest("POST", "/v1/infer/multimodal", strings.NewReader(string(body)))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(httpReq)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 400 {
		t.Fatalf("expected 400 for empty request, got %d", resp.StatusCode)
	}
}

func TestMultimodalInfer_InvalidBase64Image_Returns400(t *testing.T) {
	app := newMultimodalTestApp()

	req := MultimodalRequest{
		Prompt:    "test",
		ImageData: "!!!not-valid-base64!!!",
		ImageMime: "image/jpeg",
	}
	body, _ := json.Marshal(req)

	httpReq := httptest.NewRequest("POST", "/v1/infer/multimodal", strings.NewReader(string(body)))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(httpReq)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 400 {
		t.Fatalf("expected 400 for invalid base64, got %d", resp.StatusCode)
	}
}

func TestMultimodalInfer_InvalidBody_Returns400(t *testing.T) {
	app := newMultimodalTestApp()

	httpReq := httptest.NewRequest("POST", "/v1/infer/multimodal", strings.NewReader("not-json"))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(httpReq)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 400 {
		t.Fatalf("expected 400 for invalid body, got %d", resp.StatusCode)
	}
}

func TestMultimodalStats_ReturnsDemo(t *testing.T) {
	app := newMultimodalTestApp()

	req := httptest.NewRequest("GET", "/v1/infer/multimodal/stats", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var stats MultimodalStats
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		t.Fatalf("decode error: %v", err)
	}
	if stats.TotalRequests == 0 {
		t.Error("expected non-zero TotalRequests in demo stats")
	}
	if stats.TopProvider == "" {
		t.Error("expected non-empty TopProvider in demo stats")
	}
}

func TestResolveMultimodalProvider_ImageUsesAnthropic(t *testing.T) {
	req := MultimodalRequest{ImageData: "somedata"}
	got := resolveMultimodalProvider(req)
	if got != "anthropic" {
		t.Errorf("expected 'anthropic' for image, got %q", got)
	}
}

func TestResolveMultimodalProvider_AudioUsesOpenAI(t *testing.T) {
	req := MultimodalRequest{AudioData: "somedata"}
	got := resolveMultimodalProvider(req)
	if got != "openai" {
		t.Errorf("expected 'openai' for audio, got %q", got)
	}
}

func TestResolveMultimodalProvider_TextOnlyUsesAnthropic(t *testing.T) {
	req := MultimodalRequest{Prompt: "hello"}
	got := resolveMultimodalProvider(req)
	if got != "anthropic" {
		t.Errorf("expected 'anthropic' for text-only, got %q", got)
	}
}

func TestDefaultMultimodalModel_Anthropic(t *testing.T) {
	got := defaultMultimodalModel("anthropic", MultimodalRequest{})
	if got == "" {
		t.Error("expected non-empty model for anthropic")
	}
}

func TestDefaultMultimodalModel_OpenAIAudio(t *testing.T) {
	got := defaultMultimodalModel("openai", MultimodalRequest{AudioData: "x"})
	if got != "whisper-1" {
		t.Errorf("expected whisper-1 for openai+audio, got %q", got)
	}
}

func TestEstimateTokenCount_Empty(t *testing.T) {
	n := estimateTokenCount("")
	if n != 1 {
		t.Errorf("expected 1 for empty string, got %d", n)
	}
}

func TestEstimateTokenCount_NonEmpty(t *testing.T) {
	n := estimateTokenCount("hello world foo bar")
	if n == 0 {
		t.Error("expected non-zero token count")
	}
}
