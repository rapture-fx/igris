package handlers

import (
	"net/http"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"github.com/Igris-inertial/system/igris-overture/models"
)

const streamFallbackOptInField = "allow_stream_fallback"

func runtimeResponseStreamContract(runtimeResp *http.Response) models.StreamContract {
	contract := models.StreamContract{
		ExecutionAuthority: "runtime",
		FallbackAllowed:    false,
		ResumeSupported:    false,
		ReplayCondition:    "unknown",
		FallbackOptInField: streamFallbackOptInField,
	}
	if runtimeResp == nil {
		return contract
	}
	if resumeSupported, err := strconv.ParseBool(runtimeResp.Header.Get("X-Igris-Runtime-Stream-Resume-Supported")); err == nil {
		contract.ResumeSupported = resumeSupported
	}
	if replayCondition := runtimeResp.Header.Get("X-Igris-Runtime-Stream-Replay-Condition"); replayCondition != "" {
		contract.ReplayCondition = replayCondition
	}
	return contract
}

func runtimeUnavailableStreamContract() models.StreamContract {
	return models.StreamContract{
		ExecutionAuthority: "runtime",
		FallbackAllowed:    false,
		ResumeSupported:    false,
		ReplayCondition:    "completed-final-output",
		FallbackOptInField: streamFallbackOptInField,
	}
}

func fallbackStreamContract() models.StreamContract {
	return models.StreamContract{
		ExecutionAuthority: "overture_fallback",
		FallbackAllowed:    true,
		ResumeSupported:    false,
		ReplayCondition:    "none",
		FallbackOptInField: streamFallbackOptInField,
	}
}

func applyStreamContractHeaders(ctx *fiber.Ctx, contract models.StreamContract) {
	ctx.Set("X-Igris-Stream-Execution-Authority", contract.ExecutionAuthority)
	ctx.Set("X-Igris-Stream-Resume-Supported", strconv.FormatBool(contract.ResumeSupported))
	ctx.Set("X-Igris-Stream-Replay-Condition", contract.ReplayCondition)
}

func applyStreamContractMetadata(metadata *models.ResponseMetadata, contract models.StreamContract) {
	if metadata == nil {
		return
	}
	contractCopy := contract
	metadata.Stream = &contractCopy
}
