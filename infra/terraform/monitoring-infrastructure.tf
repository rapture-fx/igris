# ======================================================================================
# Comprehensive Monitoring Infrastructure for Schlep Engine
# AWS CloudWatch, X-Ray, and monitoring services with alerts and dashboards
# ======================================================================================

# CloudWatch Log Groups for Application Components
resource "aws_cloudwatch_log_group" "application_logs" {
  name              = "/aws/application/schlep-engine"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.cloudwatch.arn

  tags = {
    Name        = "schlep-engine-application-logs"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "circuit_breaker_logs" {
  name              = "/aws/circuit-breaker/schlep-engine"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.cloudwatch.arn

  tags = {
    Name        = "schlep-engine-circuit-breaker-logs"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "reliability_logs" {
  name              = "/aws/reliability/schlep-engine"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.cloudwatch.arn

  tags = {
    Name        = "schlep-engine-reliability-logs"
    Environment = var.environment
  }
}

# Custom CloudWatch Metrics for Circuit Breakers
resource "aws_cloudwatch_metric_alarm" "circuit_breaker_open" {
  alarm_name          = "schlep-engine-circuit-breaker-open"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "CircuitBreakerState"
  namespace           = "SchlepEngine/CircuitBreaker"
  period              = "60"
  statistic           = "Maximum"
  threshold           = "1"
  alarm_description   = "This metric monitors circuit breaker state"
  alarm_actions       = [aws_sns_topic.circuit_breaker_alerts.arn]

  dimensions = {
    Service = "schlep-engine-api"
  }

  tags = {
    Name        = "schlep-engine-circuit-breaker-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "high_failure_rate" {
  alarm_name          = "schlep-engine-high-failure-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "FailureRate"
  namespace           = "SchlepEngine/CircuitBreaker"
  period              = "300"
  statistic           = "Average"
  threshold           = "0.05"
  alarm_description   = "High failure rate detected"
  alarm_actions       = [aws_sns_topic.circuit_breaker_alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    Service = "schlep-engine-api"
  }

  tags = {
    Name        = "schlep-engine-failure-rate-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "retry_exhausted" {
  alarm_name          = "schlep-engine-retry-exhausted"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "RetryAttemptsExhausted"
  namespace           = "SchlepEngine/Reliability"
  period              = "600"
  statistic           = "Sum"
  threshold           = "50"
  alarm_description   = "High number of retry attempts exhausted"
  alarm_actions       = [aws_sns_topic.circuit_breaker_alerts.arn]

  dimensions = {
    Service = "schlep-engine-api"
  }

  tags = {
    Name        = "schlep-engine-retry-exhausted-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "dead_letter_queue_growth" {
  alarm_name          = "schlep-engine-dlq-growth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DeadLetterQueueItems"
  namespace           = "SchlepEngine/Reliability"
  period              = "900"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "Dead letter queue growing rapidly"
  alarm_actions       = [aws_sns_topic.circuit_breaker_alerts.arn]

  dimensions = {
    Service = "schlep-engine-api"
  }

  tags = {
    Name        = "schlep-engine-dlq-growth-alarm"
    Environment = var.environment
  }
}

# RDS Performance Insights and Monitoring
resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "schlep-engine-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "RDS CPU utilization is high"
  alarm_actions       = [aws_sns_topic.infrastructure_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = {
    Name        = "schlep-engine-rds-cpu-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_connections_high" {
  alarm_name          = "schlep-engine-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "40"
  alarm_description   = "RDS connection count is high"
  alarm_actions       = [aws_sns_topic.infrastructure_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = {
    Name        = "schlep-engine-rds-connections-alarm"
    Environment = var.environment
  }
}

# ElastiCache Redis Monitoring
resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  alarm_name          = "schlep-engine-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "75"
  alarm_description   = "Redis CPU utilization is high"
  alarm_actions       = [aws_sns_topic.infrastructure_alerts.arn]

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.main.id}-001"
  }

  tags = {
    Name        = "schlep-engine-redis-cpu-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_memory_high" {
  alarm_name          = "schlep-engine-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "Redis memory utilization is high"
  alarm_actions       = [aws_sns_topic.infrastructure_alerts.arn]

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.main.id}-001"
  }

  tags = {
    Name        = "schlep-engine-redis-memory-alarm"
    Environment = var.environment
  }
}

# Application Load Balancer Monitoring
resource "aws_cloudwatch_metric_alarm" "alb_response_time_high" {
  alarm_name          = "schlep-engine-alb-response-time-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "1"
  alarm_description   = "ALB response time is high"
  alarm_actions       = [aws_sns_topic.performance_alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = {
    Name        = "schlep-engine-alb-response-time-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_unhealthy_targets" {
  alarm_name          = "schlep-engine-alb-unhealthy-targets"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Maximum"
  threshold           = "0"
  alarm_description   = "Unhealthy targets detected behind ALB"
  alarm_actions       = [aws_sns_topic.infrastructure_alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = {
    Name        = "schlep-engine-alb-unhealthy-targets-alarm"
    Environment = var.environment
  }
}

# EKS Cluster Monitoring
resource "aws_cloudwatch_metric_alarm" "eks_node_cpu_high" {
  alarm_name          = "schlep-engine-eks-node-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "node_cpu_utilization_total"
  namespace           = "ContainerInsights"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "EKS node CPU utilization is high"
  alarm_actions       = [aws_sns_topic.infrastructure_alerts.arn]

  dimensions = {
    ClusterName = aws_eks_cluster.main.name
  }

  tags = {
    Name        = "schlep-engine-eks-cpu-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "eks_pod_restart_high" {
  alarm_name          = "schlep-engine-eks-pod-restart-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "pod_number_of_container_restarts"
  namespace           = "ContainerInsights"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "High number of pod restarts detected"
  alarm_actions       = [aws_sns_topic.infrastructure_alerts.arn]

  dimensions = {
    ClusterName = aws_eks_cluster.main.name
  }

  tags = {
    Name        = "schlep-engine-eks-restart-alarm"
    Environment = var.environment
  }
}

# SNS Topics for Different Alert Categories
resource "aws_sns_topic" "infrastructure_alerts" {
  name = "schlep-engine-infrastructure-alerts"

  tags = {
    Name        = "schlep-engine-infrastructure-alerts"
    Environment = var.environment
  }
}

resource "aws_sns_topic" "performance_alerts" {
  name = "schlep-engine-performance-alerts"

  tags = {
    Name        = "schlep-engine-performance-alerts"
    Environment = var.environment
  }
}

resource "aws_sns_topic" "security_alerts" {
  name = "schlep-engine-security-alerts"

  tags = {
    Name        = "schlep-engine-security-alerts"
    Environment = var.environment
  }
}

# SNS Topic Subscriptions for Email Alerts
resource "aws_sns_topic_subscription" "circuit_breaker_email" {
  count     = length(var.alert_email_addresses)
  topic_arn = aws_sns_topic.circuit_breaker_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email_addresses[count.index]
}

resource "aws_sns_topic_subscription" "infrastructure_email" {
  count     = length(var.alert_email_addresses)
  topic_arn = aws_sns_topic.infrastructure_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email_addresses[count.index]
}

resource "aws_sns_topic_subscription" "performance_email" {
  count     = length(var.alert_email_addresses)
  topic_arn = aws_sns_topic.performance_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email_addresses[count.index]
}

# SNS Topic Subscriptions for Slack Integration
resource "aws_sns_topic_subscription" "circuit_breaker_slack" {
  count     = var.slack_webhook_url != "" ? 1 : 0
  topic_arn = aws_sns_topic.circuit_breaker_alerts.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.slack_notifier[0].arn
}

# Lambda function for Slack notifications
resource "aws_lambda_function" "slack_notifier" {
  count         = var.slack_webhook_url != "" ? 1 : 0
  filename      = "slack_notifier.zip"
  function_name = "schlep-engine-slack-notifier"
  role          = aws_iam_role.slack_notifier_lambda[0].arn
  handler       = "index.handler"
  runtime       = "python3.9"
  timeout       = 30

  source_code_hash = data.archive_file.slack_notifier_zip[0].output_base64sha256

  environment {
    variables = {
      SLACK_WEBHOOK_URL = var.slack_webhook_url
    }
  }

  tags = {
    Name        = "schlep-engine-slack-notifier"
    Environment = var.environment
  }
}

# Lambda code for Slack notifications
data "archive_file" "slack_notifier_zip" {
  count       = var.slack_webhook_url != "" ? 1 : 0
  type        = "zip"
  output_path = "slack_notifier.zip"
  
  source {
    content = <<EOF
import json
import urllib3
import os

def handler(event, context):
    webhook_url = os.environ['SLACK_WEBHOOK_URL']
    
    http = urllib3.PoolManager()
    
    # Parse SNS message
    sns_message = json.loads(event['Records'][0]['Sns']['Message'])
    
    # Extract alarm details
    alarm_name = sns_message.get('AlarmName', 'Unknown')
    alarm_description = sns_message.get('AlarmDescription', 'No description')
    new_state = sns_message.get('NewStateValue', 'UNKNOWN')
    reason = sns_message.get('NewStateReason', 'No reason provided')
    
    # Determine color based on alarm state
    color = {
        'ALARM': '#ff0000',
        'OK': '#00ff00',
        'INSUFFICIENT_DATA': '#ffaa00'
    }.get(new_state, '#808080')
    
    # Create Slack message
    slack_message = {
        'attachments': [
            {
                'color': color,
                'title': f'🚨 {alarm_name}',
                'text': alarm_description,
                'fields': [
                    {
                        'title': 'State',
                        'value': new_state,
                        'short': True
                    },
                    {
                        'title': 'Reason',
                        'value': reason,
                        'short': False
                    }
                ],
                'timestamp': int(sns_message.get('StateChangeTime', '0'))
            }
        ]
    }
    
    # Send to Slack
    response = http.request(
        'POST',
        webhook_url,
        body=json.dumps(slack_message),
        headers={'Content-Type': 'application/json'}
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps('Message sent to Slack')
    }
EOF
    filename = "index.py"
  }
}

# IAM role for Slack notifier Lambda
resource "aws_iam_role" "slack_notifier_lambda" {
  count = var.slack_webhook_url != "" ? 1 : 0
  name  = "schlep-engine-slack-notifier-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "schlep-engine-slack-notifier-lambda-role"
  }
}

# IAM policy for Slack notifier Lambda
resource "aws_iam_role_policy" "slack_notifier_lambda_policy" {
  count = var.slack_webhook_url != "" ? 1 : 0
  name  = "schlep-engine-slack-notifier-lambda-policy"
  role  = aws_iam_role.slack_notifier_lambda[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:*"
      }
    ]
  })
}

# Lambda permission for SNS
resource "aws_lambda_permission" "allow_sns_slack" {
  count         = var.slack_webhook_url != "" ? 1 : 0
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.slack_notifier[0].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.circuit_breaker_alerts.arn
}

# X-Ray for Distributed Tracing
resource "aws_xray_sampling_rule" "schlep_engine_sampling" {
  rule_name      = "SchlePEngineTracing"
  priority       = 1000
  version        = 1
  reservoir_size = 2
  fixed_rate     = 0.1
  url_path       = "/api/*"
  host           = "*"
  http_method    = "*"
  service_name   = "schlep-engine-api"
  service_type   = "*"
  resource_arn   = "*"

  tags = {
    Name        = "schlep-engine-xray-sampling"
    Environment = var.environment
  }
}

# CloudWatch Container Insights for EKS
resource "aws_cloudwatch_log_group" "container_insights_application" {
  name              = "/aws/containerinsights/${aws_eks_cluster.main.name}/application"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.cloudwatch.arn

  tags = {
    Name        = "schlep-engine-container-insights-application"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "container_insights_dataplane" {
  name              = "/aws/containerinsights/${aws_eks_cluster.main.name}/dataplane"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.cloudwatch.arn

  tags = {
    Name        = "schlep-engine-container-insights-dataplane"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "container_insights_host" {
  name              = "/aws/containerinsights/${aws_eks_cluster.main.name}/host"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.cloudwatch.arn

  tags = {
    Name        = "schlep-engine-container-insights-host"
    Environment = var.environment
  }
}

# CloudWatch Dashboard for Comprehensive Monitoring
resource "aws_cloudwatch_dashboard" "schlep_engine_comprehensive" {
  dashboard_name = "schlep-engine-comprehensive-monitoring"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["SchlepEngine/CircuitBreaker", "CircuitBreakerState", "Service", "schlep-engine-api"],
            [".", "FailureRate", ".", "."],
            ["SchlepEngine/Reliability", "RetryAttemptsExhausted", ".", "."],
            [".", "DeadLetterQueueItems", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Circuit Breaker and Reliability Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.main.arn_suffix],
            [".", "RequestCount", ".", "."],
            [".", "HTTPCode_Target_2XX_Count", ".", "."],
            [".", "HTTPCode_Target_4XX_Count", ".", "."],
            [".", "HTTPCode_Target_5XX_Count", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Application Load Balancer Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.main.id],
            [".", "DatabaseConnections", ".", "."],
            [".", "ReadLatency", ".", "."],
            [".", "WriteLatency", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "RDS PostgreSQL Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 6
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", "CacheClusterId", "${aws_elasticache_replication_group.main.id}-001"],
            [".", "DatabaseMemoryUsagePercentage", ".", "."],
            [".", "CacheHitRate", ".", "."],
            [".", "Evictions", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Redis ElastiCache Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 6
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["ContainerInsights", "node_cpu_utilization_total", "ClusterName", aws_eks_cluster.main.name],
            [".", "node_memory_utilization_total", ".", "."],
            [".", "pod_number_of_container_restarts", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "EKS Cluster Metrics"
          period  = 300
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 12
        width  = 24
        height = 6

        properties = {
          query   = "SOURCE '/aws/circuit-breaker/schlep-engine'\n| fields @timestamp, @message\n| filter @message like /ERROR/\n| sort @timestamp desc\n| limit 20"
          region  = var.aws_region
          title   = "Recent Circuit Breaker Errors"
          view    = "table"
        }
      }
    ]
  })
}

# Composite Alarms for Complex Scenarios
resource "aws_cloudwatch_composite_alarm" "system_degraded" {
  alarm_name        = "schlep-engine-system-degraded"
  alarm_description = "System is experiencing degraded performance across multiple components"

  actions_enabled = true
  alarm_actions   = [aws_sns_topic.infrastructure_alerts.arn]
  ok_actions      = [aws_sns_topic.infrastructure_alerts.arn]

  alarm_rule = join(" OR ", [
    "ALARM(${aws_cloudwatch_metric_alarm.circuit_breaker_open.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.high_failure_rate.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.alb_response_time_high.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.rds_cpu_high.alarm_name})"
  ])

  tags = {
    Name        = "schlep-engine-system-degraded-composite"
    Environment = var.environment
  }
}

# EventBridge Rules for Custom Event Processing
resource "aws_cloudwatch_event_rule" "circuit_breaker_events" {
  name        = "schlep-engine-circuit-breaker-events"
  description = "Capture circuit breaker state changes"

  event_pattern = jsonencode({
    source      = ["schlep-engine.circuit-breaker"]
    detail-type = ["Circuit Breaker State Change"]
    detail = {
      state = ["OPEN", "CLOSED", "HALF_OPEN"]
    }
  })

  tags = {
    Name        = "schlep-engine-circuit-breaker-events"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_event_target" "circuit_breaker_target" {
  rule      = aws_cloudwatch_event_rule.circuit_breaker_events.name
  target_id = "SendToSNS"
  arn       = aws_sns_topic.circuit_breaker_alerts.arn

  input_transformer {
    input_paths = {
      state   = "$.detail.state"
      service = "$.detail.service"
      time    = "$.detail.timestamp"
    }
    
    input_template = jsonencode({
      AlarmName        = "Circuit Breaker State Change"
      AlarmDescription = "Circuit breaker for service <service> changed to <state> at <time>"
      NewStateValue    = "<state>"
      NewStateReason   = "Circuit breaker state change detected via EventBridge"
    })
  }
}

# Outputs for monitoring infrastructure
output "circuit_breaker_alerts_topic_arn" {
  description = "SNS topic ARN for circuit breaker alerts"
  value       = aws_sns_topic.circuit_breaker_alerts.arn
}

output "infrastructure_alerts_topic_arn" {
  description = "SNS topic ARN for infrastructure alerts"
  value       = aws_sns_topic.infrastructure_alerts.arn
}

output "monitoring_dashboard_url" {
  description = "URL to the comprehensive monitoring dashboard"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.schlep_engine_comprehensive.dashboard_name}"
}

output "xray_service_map_url" {
  description = "URL to X-Ray service map"
  value       = "https://${var.aws_region}.console.aws.amazon.com/xray/home?region=${var.aws_region}#/service-map"
}