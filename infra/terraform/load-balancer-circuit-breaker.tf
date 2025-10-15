# ======================================================================================
# Advanced Load Balancing and Circuit Breaker Infrastructure for Schlep Engine
# Designed for <100ms response times with intelligent request routing and failover
# ======================================================================================

# Application Load Balancer with Advanced Configuration
resource "aws_lb" "realtime_alb" {
  name               = "schlep-engine-realtime-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.realtime_alb.id]
  subnets            = aws_subnet.public[*].id
  
  # Performance optimizations
  enable_deletion_protection = var.environment == "production" ? true : false
  enable_http2              = true
  enable_cross_zone_load_balancing = true
  idle_timeout              = 30  # Reduced for real-time workloads
  
  # Access logging for monitoring
  access_logs {
    bucket  = aws_s3_bucket.logs.bucket
    prefix  = "realtime-alb-logs"
    enabled = true
  }
  
  # Connection draining
  enable_waf_fail_open = false
  
  tags = {
    Name        = "schlep-engine-realtime-alb"
    Environment = var.environment
    Purpose     = "real-time-load-balancing"
  }
}

# Target Group for Real-Time API with Health Checks
resource "aws_lb_target_group" "realtime_api" {
  name     = "schlep-engine-realtime-api"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id
  
  # Health check configuration optimized for speed
  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 2   # Fast timeout
    interval            = 10  # Frequent checks
    path                = "/health/ready"
    matcher             = "200"
    port                = "traffic-port"
    protocol            = "HTTP"
  }
  
  # Load balancing algorithm
  load_balancing_algorithm_type = "least_outstanding_requests"
  
  # Stickiness disabled for better load distribution
  stickiness {
    enabled = false
    type    = "lb_cookie"
  }
  
  # Target group attributes for performance
  target_type = "ip"
  
  # Deregistration delay for fast failover
  deregistration_delay = 30
  
  tags = {
    Name = "schlep-engine-realtime-api-tg"
    Purpose = "real-time-api"
  }
}

# Target Group for Cache Services
resource "aws_lb_target_group" "cache_services" {
  name     = "schlep-engine-cache-services"
  port     = 8080
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id
  
  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 3
    interval            = 15
    path                = "/health"
    matcher             = "200"
    port                = "traffic-port"
    protocol            = "HTTP"
  }
  
  load_balancing_algorithm_type = "round_robin"
  target_type = "ip"
  deregistration_delay = 15  # Faster for cache services
  
  tags = {
    Name = "schlep-engine-cache-services-tg"
    Purpose = "cache-layer"
  }
}

# Listener for HTTPS with SSL termination
resource "aws_lb_listener" "realtime_https" {
  load_balancer_arn = aws_lb.realtime_alb.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = var.manage_dns ? aws_acm_certificate.main[0].arn : var.ssl_certificate_arn
  
  # Default action with circuit breaker logic
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.realtime_api.arn
  }
  
  tags = {
    Name = "schlep-engine-realtime-https-listener"
  }
}

# Listener Rules for Intelligent Routing
resource "aws_lb_listener_rule" "api_routing" {
  listener_arn = aws_lb_listener.realtime_https.arn
  priority     = 100
  
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.realtime_api.arn
  }
  
  condition {
    path_pattern {
      values = ["/api/*", "/v1/*"]
    }
  }
  
  tags = {
    Name = "api-routing-rule"
  }
}

resource "aws_lb_listener_rule" "cache_routing" {
  listener_arn = aws_lb_listener.realtime_https.arn
  priority     = 200
  
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.cache_services.arn
  }
  
  condition {
    path_pattern {
      values = ["/cache/*", "/metrics/*"]
    }
  }
  
  tags = {
    Name = "cache-routing-rule"
  }
}

# Health-based routing with weighted targets
resource "aws_lb_listener_rule" "health_based_routing" {
  listener_arn = aws_lb_listener.realtime_https.arn
  priority     = 50
  
  action {
    type = "forward"
    forward {
      target_group {
        arn    = aws_lb_target_group.realtime_api.arn
        weight = 80  # Primary weight
      }
      target_group {
        arn    = aws_lb_target_group.cache_services.arn
        weight = 20  # Fallback weight
      }
      
      stickiness {
        enabled  = false
        duration = 1
      }
    }
  }
  
  condition {
    host_header {
      values = ["api-realtime.schlep-engine.com"]
    }
  }
  
  tags = {
    Name = "health-based-routing-rule"
  }
}

# HTTP to HTTPS redirect
resource "aws_lb_listener" "realtime_http_redirect" {
  load_balancer_arn = aws_lb.realtime_alb.arn
  port              = "80"
  protocol          = "HTTP"
  
  default_action {
    type = "redirect"
    
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
  
  tags = {
    Name = "schlep-engine-http-redirect"
  }
}

# Security Group for Real-Time ALB
resource "aws_security_group" "realtime_alb" {
  name_prefix = "schlep-engine-realtime-alb-"
  vpc_id      = aws_vpc.main.id
  
  # HTTP ingress
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  # HTTPS ingress
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  # Egress to target groups
  egress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }
  
  egress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }
  
  tags = {
    Name = "schlep-engine-realtime-alb-sg"
  }
}

# Network Load Balancer for Ultra-Low Latency
resource "aws_lb" "realtime_nlb" {
  name               = "schlep-engine-realtime-nlb"
  internal           = false
  load_balancer_type = "network"
  subnets            = aws_subnet.public[*].id
  
  enable_cross_zone_load_balancing = true
  
  tags = {
    Name        = "schlep-engine-realtime-nlb"
    Environment = var.environment
    Purpose     = "ultra-low-latency"
  }
}

# NLB Target Group for Direct TCP Connection
resource "aws_lb_target_group" "realtime_tcp" {
  name     = "schlep-engine-realtime-tcp"
  port     = 8000
  protocol = "TCP"
  vpc_id   = aws_vpc.main.id
  
  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 6
    interval            = 10
    port                = "traffic-port"
    protocol            = "TCP"
  }
  
  target_type = "ip"
  deregistration_delay = 10  # Very fast for TCP
  
  tags = {
    Name = "schlep-engine-realtime-tcp-tg"
  }
}

# NLB Listener for TCP
resource "aws_lb_listener" "realtime_tcp" {
  load_balancer_arn = aws_lb.realtime_nlb.arn
  port              = "8000"
  protocol          = "TCP"
  
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.realtime_tcp.arn
  }
  
  tags = {
    Name = "schlep-engine-realtime-tcp-listener"
  }
}

# Route 53 Health Checks for Circuit Breaker Implementation
resource "aws_route53_health_check" "api_health" {
  count                           = var.manage_dns ? 1 : 0
  fqdn                           = aws_lb.realtime_alb.dns_name
  port                           = 443
  type                           = "HTTPS"
  resource_path                  = "/health/deep"
  failure_threshold              = 2
  request_interval               = 10  # Fast detection
  measure_latency                = true
  cloudwatch_alarm_name          = aws_cloudwatch_metric_alarm.health_check_failed[0].alarm_name
  cloudwatch_alarm_region        = var.aws_region
  insufficient_data_health_status = "Failure"
  
  tags = {
    Name = "schlep-engine-api-health-check"
  }
}

# CloudWatch Alarm for Health Check Failures
resource "aws_cloudwatch_metric_alarm" "health_check_failed" {
  count               = var.manage_dns ? 1 : 0
  alarm_name          = "schlep-engine-api-health-check-failed"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = "60"
  statistic           = "Minimum"
  threshold           = "1"
  alarm_description   = "This metric monitors API health check"
  alarm_actions       = [aws_sns_topic.circuit_breaker_alerts.arn]
  
  dimensions = {
    HealthCheckId = aws_route53_health_check.api_health[0].id
  }
  
  tags = {
    Name = "schlep-engine-health-check-alarm"
  }
}

# SNS Topic for Circuit Breaker Alerts
resource "aws_sns_topic" "circuit_breaker_alerts" {
  name = "schlep-engine-circuit-breaker-alerts"
  
  tags = {
    Name        = "schlep-engine-circuit-breaker-alerts"
    Environment = var.environment
  }
}

# Lambda Function for Circuit Breaker Logic
resource "aws_lambda_function" "circuit_breaker" {
  filename         = "circuit_breaker.zip"
  function_name    = "schlep-engine-circuit-breaker"
  role            = aws_iam_role.circuit_breaker_lambda.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.circuit_breaker_zip.output_base64sha256
  runtime         = "python3.9"
  timeout         = 30
  
  environment {
    variables = {
      ALB_ARN = aws_lb.realtime_alb.arn
      SNS_TOPIC_ARN = aws_sns_topic.circuit_breaker_alerts.arn
      FAILURE_THRESHOLD = "5"
      RECOVERY_TIME = "300"  # 5 minutes
    }
  }
  
  tags = {
    Name        = "schlep-engine-circuit-breaker"
    Environment = var.environment
  }
}

# Circuit Breaker Lambda Code
data "archive_file" "circuit_breaker_zip" {
  type        = "zip"
  output_path = "circuit_breaker.zip"
  source {
    content = <<EOF
import json
import boto3
import os
from datetime import datetime, timedelta

def handler(event, context):
    elbv2 = boto3.client('elbv2')
    sns = boto3.client('sns')
    cloudwatch = boto3.client('cloudwatch')
    
    alb_arn = os.environ['ALB_ARN']
    sns_topic = os.environ['SNS_TOPIC_ARN']
    failure_threshold = int(os.environ.get('FAILURE_THRESHOLD', '5'))
    recovery_time = int(os.environ.get('RECOVERY_TIME', '300'))
    
    try:
        # Get target health
        response = elbv2.describe_target_health(
            TargetGroupArn=event['target_group_arn']
        )
        
        unhealthy_targets = [
            target for target in response['TargetHealthDescriptions']
            if target['TargetHealth']['State'] != 'healthy'
        ]
        
        unhealthy_count = len(unhealthy_targets)
        total_targets = len(response['TargetHealthDescriptions'])
        
        # Circuit breaker logic
        if unhealthy_count >= failure_threshold or (total_targets > 0 and unhealthy_count / total_targets > 0.5):
            # Open circuit breaker
            message = f"Circuit breaker OPEN: {unhealthy_count}/{total_targets} targets unhealthy"
            
            # Send alert
            sns.publish(
                TopicArn=sns_topic,
                Message=message,
                Subject="Circuit Breaker Alert - Service Degraded"
            )
            
            # Put custom metric
            cloudwatch.put_metric_data(
                Namespace='SchlepEngine/CircuitBreaker',
                MetricData=[
                    {
                        'MetricName': 'CircuitBreakerState',
                        'Value': 1,  # Open
                        'Unit': 'Count'
                    },
                    {
                        'MetricName': 'UnhealthyTargets',
                        'Value': unhealthy_count,
                        'Unit': 'Count'
                    }
                ]
            )
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'action': 'circuit_open',
                    'unhealthy_targets': unhealthy_count,
                    'total_targets': total_targets
                })
            }
        else:
            # Circuit breaker closed (normal operation)
            cloudwatch.put_metric_data(
                Namespace='SchlepEngine/CircuitBreaker',
                MetricData=[
                    {
                        'MetricName': 'CircuitBreakerState',
                        'Value': 0,  # Closed
                        'Unit': 'Count'
                    }
                ]
            )
            
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'action': 'circuit_closed',
                    'healthy_targets': total_targets - unhealthy_count,
                    'total_targets': total_targets
                })
            }
            
    except Exception as e:
        sns.publish(
            TopicArn=sns_topic,
            Message=f"Circuit breaker function error: {str(e)}",
            Subject="Circuit Breaker Function Error"
        )
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }
EOF
    filename = "index.py"
  }
}

# IAM Role for Circuit Breaker Lambda
resource "aws_iam_role" "circuit_breaker_lambda" {
  name = "schlep-engine-circuit-breaker-lambda-role"
  
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
    Name = "schlep-engine-circuit-breaker-lambda-role"
  }
}

# IAM Policy for Circuit Breaker Lambda
resource "aws_iam_role_policy" "circuit_breaker_lambda_policy" {
  name = "schlep-engine-circuit-breaker-lambda-policy"
  role = aws_iam_role.circuit_breaker_lambda.id
  
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
      },
      {
        Effect = "Allow"
        Action = [
          "elbv2:DescribeTargetHealth",
          "elbv2:DescribeTargetGroups",
          "elbv2:ModifyRule"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.circuit_breaker_alerts.arn
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
      }
    ]
  })
}

# EventBridge Rule for Circuit Breaker Monitoring
resource "aws_cloudwatch_event_rule" "circuit_breaker_schedule" {
  name                = "schlep-engine-circuit-breaker-schedule"
  description         = "Trigger circuit breaker checks"
  schedule_expression = "rate(1 minute)"  # Check every minute
  
  tags = {
    Name = "schlep-engine-circuit-breaker-schedule"
  }
}

# EventBridge Target for Lambda
resource "aws_cloudwatch_event_target" "circuit_breaker_target" {
  rule      = aws_cloudwatch_event_rule.circuit_breaker_schedule.name
  target_id = "CircuitBreakerLambdaTarget"
  arn       = aws_lambda_function.circuit_breaker.arn
  
  input = jsonencode({
    target_group_arn = aws_lb_target_group.realtime_api.arn
  })
}

# Lambda Permission for EventBridge
resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.circuit_breaker.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.circuit_breaker_schedule.arn
}

# CloudWatch Dashboard for Load Balancer Metrics
resource "aws_cloudwatch_dashboard" "load_balancer_performance" {
  dashboard_name = "schlep-engine-load-balancer-performance"
  
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
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.realtime_alb.arn_suffix],
            [".", "RequestCount", ".", "."],
            [".", "HTTPCode_Target_2XX_Count", ".", "."],
            [".", "HTTPCode_Target_4XX_Count", ".", "."],
            [".", "HTTPCode_Target_5XX_Count", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Load Balancer Performance Metrics"
          period  = 60
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["SchlepEngine/CircuitBreaker", "CircuitBreakerState"],
            [".", "UnhealthyTargets"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Circuit Breaker Status"
          period  = 60
        }
      }
    ]
  })
}

# Outputs for Load Balancer Configuration
output "realtime_alb_dns_name" {
  description = "DNS name of the real-time ALB"
  value       = aws_lb.realtime_alb.dns_name
}

output "realtime_nlb_dns_name" {
  description = "DNS name of the real-time NLB"
  value       = aws_lb.realtime_nlb.dns_name
}

output "circuit_breaker_lambda_arn" {
  description = "ARN of the circuit breaker Lambda function"
  value       = aws_lambda_function.circuit_breaker.arn
}

output "target_group_arns" {
  description = "ARNs of the target groups"
  value = {
    api_tg    = aws_lb_target_group.realtime_api.arn
    cache_tg  = aws_lb_target_group.cache_services.arn
    tcp_tg    = aws_lb_target_group.realtime_tcp.arn
  }
}