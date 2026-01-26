package router

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"sync"
	"time"

	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/observability"
	"github.com/Igris-inertial/system/igris-overture/tracing"
)

// CouncilMetadata contains metadata about the council execution
type CouncilMetadata struct {
	ProvidersUsed      []string         `json:"council_providers_used"`
	ChairmanProvider   string           `json:"chairman_provider"`
	TotalLatencyMs     int64            `json:"total_latency_ms"`
	CouncilCostUSD     float64          `json:"council_cost_usd"`
	RankingEnabled     bool             `json:"ranking_enabled"`
	WinnerProvider     string           `json:"winner_provider,omitempty"`     // Provider with highest rank
	ResponseCount      int              `json:"response_count"`
	RankingLatencyMs   int64            `json:"ranking_latency_ms,omitempty"`
	SynthesisLatencyMs int64            `json:"synthesis_latency_ms"`
}

// RouteCouncil implements council mode with parallel inference, peer ranking, and chairman synthesis
// This is a non-streaming implementation that uses full Infer() calls
//
// TIER REQUIREMENT: Growth+ (authority level: enforce or prove)
func (sr *SpeculativeRouter) RouteCouncil(
	ctx context.Context,
	req *models.InferRequest,
) (*models.InferResponse, *CouncilMetadata, error) {
	startTime := time.Now()

	// Start tracing span
	ctx, span := observability.StartSpan(ctx, "council_mode")
	defer span.End()

	// Add council mode attribute (using tracing package)
	tracing.AddAttribute(ctx, "council.enabled", true)

	// Extract tenant ID for cost tracking
	tenantID := middleware.TenantIDFromContext(ctx)

	// TIER ENFORCEMENT: Council mode requires Growth+ tier
	if err := middleware.RequireFeature(ctx, "council_mode"); err != nil {
		log.Printf("[CouncilRouter] Tier enforcement: tenant=%s error=%v", tenantID, err)
		return nil, nil, fmt.Errorf("council mode requires Growth tier or higher: %w", err)
	}

	// Validate: council mode requires at least 2 providers (3-4 for quality)
	maxProviders := sr.config.MaxProviders
	if maxProviders > 4 {
		maxProviders = 4 // Limit to 4 to control cost
	}
	if maxProviders < 2 {
		return nil, nil, fmt.Errorf("council mode requires at least 2 providers, got %d", maxProviders)
	}

	// Check cost threshold before running council
	if disabled, reason := sr.costAccounting.ShouldDisableSpeculative(tenantID); disabled {
		log.Printf("[CouncilRouter] Council mode auto-disabled: %s", reason)
		return nil, nil, fmt.Errorf("council mode auto-disabled: %s", reason)
	}

	log.Printf("[CouncilRouter] Starting council with %d providers", maxProviders)

	// Step 1: Select council members (providers)
	candidates, err := sr.selectCandidates(ctx, req, maxProviders)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to select council members: %w", err)
	}

	if len(candidates) < 2 {
		return nil, nil, fmt.Errorf("insufficient providers for council: need 2+, got %d", len(candidates))
	}

	councilProviders := getCandidateIDs(candidates)
	log.Printf("[CouncilRouter] Council members: %v", councilProviders)

	tracing.AddAttribute(ctx, "council.member_count", len(candidates))
	tracing.AddAttribute(ctx, "council.members", fmt.Sprintf("%v", councilProviders))

	// Step 2: Execute parallel full inference on all council members
	councilResponses, err := sr.executeCouncilInferences(ctx, candidates, req)
	if err != nil {
		return nil, nil, fmt.Errorf("council inference failed: %w", err)
	}

	if len(councilResponses) < 2 {
		return nil, nil, fmt.Errorf("insufficient council responses: need 2+, got %d", len(councilResponses))
	}

	log.Printf("[CouncilRouter] Received %d council responses", len(councilResponses))

	// Step 3: Generate peer rankings (optional, can be disabled if time-consuming)
	var rankings []PeerRanking
	var rankingLatency int64

	enableRanking := len(councilResponses) >= 2 // Only rank if we have multiple responses
	if enableRanking {
		rankingStart := time.Now()
		rankings, err = sr.generatePeerRankings(ctx, req, councilResponses)
		rankingLatency = time.Since(rankingStart).Milliseconds()

		if err != nil {
			log.Printf("[CouncilRouter] Peer ranking failed: %v, proceeding without rankings", err)
			rankings = nil // Fallback to simple synthesis
		} else {
			log.Printf("[CouncilRouter] Generated %d peer rankings in %dms", len(rankings), rankingLatency)
		}
	}

	// Step 4: Chairman synthesis
	synthesisStart := time.Now()
	chairmanResponse, err := sr.synthesizeChairmanResponse(ctx, req, councilResponses, rankings)
	synthesisLatency := time.Since(synthesisStart).Milliseconds()

	if err != nil {
		return nil, nil, fmt.Errorf("chairman synthesis failed: %w", err)
	}

	log.Printf("[CouncilRouter] Chairman synthesis completed in %dms", synthesisLatency)

	// Step 5: Calculate metadata and costs
	totalLatency := time.Since(startTime).Milliseconds()

	// Determine winner (highest average rank if rankings available)
	winner := ""
	if len(rankings) > 0 {
		winner = determineWinner(councilResponses, rankings)
	}

	metadata := &CouncilMetadata{
		ProvidersUsed:      councilProviders,
		ChairmanProvider:   sr.config.ChairmanProvider,
		TotalLatencyMs:     totalLatency,
		RankingEnabled:     len(rankings) > 0,
		WinnerProvider:     winner,
		ResponseCount:      len(councilResponses),
		RankingLatencyMs:   rankingLatency,
		SynthesisLatencyMs: synthesisLatency,
	}

	// Add metadata to chairman response
	if chairmanResponse.Metadata == nil {
		chairmanResponse.Metadata = &models.ResponseMetadata{}
	}
	chairmanResponse.Metadata.RouteDecision = "council_mode"
	chairmanResponse.Metadata.Provider = metadata.ChairmanProvider

	// Record observability metrics
	tracing.AddAttribute(ctx, "council.total_latency_ms", totalLatency)
	tracing.AddAttribute(ctx, "council.ranking_latency_ms", rankingLatency)
	tracing.AddAttribute(ctx, "council.synthesis_latency_ms", synthesisLatency)
	tracing.AddAttribute(ctx, "council.winner", winner)

	log.Printf("[CouncilRouter] Council completed: latency=%dms, members=%d, winner=%s",
		totalLatency, len(councilResponses), winner)

	return chairmanResponse, metadata, nil
}

// executeCouncilInferences runs parallel full inference on all council members
func (sr *SpeculativeRouter) executeCouncilInferences(
	ctx context.Context,
	candidates []*ProviderCandidate,
	req *models.InferRequest,
) ([]CouncilResponse, error) {
	type result struct {
		response *models.InferResponse
		provider string
		latency  int64
		err      error
	}

	// P0-2 FIX: BUFFER the channel to prevent deadlock when timeout occurs
	resultsChan := make(chan result, len(candidates))

	// Launch parallel inferences
	for _, candidate := range candidates {
		go func(c *ProviderCandidate) {
			start := time.Now()

			// Use Infer (full response, not streaming)
			resp, err := c.Provider.Infer(c.Context, req)
			latency := time.Since(start).Milliseconds()

			resultsChan <- result{
				response: resp,
				provider: c.ProviderID,
				latency:  latency,
				err:      err,
			}
		}(candidate)
	}

	// Collect results with timeout
	timeout := time.After(30 * time.Second) // 30s max for all inferences
	responses := make([]CouncilResponse, 0, len(candidates))
	receivedCount := 0

	for receivedCount < len(candidates) {
		select {
		case res := <-resultsChan:
			receivedCount++

			if res.err != nil {
				log.Printf("[CouncilRouter] Provider %s failed: %v", res.provider, res.err)
				continue
			}

			if res.response == nil || len(res.response.Choices) == 0 {
				log.Printf("[CouncilRouter] Provider %s returned empty response", res.provider)
				continue
			}

			// Extract content from first choice
			content := ""
			if res.response.Choices[0].Message != nil {
				content = res.response.Choices[0].Message.Content
			}

			councilResp := CouncilResponse{
				ProviderID: res.provider,
				Content:    content,
				TokenCount: res.response.Usage.TotalTokens,
				LatencyMs:  res.latency,
			}

			responses = append(responses, councilResp)
			log.Printf("[CouncilRouter] Received response from %s (%d tokens, %dms)",
				res.provider, councilResp.TokenCount, res.latency)

		case <-timeout:
			log.Printf("[CouncilRouter] Timeout waiting for council responses, proceeding with %d/%d",
				len(responses), len(candidates))
			return responses, nil
		}
	}

	return responses, nil
}

// generatePeerRankings asks each council member to rank all responses
func (sr *SpeculativeRouter) generatePeerRankings(
	ctx context.Context,
	originalReq *models.InferRequest,
	responses []CouncilResponse,
) ([]PeerRanking, error) {
	prompts := NewCouncilPrompts()
	originalQuery := ExtractOriginalQuery(originalReq)

	// Extract response contents
	responseContents := make([]string, len(responses))
	for i, resp := range responses {
		responseContents[i] = resp.Content
	}

	// Generate ranking prompt
	rankingPrompt := prompts.GeneratePeerRankingPrompt(originalQuery, responseContents)

	// For simplicity in MVP, use just the first 2 providers as rankers
	// Full implementation would use all providers or a subset
	maxRankers := 2
	if maxRankers > len(responses) {
		maxRankers = len(responses)
	}

	// P0-2 FIX: Use sync.Mutex to protect concurrent writes to rankings slice
	rankings := make([]PeerRanking, 0, maxRankers)
	var rankingsMu sync.Mutex

	// Ask each ranker to rank the responses
	for i := 0; i < maxRankers; i++ {
		rankerProvider := responses[i].ProviderID

		// Get provider
		provider, ok := sr.providerRegistry.Get(rankerProvider)
		if !ok {
			log.Printf("[CouncilRouter] Ranker provider %s not found", rankerProvider)
			continue
		}

		// Create ranking request
		rankReq := &models.InferRequest{
			Model:    originalReq.Model,
			Messages: CreateUserMessage(rankingPrompt),
			MaxTokens: 500,
			Temperature: 0.3, // Lower temperature for more consistent ranking
		}

		// Execute ranking inference
		rankCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		rankResp, err := provider.Infer(rankCtx, rankReq)
		cancel()

		if err != nil {
			log.Printf("[CouncilRouter] Ranking from %s failed: %v", rankerProvider, err)
			continue
		}

		if len(rankResp.Choices) == 0 {
			log.Printf("[CouncilRouter] Empty ranking response from %s", rankerProvider)
			continue
		}

		// P0-2 FIX: Parse JSON ranking response with panic recovery
		var peerRankResp PeerRankingResponse
		parseErr := func() (err error) {
			defer func() {
				if r := recover(); r != nil {
					err = fmt.Errorf("panic during JSON unmarshal: %v", r)
				}
			}()

			rankingContent := rankResp.Choices[0].Message.Content
			if err := json.Unmarshal([]byte(rankingContent), &peerRankResp); err != nil {
				log.Printf("[CouncilRouter] Failed to parse ranking JSON from %s: %v", rankerProvider, err)
				// Try to extract JSON from markdown code blocks
				rankingContent = extractJSON(rankingContent)
				if err := json.Unmarshal([]byte(rankingContent), &peerRankResp); err != nil {
					log.Printf("[CouncilRouter] JSON extraction also failed for %s", rankerProvider)
					return err
				}
			}
			return nil
		}()

		if parseErr != nil {
			log.Printf("[CouncilRouter] JSON parsing failed for %s: %v", rankerProvider, parseErr)
			continue
		}

		// P0-2 FIX: Protect concurrent writes with mutex
		rankingsMu.Lock()
		rankings = append(rankings, PeerRanking{
			RankerProvider: rankerProvider,
			Rankings:       peerRankResp.Rankings,
		})
		rankingsMu.Unlock()

		log.Printf("[CouncilRouter] Received ranking from %s: %d responses ranked",
			rankerProvider, len(peerRankResp.Rankings))
	}

	if len(rankings) == 0 {
		return nil, fmt.Errorf("no valid rankings generated")
	}

	return rankings, nil
}

// synthesizeChairmanResponse generates the final synthesized response
func (sr *SpeculativeRouter) synthesizeChairmanResponse(
	ctx context.Context,
	originalReq *models.InferRequest,
	responses []CouncilResponse,
	rankings []PeerRanking,
) (*models.InferResponse, error) {
	prompts := NewCouncilPrompts()
	originalQuery := ExtractOriginalQuery(originalReq)

	// Generate chairman prompt (with or without rankings)
	var chairmanPrompt string
	if len(rankings) > 0 {
		chairmanPrompt = prompts.GenerateChairmanSynthesisPrompt(originalQuery, responses, rankings)
	} else {
		chairmanPrompt = prompts.GenerateSimpleChairmanPrompt(originalQuery, responses)
	}

	// Get chairman provider
	chairmanProviderID := sr.config.ChairmanProvider
	chairman, ok := sr.providerRegistry.Get(chairmanProviderID)
	if !ok {
		// Fallback to first available provider
		providerNames := sr.providerRegistry.List()
		if len(providerNames) == 0 {
			return nil, fmt.Errorf("no providers available for chairman")
		}
		chairmanProviderID = providerNames[0]
		chairman, _ = sr.providerRegistry.Get(chairmanProviderID)
		log.Printf("[CouncilRouter] Chairman provider %s not found, using %s",
			sr.config.ChairmanProvider, chairmanProviderID)
	}

	// Create chairman inference request
	chairmanReq := &models.InferRequest{
		Model:       originalReq.Model,
		Messages:    CreateUserMessage(chairmanPrompt),
		MaxTokens:   originalReq.MaxTokens,
		Temperature: 0.7, // Moderate temperature for synthesis
	}

	// Execute chairman synthesis
	chairmanCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	response, err := chairman.Infer(chairmanCtx, chairmanReq)
	if err != nil {
		return nil, fmt.Errorf("chairman inference failed: %w", err)
	}

	return response, nil
}

// determineWinner analyzes peer rankings to determine the highest-ranked response
func determineWinner(responses []CouncilResponse, rankings []PeerRanking) string {
	if len(rankings) == 0 || len(responses) == 0 {
		return ""
	}

	// Calculate average rank for each response
	rankSums := make(map[int]int)      // responseID -> sum of ranks
	rankCounts := make(map[int]int)    // responseID -> number of rankings

	for _, peerRank := range rankings {
		for _, rank := range peerRank.Rankings {
			responseID := rank.ResponseID
			rankSums[responseID] += rank.Rank
			rankCounts[responseID]++
		}
	}

	// Find response with lowest average rank (1 is best)
	bestResponseID := -1
	lowestAvgRank := float64(1000)

	for responseID, sum := range rankSums {
		count := rankCounts[responseID]
		if count == 0 {
			continue
		}
		avgRank := float64(sum) / float64(count)
		if avgRank < lowestAvgRank {
			lowestAvgRank = avgRank
			bestResponseID = responseID
		}
	}

	// Map response ID back to provider
	if bestResponseID > 0 && bestResponseID <= len(responses) {
		return responses[bestResponseID-1].ProviderID
	}

	return ""
}

// extractJSON attempts to extract JSON from markdown code blocks
func extractJSON(content string) string {
	// Try to extract from ```json ... ``` blocks
	start := -1
	end := -1

	// Find ```json or just ```
	for i := 0; i < len(content)-3; i++ {
		if content[i:i+3] == "```" {
			if start == -1 {
				// Skip past the opening ```
				start = i + 3
				// Skip "json" if present
				if start < len(content)-4 && content[start:start+4] == "json" {
					start += 4
				}
				// Skip whitespace and newlines
				for start < len(content) && (content[start] == ' ' || content[start] == '\n' || content[start] == '\r') {
					start++
				}
			} else {
				end = i
				break
			}
		}
	}

	if start > 0 && end > start {
		return content[start:end]
	}

	// If no code blocks, try to find JSON object boundaries
	startBrace := -1
	endBrace := -1
	braceCount := 0

	for i, ch := range content {
		if ch == '{' {
			if startBrace == -1 {
				startBrace = i
			}
			braceCount++
		} else if ch == '}' {
			braceCount--
			if braceCount == 0 && startBrace != -1 {
				endBrace = i + 1
				break
			}
		}
	}

	if startBrace != -1 && endBrace > startBrace {
		return content[startBrace:endBrace]
	}

	return content
}

// CouncilCostEstimate estimates the cost of council mode execution
func (sr *SpeculativeRouter) CouncilCostEstimate(numProviders int, avgTokensPerResponse int) float64 {
	// Simplified cost model:
	// - N providers generate full responses
	// - 2 providers rank (smaller prompts)
	// - 1 chairman synthesizes
	// Total = N * response_cost + 2 * ranking_cost + 1 * synthesis_cost

	costPer1kTokens := 0.002 // Average $0.002 per 1k tokens
	responseCost := float64(numProviders) * float64(avgTokensPerResponse) * (costPer1kTokens / 1000.0)
	rankingCost := 2.0 * 500.0 * (costPer1kTokens / 1000.0)   // ~500 tokens for ranking
	synthesisCost := 1.0 * float64(avgTokensPerResponse) * (costPer1kTokens / 1000.0)

	return responseCost + rankingCost + synthesisCost
}

// Helper: Sort responses by average rank
type rankedResponse struct {
	response CouncilResponse
	avgRank  float64
}

func sortResponsesByRank(responses []CouncilResponse, rankings []PeerRanking) []CouncilResponse {
	if len(rankings) == 0 {
		return responses
	}

	// Calculate average ranks
	ranked := make([]rankedResponse, len(responses))
	for i, resp := range responses {
		ranked[i] = rankedResponse{
			response: resp,
			avgRank:  calculateAvgRank(i+1, rankings),
		}
	}

	// Sort by average rank (lower is better)
	sort.Slice(ranked, func(i, j int) bool {
		return ranked[i].avgRank < ranked[j].avgRank
	})

	// Extract sorted responses
	sorted := make([]CouncilResponse, len(ranked))
	for i, r := range ranked {
		sorted[i] = r.response
	}

	return sorted
}

func calculateAvgRank(responseID int, rankings []PeerRanking) float64 {
	sum := 0
	count := 0

	for _, peerRank := range rankings {
		for _, rank := range peerRank.Rankings {
			if rank.ResponseID == responseID {
				sum += rank.Rank
				count++
			}
		}
	}

	if count == 0 {
		return 1000.0 // Unranked responses go to bottom
	}

	return float64(sum) / float64(count)
}
