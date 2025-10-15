//! Data Quality API client for Schlep-engine.

use serde_json::Value;

use crate::client::SchlepClient;
use crate::error::Result;
use crate::types::{QualityAssessmentResponse, QualityRuleResponse, ValidationResultResponse};

/// Client for the Data Quality API.
///
/// Provides methods for assessing data quality, creating quality rules,
/// and validating data against quality standards.
pub struct QualityClient<'a> {
    client: &'a SchlepClient,
}

impl<'a> QualityClient<'a> {
    /// Create a new Data Quality API client.
    pub fn new(client: &'a SchlepClient) -> Self {
        Self { client }
    }

    /// Assess data quality for a processing job.
    ///
    /// # Arguments
    ///
    /// * `job_id` - Data processing job identifier
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let assessment = client.quality()
    ///     .assess_quality("job_123").await?;
    /// println!("Quality score: {}", assessment.quality_score);
    /// # Ok(())
    /// # }
    /// ```
    pub async fn assess_quality(&self, job_id: &str) -> Result<QualityAssessmentResponse> {
        self.client
            .get(&format!("/quality/assess/{}", job_id))
            .await
    }

    /// Create a quality rule.
    ///
    /// # Arguments
    ///
    /// * `rule` - Rule definition
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # use serde_json::json;
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let rule = json!({
    ///     "name": "Email Validation",
    ///     "type": "format",
    ///     "column": "email",
    ///     "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
    /// });
    /// let created = client.quality().create_rule(rule).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn create_rule(&self, rule: Value) -> Result<QualityRuleResponse> {
        self.client.post("/quality/rules", rule).await
    }

    /// Validate data against quality rules.
    ///
    /// # Arguments
    ///
    /// * `job_id` - Data processing job identifier
    /// * `rules` - List of rule IDs to apply
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// # use schlep_engine::{SchlepClient, Result};
    /// # #[tokio::main]
    /// # async fn main() -> Result<()> {
    /// # let client = SchlepClient::new("your-api-key")?;
    /// let rules = vec!["rule_1".to_string(), "rule_2".to_string()];
    /// let validation = client.quality()
    ///     .validate_data("job_123", rules).await?;
    /// if validation.passed {
    ///     println!("All validations passed!");
    /// }
    /// # Ok(())
    /// # }
    /// ```
    pub async fn validate_data(
        &self,
        job_id: &str,
        rules: Vec<String>,
    ) -> Result<ValidationResultResponse> {
        let body = serde_json::json!({
            "job_id": job_id,
            "rules": rules
        });

        self.client.post("/quality/validate", body).await
    }
}
