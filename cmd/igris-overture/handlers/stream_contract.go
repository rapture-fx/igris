package handlers

import (
	"net/http"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"github.com/Igris-inertial/system/igris-overture/models"
)

const streamFallbackOptInField = "allow_stream_fallback"

type streamContract struct {
	executionAuthority string
	fallbackAllowed    bool
	resumeSupported    bool
	replayCondition    string
	fallbackOptInField string
}

func runtimeResponseStreamContract(runtimeResp *http.Response) streamContract {
	contract := streamContract{
		executionAuthority: "runtime",
		fallbackAllowed:    false,
		resumeSupported:    false,
		replayCondition:    "unknown",
		fallbackOptInField: streamFallbackOptInField,
	}
	if runtimeResp == nil {
		return contract
	}
	if resumeSupported, err := strconv.ParseBool(runtimeResp.Header.Get("X-Igris-Runtime-Stream-Resume-Supported")); err == nil {
		contract.resumeSupported = resumeSupported
	}
	if replayCondition := runtimeResp.Header.Get("X-Igris-Runtime-Stream-Replay-Condition"); replayCondition != "" {
		contract.replayCondition = replayCondition
	}
	return contract
}

func runtimeUnavailableStreamContract() streamContract {
	return streamContract{
		executionAuthority: "runtime",
		fallbackAllowed:    false,
		resumeSupported:    false,
		replayCondition:    "completed-final-output",
		fallbackOptInField: streamFallbackOptInField,
	}
}

func fallbackStreamContract() streamContract {
	return streamContract{
		executionAuthority: "overture_fallback",
		fallbackAllowed:    true,
		resumeSupported:    false,
		replayCondition:    "none",
		fallbackOptInField: streamFallbackOptInField,
	}
}

func (c streamContract) applyHeaders(ctx *fiber.Ctx) {
	ctx.Set("X-Igris-Stream-Execution-Authority", c.executionAuthority)
	ctx.Set("X-Igris-Stream-Resume-Supported", strconv.FormatBool(c.resumeSupported))
	ctx.Set("X-Igris-Stream-Replay-Condition", c.replayCondition)
}

func (c streamContract) responseMap() fiber.Map {
	resp := fiber.Map{
		"execution_authority": c.executionAuthority,
		"fallback_allowed":    c.fallbackAllowed,
		"resume_supported":    c.resumeSupported,
		"replay_condition":    c.replayCondition,
	}
	if c.fallbackOptInField != "" {
		resp["fallback_opt_in_field"] = c.fallbackOptInField
	}
	return resp
}

func (c streamContract) applyMetadata(metadata *models.ResponseMetadata) {
	if metadata == nil {
		return
	}
	metadata.StreamExecutionAuthority = c.executionAuthority
	metadata.StreamFallbackAllowed = boolPtr(c.fallbackAllowed)
	metadata.StreamResumeSupported = boolPtr(c.resumeSupported)
	metadata.StreamReplayCondition = c.replayCondition
}

func boolPtr(v bool) *bool {
	return &v
}
