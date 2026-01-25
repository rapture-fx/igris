package router

import (
	"fmt"
	"strings"

	"github.com/Igris-inertial/system/igris-overture/models"
)

// CouncilPrompts contains prompt templates for council mode
type CouncilPrompts struct{}

// NewCouncilPrompts creates a new council prompts instance
func NewCouncilPrompts() *CouncilPrompts {
	return &CouncilPrompts{}
}

// GeneratePeerRankingPrompt generates a prompt for peer models to rank responses
// The prompt asks each model to rank anonymized responses from other models
func (cp *CouncilPrompts) GeneratePeerRankingPrompt(
	originalQuery string,
	responses []string,
) string {
	// Build anonymized response list
	var responseList strings.Builder
	for i, resp := range responses {
		responseList.WriteString(fmt.Sprintf("\n**Response %d:**\n%s\n", i+1, resp))
	}

	return fmt.Sprintf(`You are a peer reviewer in an AI model council. Your task is to rank the following anonymized responses to the user's query.

**User Query:**
%s

**Responses to Rank:**
%s

**Ranking Criteria:**
1. **Insight**: Depth of understanding and quality of reasoning
2. **Conciseness**: Clarity and brevity without sacrificing completeness
3. **Accuracy**: Correctness and reliability of information

**Instructions:**
- Rank the responses from best to worst (1 = best, %d = worst)
- Consider all three criteria equally
- Provide your ranking as a JSON object with brief justifications

**Response Format:**
{
  "rankings": [
    {"response_id": 1, "rank": 1, "justification": "Clear, accurate, and insightful"},
    {"response_id": 2, "rank": 2, "justification": "Good but verbose"},
    ...
  ]
}

Provide ONLY the JSON object, no additional text.`, originalQuery, responseList.String(), len(responses))
}

// GenerateChairmanSynthesisPrompt generates a prompt for the chairman to synthesize the final response
// The chairman receives all responses and rankings to create the best answer
func (cp *CouncilPrompts) GenerateChairmanSynthesisPrompt(
	originalQuery string,
	responses []CouncilResponse,
	rankings []PeerRanking,
) string {
	// Build response list with IDs
	var responseList strings.Builder
	for _, resp := range responses {
		responseList.WriteString(fmt.Sprintf("\n**Response from %s:**\n%s\n", resp.ProviderID, resp.Content))
	}

	// Build ranking summary
	var rankingSummary strings.Builder
	rankingSummary.WriteString("\n**Peer Rankings:**\n")
	for i, ranking := range rankings {
		rankingSummary.WriteString(fmt.Sprintf("\nRanker %d:\n", i+1))
		for _, r := range ranking.Rankings {
			rankingSummary.WriteString(fmt.Sprintf("  - Response %d (Rank %d): %s\n",
				r.ResponseID, r.Rank, r.Justification))
		}
	}

	return fmt.Sprintf(`You are the chairman of an AI model council. Your task is to synthesize the best possible response to the user's query based on the council's deliberations.

**User Query:**
%s

**Council Responses:**
%s
%s

**Your Task:**
1. Analyze all responses and their peer rankings
2. Identify the strongest insights, reasoning, and information
3. Synthesize a response that combines the best elements from all council members
4. Ensure the final response is:
   - Accurate and well-reasoned
   - Clear and concise
   - Comprehensive yet focused
   - Better than any individual response

**Important:**
- Do NOT simply copy the highest-ranked response
- Synthesize and improve upon the collective wisdom
- Maintain a professional, helpful tone
- Provide ONLY the synthesized response, no meta-commentary

Begin your synthesized response now:`, originalQuery, responseList.String(), rankingSummary.String())
}

// GenerateSimpleChairmanPrompt generates a simpler chairman prompt without detailed rankings
// Used as a fallback when ranking fails
func (cp *CouncilPrompts) GenerateSimpleChairmanPrompt(
	originalQuery string,
	responses []CouncilResponse,
) string {
	var responseList strings.Builder
	for _, resp := range responses {
		responseList.WriteString(fmt.Sprintf("\n**Response from %s:**\n%s\n", resp.ProviderID, resp.Content))
	}

	return fmt.Sprintf(`You are synthesizing multiple AI model responses into a single, superior answer.

**User Query:**
%s

**Available Responses:**
%s

**Task:**
Combine the best insights, accuracy, and clarity from all responses into a single, comprehensive answer. Improve upon them where possible.

Provide ONLY the synthesized response:`, originalQuery, responseList.String())
}

// CouncilResponse represents a response from a council member
type CouncilResponse struct {
	ProviderID string
	Content    string
	TokenCount int
	LatencyMs  int64
}

// PeerRanking represents a peer's ranking of all responses
type PeerRanking struct {
	RankerProvider string
	Rankings       []ResponseRank
}

// ResponseRank represents a single response's rank and justification
type ResponseRank struct {
	ResponseID    int    `json:"response_id"`
	Rank          int    `json:"rank"`
	Justification string `json:"justification"`
}

// PeerRankingResponse is the JSON structure expected from peer rankers
type PeerRankingResponse struct {
	Rankings []ResponseRank `json:"rankings"`
}

// ExtractOriginalQuery extracts the user's original query from InferRequest
func ExtractOriginalQuery(req *models.InferRequest) string {
	if len(req.Messages) == 0 {
		return ""
	}

	// Find the last user message
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			return req.Messages[i].Content
		}
	}

	// Fallback: return last message
	return req.Messages[len(req.Messages)-1].Content
}

// CreateFullConversation creates a full conversation including system prompts
func CreateFullConversation(systemPrompt, userPrompt string) []models.Message {
	return []models.Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userPrompt},
	}
}

// CreateUserMessage creates a simple user message for non-conversational prompts
func CreateUserMessage(content string) []models.Message {
	return []models.Message{
		{Role: "user", Content: content},
	}
}
