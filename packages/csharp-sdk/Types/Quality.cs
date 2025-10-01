using System.Text.Json.Serialization;

namespace SchlepEngine.Types;

/// <summary>
/// Response for quality assessment operations.
/// </summary>
public class QualityAssessmentResponse
{
    /// <summary>
    /// Assessment report identifier.
    /// </summary>
    [JsonPropertyName("report_id")]
    public string ReportId { get; set; } = string.Empty;

    /// <summary>
    /// Overall quality score (0-100).
    /// </summary>
    [JsonPropertyName("overall_score")]
    public double OverallScore { get; set; }

    /// <summary>
    /// Quality issues found.
    /// </summary>
    [JsonPropertyName("issues")]
    public List<QualityIssue> Issues { get; set; } = new();

    /// <summary>
    /// Quality metrics by category.
    /// </summary>
    [JsonPropertyName("metrics")]
    public Dictionary<string, double>? Metrics { get; set; }

    /// <summary>
    /// Assessment summary.
    /// </summary>
    [JsonPropertyName("summary")]
    public string? Summary { get; set; }

    /// <summary>
    /// Assessment timestamp.
    /// </summary>
    [JsonPropertyName("assessed_at")]
    public string? AssessedAt { get; set; }
}

/// <summary>
/// Quality issue details.
/// </summary>
public class QualityIssue
{
    /// <summary>
    /// Issue severity (critical, high, medium, low).
    /// </summary>
    [JsonPropertyName("severity")]
    public string Severity { get; set; } = string.Empty;

    /// <summary>
    /// Issue category (completeness, accuracy, consistency, etc.).
    /// </summary>
    [JsonPropertyName("category")]
    public string Category { get; set; } = string.Empty;

    /// <summary>
    /// Issue description.
    /// </summary>
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Affected field or column.
    /// </summary>
    [JsonPropertyName("field")]
    public string? Field { get; set; }

    /// <summary>
    /// Number of records affected.
    /// </summary>
    [JsonPropertyName("affected_count")]
    public int? AffectedCount { get; set; }

    /// <summary>
    /// Recommended action to fix the issue.
    /// </summary>
    [JsonPropertyName("recommendation")]
    public string? Recommendation { get; set; }
}

/// <summary>
/// Response for quality rule operations.
/// </summary>
public class QualityRuleResponse
{
    /// <summary>
    /// Unique rule identifier.
    /// </summary>
    [JsonPropertyName("rule_id")]
    public string RuleId { get; set; } = string.Empty;

    /// <summary>
    /// Rule name.
    /// </summary>
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Rule description.
    /// </summary>
    [JsonPropertyName("description")]
    public string? Description { get; set; }

    /// <summary>
    /// Rule type (completeness, accuracy, consistency, etc.).
    /// </summary>
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// Rule configuration.
    /// </summary>
    [JsonPropertyName("config")]
    public object? Config { get; set; }

    /// <summary>
    /// Rule status (active, inactive).
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Rule creation timestamp.
    /// </summary>
    [JsonPropertyName("created_at")]
    public string? CreatedAt { get; set; }
}

/// <summary>
/// Response for validation operations.
/// </summary>
public class ValidationResultResponse
{
    /// <summary>
    /// Overall validation result (passed or failed).
    /// </summary>
    [JsonPropertyName("passed")]
    public bool Passed { get; set; }

    /// <summary>
    /// Validation results by rule.
    /// </summary>
    [JsonPropertyName("results")]
    public List<RuleValidationResult> Results { get; set; } = new();

    /// <summary>
    /// Total number of rules evaluated.
    /// </summary>
    [JsonPropertyName("rules_evaluated")]
    public int RulesEvaluated { get; set; }

    /// <summary>
    /// Number of rules passed.
    /// </summary>
    [JsonPropertyName("rules_passed")]
    public int RulesPassed { get; set; }

    /// <summary>
    /// Number of rules failed.
    /// </summary>
    [JsonPropertyName("rules_failed")]
    public int RulesFailed { get; set; }

    /// <summary>
    /// Validation timestamp.
    /// </summary>
    [JsonPropertyName("validated_at")]
    public string? ValidatedAt { get; set; }
}

/// <summary>
/// Validation result for a single rule.
/// </summary>
public class RuleValidationResult
{
    /// <summary>
    /// Rule identifier.
    /// </summary>
    [JsonPropertyName("rule_id")]
    public string RuleId { get; set; } = string.Empty;

    /// <summary>
    /// Rule name.
    /// </summary>
    [JsonPropertyName("rule_name")]
    public string RuleName { get; set; } = string.Empty;

    /// <summary>
    /// Whether rule passed.
    /// </summary>
    [JsonPropertyName("passed")]
    public bool Passed { get; set; }

    /// <summary>
    /// Failure message if rule failed.
    /// </summary>
    [JsonPropertyName("message")]
    public string? Message { get; set; }

    /// <summary>
    /// Number of violations found.
    /// </summary>
    [JsonPropertyName("violation_count")]
    public int? ViolationCount { get; set; }
}
