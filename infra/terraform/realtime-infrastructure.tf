# ======================================================================================
# Real-Time Infrastructure Architecture for Schlep Engine
# Targeting <100ms response times with multi-tier caching and event streaming
# ======================================================================================

# ElastiCache Redis Cluster for L1 Cache (In-Memory)
resource "aws_elasticache_replication_group" "l1_cache" {
  replication_group_id       = "schlep-engine-l1-cache"
  description                = "L1 Cache - Ultra-low latency in-memory cache"
  
  port                       = 6379
  parameter_group_name       = aws_elasticache_parameter_group.l1_cache.name
  node_type                 = "cache.r7g.xlarge"  # Memory-optimized for speed
  num_cache_clusters        = 3  # Multi-AZ for HA
  
  # Network Configuration
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis_l1.id]
  
  # Performance Optimizations
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                = var.redis_auth_token
  
  # Backup Configuration - Minimal for L1
  snapshot_retention_limit = 1
  snapshot_window         = "03:00-03:30"
  maintenance_window      = "sun:03:30-sun:04:00"
  
  # High Availability
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  tags = {
    Name        = "schlep-engine-l1-cache"
    Environment = var.environment
    CacheLayer  = "L1"
    Purpose     = "ultra-low-latency"
  }
}

# L1 Cache Parameter Group for Ultra-Low Latency
resource "aws_elasticache_parameter_group" "l1_cache" {
  family = "redis7.x"
  name   = "schlep-engine-l1-cache-params"
  
  # Optimize for speed over durability
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lfu"  # Least Frequently Used for hot data
  }
  
  parameter {
    name  = "save"
    value = ""  # Disable persistence for L1 speed
  }
  
  parameter {
    name  = "timeout"
    value = "300"
  }
  
  parameter {
    name  = "tcp-keepalive"
    value = "60"
  }
  
  tags = {
    Name = "schlep-engine-l1-cache-params"
    CacheLayer = "L1"
  }
}

# L2 Cache - Persistent Redis Cluster
resource "aws_elasticache_replication_group" "l2_cache" {
  replication_group_id       = "schlep-engine-l2-cache"
  description                = "L2 Cache - Session and frequently accessed data"
  
  port                       = 6379
  parameter_group_name       = aws_elasticache_parameter_group.l2_cache.name
  node_type                 = "cache.r7g.large"
  num_cache_clusters        = 2
  
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis_l2.id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                = var.redis_auth_token
  
  # L2 has more persistence
  snapshot_retention_limit = 5
  snapshot_window         = "02:00-03:00"
  maintenance_window      = "sun:01:00-sun:02:00"
  
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  tags = {
    Name        = "schlep-engine-l2-cache"
    Environment = var.environment
    CacheLayer  = "L2"
    Purpose     = "session-persistence"
  }
}

# L2 Cache Parameter Group
resource "aws_elasticache_parameter_group" "l2_cache" {
  family = "redis7.x"
  name   = "schlep-engine-l2-cache-params"
  
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }
  
  parameter {
    name  = "save"
    value = "900 1"  # Save after 900 sec if at least 1 key changed
  }
  
  parameter {
    name  = "timeout"
    value = "0"  # No timeout for persistent connections
  }
  
  tags = {
    Name = "schlep-engine-l2-cache-params"
    CacheLayer = "L2"
  }
}

# DynamoDB for L3 Cache (NoSQL)
resource "aws_dynamodb_table" "l3_cache" {
  name           = "schlep-engine-l3-cache"
  billing_mode   = "PAY_PER_REQUEST"  # Auto-scaling for variable workloads
  hash_key       = "cache_key"
  range_key      = "cache_type"
  
  attribute {
    name = "cache_key"
    type = "S"
  }
  
  attribute {
    name = "cache_type"
    type = "S"
  }
  
  attribute {
    name = "ttl"
    type = "N"
  }
  
  # TTL for automatic cleanup
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
  
  # Global Secondary Index for cache type queries
  global_secondary_index {
    name     = "cache-type-index"
    hash_key = "cache_type"
    range_key = "ttl"
    projection_type = "ALL"
  }
  
  # Point-in-time recovery
  point_in_time_recovery {
    enabled = true
  }
  
  # Encryption
  server_side_encryption {
    enabled = true
    kms_key_id = aws_kms_key.dynamodb.arn
  }
  
  tags = {
    Name        = "schlep-engine-l3-cache"
    Environment = var.environment
    CacheLayer  = "L3"
    Purpose     = "warm-cache-nosql"
  }
}

# KMS Key for DynamoDB encryption
resource "aws_kms_key" "dynamodb" {
  description = "KMS key for DynamoDB L3 cache encryption"
  
  tags = {
    Name = "schlep-engine-dynamodb-kms"
  }
}

resource "aws_kms_alias" "dynamodb" {
  name          = "alias/schlep-engine-dynamodb"
  target_key_id = aws_kms_key.dynamodb.key_id
}

# Amazon MSK (Managed Streaming for Kafka) for Event Streaming
resource "aws_msk_cluster" "event_streaming" {
  cluster_name           = "schlep-engine-events"
  kafka_version          = "3.4.0"
  number_of_broker_nodes = 3
  
  broker_node_group_info {
    instance_type   = "kafka.m5.xlarge"
    client_subnets  = aws_subnet.private[*].id
    security_groups = [aws_security_group.msk.id]
    
    storage_info {
      ebs_storage_info {
        volume_size = 100
        provisioned_throughput {
          enabled           = true
          volume_throughput = 250
        }
      }
    }
    
    connectivity_info {
      public_access {
        type = "DISABLED"
      }
      vpc_connectivity {
        client_authentication {
          sasl {
            iam = true
          }
          tls = true
        }
      }
    }
  }
  
  # Encryption settings
  encryption_info {
    encryption_at_rest_kms_key_id = aws_kms_key.msk.arn
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }
  
  # Enhanced monitoring
  open_monitoring {
    prometheus {
      jmx_exporter {
        enabled_in_broker = true
      }
      node_exporter {
        enabled_in_broker = true
      }
    }
  }
  
  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.msk.name
      }
      s3 {
        enabled = true
        bucket  = aws_s3_bucket.logs.bucket
        prefix  = "msk-logs"
      }
    }
  }
  
  tags = {
    Name        = "schlep-engine-event-streaming"
    Environment = var.environment
    Purpose     = "real-time-events"
  }
}

# KMS Key for MSK encryption
resource "aws_kms_key" "msk" {
  description = "KMS key for MSK encryption"
  
  tags = {
    Name = "schlep-engine-msk-kms"
  }
}

resource "aws_kms_alias" "msk" {
  name          = "alias/schlep-engine-msk"
  target_key_id = aws_kms_key.msk.key_id
}

# CloudWatch Log Group for MSK
resource "aws_cloudwatch_log_group" "msk" {
  name              = "/aws/msk/schlep-engine-events"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.cloudwatch.arn
  
  tags = {
    Name = "schlep-engine-msk-logs"
  }
}

# RDS Read Replicas for Query Distribution
resource "aws_db_instance" "read_replica_1" {
  identifier             = "schlep-engine-db-read-1"
  replicate_source_db    = aws_db_instance.main.identifier
  instance_class         = var.db_replica_instance_class
  publicly_accessible    = false
  
  # Performance optimization
  performance_insights_enabled = true
  monitoring_interval          = 60
  monitoring_role_arn         = aws_iam_role.rds_enhanced_monitoring.arn
  
  # Auto scaling storage
  max_allocated_storage = var.db_max_allocated_storage
  
  tags = {
    Name        = "schlep-engine-db-read-replica-1"
    Environment = var.environment
    Purpose     = "read-scaling"
  }
}

resource "aws_db_instance" "read_replica_2" {
  identifier             = "schlep-engine-db-read-2"
  replicate_source_db    = aws_db_instance.main.identifier
  instance_class         = var.db_replica_instance_class
  publicly_accessible    = false
  availability_zone      = data.aws_availability_zones.available.names[1]
  
  performance_insights_enabled = true
  monitoring_interval          = 60
  monitoring_role_arn         = aws_iam_role.rds_enhanced_monitoring.arn
  
  max_allocated_storage = var.db_max_allocated_storage
  
  tags = {
    Name        = "schlep-engine-db-read-replica-2"
    Environment = var.environment
    Purpose     = "read-scaling"
  }
}

# Security Groups for Real-Time Infrastructure
resource "aws_security_group" "redis_l1" {
  name_prefix = "schlep-engine-redis-l1-"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "schlep-engine-redis-l1-sg"
    CacheLayer = "L1"
  }
}

resource "aws_security_group" "redis_l2" {
  name_prefix = "schlep-engine-redis-l2-"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "schlep-engine-redis-l2-sg"
    CacheLayer = "L2"
  }
}

resource "aws_security_group" "msk" {
  name_prefix = "schlep-engine-msk-"
  vpc_id      = aws_vpc.main.id
  
  # Kafka broker communication
  ingress {
    from_port       = 9092
    to_port         = 9092
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }
  
  # Kafka TLS
  ingress {
    from_port       = 9094
    to_port         = 9094
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }
  
  # Zookeeper
  ingress {
    from_port       = 2181
    to_port         = 2181
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }
  
  # JMX monitoring
  ingress {
    from_port       = 11001
    to_port         = 11002
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "schlep-engine-msk-sg"
  }
}

# CloudFront Distribution for Global Content Delivery
resource "aws_cloudfront_distribution" "main" {
  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "ALB-${aws_lb.main.name}"
    
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  
  enabled = true
  
  # Cache behaviors for different content types
  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "ALB-${aws_lb.main.name}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    
    # Optimized for real-time APIs
    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "X-Forwarded-For"]
      
      cookies {
        forward = "none"
      }
    }
    
    # Minimal caching for dynamic content
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 300  # 5 minutes max
  }
  
  # Static assets cache behavior
  ordered_cache_behavior {
    path_pattern           = "/static/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "ALB-${aws_lb.main.name}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
    
    min_ttl     = 31536000  # 1 year
    default_ttl = 31536000
    max_ttl     = 31536000
  }
  
  # Global distribution
  price_class = "PriceClass_All"
  
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  viewer_certificate {
    acm_certificate_arn      = var.manage_dns ? aws_acm_certificate.main[0].arn : null
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
  
  tags = {
    Name        = "schlep-engine-cdn"
    Environment = var.environment
    Purpose     = "global-performance"
  }
}

# Application Auto Scaling for EKS
resource "aws_application_autoscaling_target" "eks_target" {
  max_capacity       = 100
  min_capacity       = 5
  resource_id        = "service/schlep-engine/api"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Auto Scaling Policies
resource "aws_application_autoscaling_policy" "scale_up" {
  name               = "scale-up"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_application_autoscaling_target.eks_target.resource_id
  scalable_dimension = aws_application_autoscaling_target.eks_target.scalable_dimension
  service_namespace  = aws_application_autoscaling_target.eks_target.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 70.0
    
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    
    scale_out_cooldown = 60   # Fast scale out
    scale_in_cooldown  = 300  # Slower scale in
  }
}

# Real-time response time scaling policy
resource "aws_application_autoscaling_policy" "response_time_scaling" {
  name               = "response-time-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_application_autoscaling_target.eks_target.resource_id
  scalable_dimension = aws_application_autoscaling_target.eks_target.scalable_dimension
  service_namespace  = aws_application_autoscaling_target.eks_target.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 80.0  # 80ms target response time
    
    customized_metric_specification {
      metric_name = "ResponseTime"
      namespace   = "AWS/ApplicationELB"
      statistic   = "Average"
      
      dimensions = {
        LoadBalancer = aws_lb.main.arn_suffix
      }
    }
    
    scale_out_cooldown = 30   # Very fast scale out for latency
    scale_in_cooldown  = 180  # Careful scale in
  }
}

# Outputs for Real-Time Infrastructure
output "l1_cache_endpoint" {
  description = "L1 Cache (Redis) endpoint"
  value       = aws_elasticache_replication_group.l1_cache.primary_endpoint_address
  sensitive   = true
}

output "l2_cache_endpoint" {
  description = "L2 Cache (Redis) endpoint"
  value       = aws_elasticache_replication_group.l2_cache.primary_endpoint_address
  sensitive   = true
}

output "l3_cache_table" {
  description = "L3 Cache (DynamoDB) table name"
  value       = aws_dynamodb_table.l3_cache.name
}

output "event_streaming_bootstrap_brokers" {
  description = "MSK Kafka bootstrap brokers"
  value       = aws_msk_cluster.event_streaming.bootstrap_brokers_tls
  sensitive   = true
}

output "read_replica_endpoints" {
  description = "Database read replica endpoints"
  value = [
    aws_db_instance.read_replica_1.endpoint,
    aws_db_instance.read_replica_2.endpoint
  ]
  sensitive = true
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.main.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.main.domain_name
}