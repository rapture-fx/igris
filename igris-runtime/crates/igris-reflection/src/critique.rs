/// Critique system for evaluating LLM responses
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Quality score for a specific aspect (0.0-1.0)
pub type CritiqueScore = f32;

/// Critique categories
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CritiqueCategory {
    /// Correctness and accuracy
    Correctness,
    /// Clarity and readability
    Clarity,
    /// Completeness of the response
    Completeness,
    /// Relevance to the prompt
    Relevance,
    /// Code quality (if applicable)
    CodeQuality,
    /// Reasoning quality
    Reasoning,
    /// Creativity and originality
    Creativity,
}

impl CritiqueCategory {
    /// Get the weight of this category (for overall score calculation)
    pub fn weight(&self) -> f32 {
        match self {
            Self::Correctness => 0.3,
            Self::Relevance => 0.25,
            Self::Clarity => 0.15,
            Self::Completeness => 0.15,
            Self::Reasoning => 0.1,
            Self::CodeQuality => 0.05,
            Self::Creativity => 0.0, // Not weighted in overall score
        }
    }

    /// Get all standard categories
    pub fn all() -> Vec<Self> {
        vec![
            Self::Correctness,
            Self::Clarity,
            Self::Completeness,
            Self::Relevance,
            Self::CodeQuality,
            Self::Reasoning,
            Self::Creativity,
        ]
    }
}

/// Detailed critique of a response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Critique {
    /// Overall quality score (0.0-1.0)
    pub overall_score: f32,

    /// Strengths identified
    pub strengths: Vec<String>,

    /// Weaknesses identified
    pub weaknesses: Vec<String>,

    /// Suggestions for improvement
    pub suggestions: Vec<String>,

    /// Category-specific scores
    pub categories: HashMap<CritiqueCategory, CritiqueScore>,
}

impl Critique {
    /// Create a new critique with default values
    pub fn new() -> Self {
        Self {
            overall_score: 0.5,
            strengths: Vec::new(),
            weaknesses: Vec::new(),
            suggestions: Vec::new(),
            categories: HashMap::new(),
        }
    }

    /// Calculate overall score from category scores
    pub fn calculate_overall_score(&mut self) {
        let mut weighted_sum = 0.0;
        let mut total_weight = 0.0;

        for (category, score) in &self.categories {
            let weight = category.weight();
            weighted_sum += score * weight;
            total_weight += weight;
        }

        if total_weight > 0.0 {
            self.overall_score = weighted_sum / total_weight;
        }
    }

    /// Parse critique from LLM response
    ///
    /// Expected format:
    /// SCORE: 0.75
    /// STRENGTHS:
    /// - Point 1
    /// - Point 2
    /// WEAKNESSES:
    /// - Issue 1
    /// SUGGESTIONS:
    /// - Suggestion 1
    pub fn parse_from_response(response: &str) -> Self {
        let mut critique = Self::new();

        // Parse overall score
        if let Some(score_line) = response.lines().find(|l| l.starts_with("SCORE:")) {
            if let Some(score_str) = score_line.strip_prefix("SCORE:") {
                if let Ok(score) = score_str.trim().parse::<f32>() {
                    critique.overall_score = score.clamp(0.0, 1.0);
                }
            }
        }

        // Parse sections
        let mut current_section = "";
        for line in response.lines() {
            let trimmed = line.trim();

            if trimmed.starts_with("STRENGTHS:") {
                current_section = "strengths";
            } else if trimmed.starts_with("WEAKNESSES:") {
                current_section = "weaknesses";
            } else if trimmed.starts_with("SUGGESTIONS:") {
                current_section = "suggestions";
            } else if trimmed.starts_with("- ") {
                let item = trimmed.strip_prefix("- ").unwrap().to_string();
                match current_section {
                    "strengths" => critique.strengths.push(item),
                    "weaknesses" => critique.weaknesses.push(item),
                    "suggestions" => critique.suggestions.push(item),
                    _ => {}
                }
            }
        }

        // If no explicit score, estimate from strengths/weaknesses balance
        if critique.overall_score == 0.5
            && (!critique.strengths.is_empty() || !critique.weaknesses.is_empty())
        {
            let strength_count = critique.strengths.len() as f32;
            let weakness_count = critique.weaknesses.len() as f32;
            let total = strength_count + weakness_count;
            if total > 0.0 {
                critique.overall_score = (strength_count / total) * 0.5 + 0.25;
            }
        }

        critique
    }

    /// Create a critique prompt for evaluating a response
    pub fn create_critique_prompt(original_prompt: &str, response: &str) -> String {
        format!(
            r#"You are a critical evaluator. Analyze the following response and provide a detailed critique.

ORIGINAL PROMPT:
{}

RESPONSE TO EVALUATE:
{}

Provide your critique in this exact format:

SCORE: [0.0-1.0]

STRENGTHS:
- [List what the response does well]

WEAKNESSES:
- [List what needs improvement]

SUGGESTIONS:
- [Provide specific improvement suggestions]

Be thorough and honest. Focus on correctness, clarity, completeness, and relevance."#,
            original_prompt, response
        )
    }

    /// Create an improvement prompt based on critique
    pub fn create_improvement_prompt(
        original_prompt: &str,
        previous_response: &str,
        critique: &Critique,
    ) -> String {
        let weaknesses_text = if critique.weaknesses.is_empty() {
            "None identified".to_string()
        } else {
            critique
                .weaknesses
                .iter()
                .map(|w| format!("- {}", w))
                .collect::<Vec<_>>()
                .join("\n")
        };

        let suggestions_text = if critique.suggestions.is_empty() {
            "Try to improve overall quality".to_string()
        } else {
            critique
                .suggestions
                .iter()
                .map(|s| format!("- {}", s))
                .collect::<Vec<_>>()
                .join("\n")
        };

        format!(
            r#"Improve your previous response based on the critique below.

ORIGINAL PROMPT:
{}

YOUR PREVIOUS RESPONSE:
{}

CRITIQUE (Score: {:.2}):

Issues to address:
{}

Suggestions:
{}

Provide an improved response that addresses these issues. Focus on making it more correct, clear, complete, and relevant."#,
            original_prompt,
            previous_response,
            critique.overall_score,
            weaknesses_text,
            suggestions_text
        )
    }
}

impl Default for Critique {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_critique_parse() {
        let response = r#"SCORE: 0.75
STRENGTHS:
- Good structure
- Clear explanation
WEAKNESSES:
- Missing examples
SUGGESTIONS:
- Add more detail"#;

        let critique = Critique::parse_from_response(response);
        assert_eq!(critique.overall_score, 0.75);
        assert_eq!(critique.strengths.len(), 2);
        assert_eq!(critique.weaknesses.len(), 1);
        assert_eq!(critique.suggestions.len(), 1);
    }

    #[test]
    fn test_critique_parse_no_score() {
        let response = r#"STRENGTHS:
- Point 1
- Point 2
WEAKNESSES:
- Issue 1"#;

        let critique = Critique::parse_from_response(response);
        assert!(critique.overall_score > 0.5); // More strengths than weaknesses
        assert_eq!(critique.strengths.len(), 2);
        assert_eq!(critique.weaknesses.len(), 1);
    }

    #[test]
    fn test_category_weights() {
        assert_eq!(CritiqueCategory::Correctness.weight(), 0.3);
        assert_eq!(CritiqueCategory::Relevance.weight(), 0.25);

        let all_categories = CritiqueCategory::all();
        assert_eq!(all_categories.len(), 7);
    }

    #[test]
    fn test_overall_score_calculation() {
        let mut critique = Critique::new();
        critique
            .categories
            .insert(CritiqueCategory::Correctness, 0.8);
        critique.categories.insert(CritiqueCategory::Clarity, 0.6);

        critique.calculate_overall_score();

        // Correctness (0.8 * 0.3) + Clarity (0.6 * 0.15) = 0.24 + 0.09 = 0.33
        // Total weight = 0.3 + 0.15 = 0.45
        // Overall = 0.33 / 0.45 ≈ 0.73
        assert!((critique.overall_score - 0.73).abs() < 0.01);
    }

    #[test]
    fn test_create_critique_prompt() {
        let prompt = Critique::create_critique_prompt("What is 2+2?", "The answer is 4.");
        assert!(prompt.contains("ORIGINAL PROMPT:"));
        assert!(prompt.contains("RESPONSE TO EVALUATE:"));
        assert!(prompt.contains("STRENGTHS:"));
    }

    #[test]
    fn test_create_improvement_prompt() {
        let critique = Critique {
            overall_score: 0.6,
            strengths: vec![],
            weaknesses: vec!["Too brief".to_string()],
            suggestions: vec!["Add more detail".to_string()],
            categories: HashMap::new(),
        };

        let prompt =
            Critique::create_improvement_prompt("What is 2+2?", "The answer is 4.", &critique);
        assert!(prompt.contains("ORIGINAL PROMPT:"));
        assert!(prompt.contains("YOUR PREVIOUS RESPONSE:"));
        assert!(prompt.contains("Too brief"));
        assert!(prompt.contains("Add more detail"));
    }
}
