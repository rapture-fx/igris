# ======================================================================================
# Database Real-Time Optimization Configuration for Schlep Engine
# Optimized for <100ms query response times with advanced indexing and connection pooling
# ======================================================================================

# Enhanced DB Parameter Group for Real-Time Performance
resource "aws_db_parameter_group" "realtime_optimized" {
  family = "postgres15"
  name   = "schlep-engine-realtime-db-params"
  
  # Connection and Memory Optimization
  parameter {
    name  = "max_connections"
    value = "500"  # Increased for high concurrency
  }
  
  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/4}"  # 25% of RAM for buffer cache
  }
  
  parameter {
    name  = "effective_cache_size"
    value = "{DBInstanceClassMemory*3/4}"  # 75% of RAM assumption
  }
  
  parameter {
    name  = "work_mem"
    value = "32MB"  # Optimized for complex queries
  }
  
  parameter {
    name  = "maintenance_work_mem"
    value = "1GB"  # For faster index operations
  }
  
  # Query Performance Optimization
  parameter {
    name  = "random_page_cost"
    value = "1.1"  # SSD optimization
  }
  
  parameter {
    name  = "seq_page_cost"
    value = "1.0"
  }
  
  parameter {
    name  = "effective_io_concurrency"
    value = "200"  # SSD optimization
  }
  
  parameter {
    name  = "max_worker_processes"
    value = "16"
  }
  
  parameter {
    name  = "max_parallel_workers_per_gather"
    value = "4"
  }
  
  parameter {
    name  = "max_parallel_workers"
    value = "16"
  }
  
  parameter {
    name  = "max_parallel_maintenance_workers"
    value = "4"
  }
  
  # Checkpoint and WAL Optimization
  parameter {
    name  = "checkpoint_completion_target"
    value = "0.9"
  }
  
  parameter {
    name  = "wal_buffers"
    value = "16MB"
  }
  
  parameter {
    name  = "checkpoint_timeout"
    value = "900"  # 15 minutes
  }
  
  parameter {
    name  = "max_wal_size"
    value = "4GB"
  }
  
  parameter {
    name  = "min_wal_size"
    value = "1GB"
  }
  
  # Query Planning Optimization
  parameter {
    name  = "default_statistics_target"
    value = "500"  # Improved query planning
  }
  
  parameter {
    name  = "constraint_exclusion"
    value = "partition"
  }
  
  # Logging for Performance Monitoring
  parameter {
    name  = "log_statement"
    value = "none"  # Disabled for performance, use pg_stat_statements instead
  }
  
  parameter {
    name  = "log_min_duration_statement"
    value = "100"  # Log queries > 100ms
  }
  
  parameter {
    name  = "log_checkpoints"
    value = "1"
  }
  
  parameter {
    name  = "log_lock_waits"
    value = "1"
  }
  
  parameter {
    name  = "deadlock_timeout"
    value = "1000"  # 1 second
  }
  
  # Extensions for Performance
  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements,pg_hint_plan,auto_explain"
  }
  
  parameter {
    name  = "pg_stat_statements.max"
    value = "10000"
  }
  
  parameter {
    name  = "pg_stat_statements.track"
    value = "all"
  }
  
  parameter {
    name  = "auto_explain.log_min_duration"
    value = "100"  # Auto-explain slow queries
  }
  
  parameter {
    name  = "auto_explain.log_analyze"
    value = "1"
  }
  
  parameter {
    name  = "auto_explain.log_buffers"
    value = "1"
  }
  
  # Background Writer Optimization
  parameter {
    name  = "bgwriter_delay"
    value = "200"  # 200ms
  }
  
  parameter {
    name  = "bgwriter_lru_maxpages"
    value = "100"
  }
  
  parameter {
    name  = "bgwriter_lru_multiplier"
    value = "2.0"
  }
  
  tags = {
    Name = "schlep-engine-realtime-db-params"
    Purpose = "real-time-optimization"
  }
}

# High-Performance Primary Database Instance
resource "aws_db_instance" "realtime_primary" {
  # Basic Configuration
  identifier     = "schlep-engine-realtime-primary"
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = "db.r6g.2xlarge"  # Memory-optimized for performance
  
  # Storage Configuration - High Performance
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.rds.arn
  
  # Performance Optimization
  iops                = 12000  # High IOPS for real-time performance
  storage_throughput  = 500    # High throughput
  
  # Database Configuration
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432
  
  # Network Configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds_realtime.id]
  publicly_accessible    = false
  
  # Backup Configuration - Optimized for performance
  backup_retention_period = 7  # Reduced for performance
  backup_window          = "03:00-03:30"  # Short window
  maintenance_window     = "sun:03:30-sun:04:00"
  
  # Monitoring and Performance
  monitoring_interval          = 15  # High frequency monitoring
  monitoring_role_arn         = aws_iam_role.rds_enhanced_monitoring.arn
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  
  # Security
  deletion_protection = var.environment == "production" ? true : false
  skip_final_snapshot = var.environment == "production" ? false : true
  final_snapshot_identifier = var.environment == "production" ? "${var.db_name}-realtime-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null
  
  # Enable automated minor version upgrades
  auto_minor_version_upgrade = true
  
  # Use real-time optimized parameter group
  parameter_group_name = aws_db_parameter_group.realtime_optimized.name
  
  tags = {
    Name        = "schlep-engine-realtime-primary"
    Environment = var.environment
    Purpose     = "real-time-primary"
  }
}

# Read Replicas for Query Distribution (Real-Time Optimized)
resource "aws_db_instance" "realtime_read_replica_1" {
  identifier             = "schlep-engine-realtime-read-1"
  replicate_source_db    = aws_db_instance.realtime_primary.identifier
  instance_class         = "db.r6g.xlarge"  # Slightly smaller for read workloads
  publicly_accessible    = false
  availability_zone      = data.aws_availability_zones.available.names[0]
  
  # Performance optimization for reads
  performance_insights_enabled = true
  monitoring_interval          = 15
  monitoring_role_arn         = aws_iam_role.rds_enhanced_monitoring.arn
  
  # Auto scaling storage
  max_allocated_storage = var.db_max_allocated_storage
  
  # Storage optimization
  iops = 8000
  storage_throughput = 300
  
  tags = {
    Name        = "schlep-engine-realtime-read-replica-1"
    Environment = var.environment
    Purpose     = "real-time-read-scaling"
    AZ          = data.aws_availability_zones.available.names[0]
  }
}

resource "aws_db_instance" "realtime_read_replica_2" {
  identifier             = "schlep-engine-realtime-read-replica-2"
  replicate_source_db    = aws_db_instance.realtime_primary.identifier
  instance_class         = "db.r6g.xlarge"
  publicly_accessible    = false
  availability_zone      = data.aws_availability_zones.available.names[1]
  
  performance_insights_enabled = true
  monitoring_interval          = 15
  monitoring_role_arn         = aws_iam_role.rds_enhanced_monitoring.arn
  
  max_allocated_storage = var.db_max_allocated_storage
  iops = 8000
  storage_throughput = 300
  
  tags = {
    Name        = "schlep-engine-realtime-read-replica-2"
    Environment = var.environment
    Purpose     = "real-time-read-scaling"
    AZ          = data.aws_availability_zones.available.names[1]
  }
}

# Dedicated Read Replica for Analytics (Separate from Real-Time)
resource "aws_db_instance" "analytics_read_replica" {
  identifier             = "schlep-engine-analytics-read"
  replicate_source_db    = aws_db_instance.realtime_primary.identifier
  instance_class         = "db.r6g.large"  # Smaller for analytics workloads
  publicly_accessible    = false
  availability_zone      = data.aws_availability_zones.available.names[2]
  
  performance_insights_enabled = true
  monitoring_interval          = 60  # Less frequent monitoring
  monitoring_role_arn         = aws_iam_role.rds_enhanced_monitoring.arn
  
  max_allocated_storage = var.db_max_allocated_storage
  
  tags = {
    Name        = "schlep-engine-analytics-read-replica"
    Environment = var.environment
    Purpose     = "analytics-workload"
  }
}

# Security Group for Real-Time Database
resource "aws_security_group" "rds_realtime" {
  name_prefix = "schlep-engine-rds-realtime-"
  vpc_id      = aws_vpc.main.id
  
  # Allow connections from EKS nodes
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }
  
  # Allow connections from connection pooler
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.pgbouncer.id]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "schlep-engine-rds-realtime-sg"
  }
}

# Security Group for PgBouncer Connection Pooler
resource "aws_security_group" "pgbouncer" {
  name_prefix = "schlep-engine-pgbouncer-"
  vpc_id      = aws_vpc.main.id
  
  # Allow connections from EKS nodes
  ingress {
    from_port       = 6432
    to_port         = 6432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }
  
  # Allow health checks
  ingress {
    from_port       = 8080
    to_port         = 8080
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
    Name = "schlep-engine-pgbouncer-sg"
  }
}

# RDS Proxy for Connection Pooling and Failover
resource "aws_db_proxy" "realtime_proxy" {
  name                   = "schlep-engine-realtime-proxy"
  engine_family         = "POSTGRESQL"
  auth {
    auth_scheme = "SECRETS"
    secret_arn  = aws_secretsmanager_secret.db_credentials.arn
  }
  
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_subnet_ids         = aws_subnet.private[*].id
  require_tls            = true
  
  # Connection pooling configuration
  idle_client_timeout    = 300   # 5 minutes
  max_connections_percent = 90   # Use 90% of database connections
  max_idle_connections_percent = 50
  
  target {
    db_instance_identifier = aws_db_instance.realtime_primary.identifier
  }
  
  depends_on = [
    aws_secretsmanager_secret_version.db_credentials
  ]
  
  tags = {
    Name        = "schlep-engine-realtime-proxy"
    Environment = var.environment
    Purpose     = "connection-pooling"
  }
}

# RDS Proxy Target Group for Read Replicas
resource "aws_db_proxy_default_target_group" "realtime_read_group" {
  db_proxy_name = aws_db_proxy.realtime_proxy.name
  
  connection_pool_config {
    connection_borrow_timeout    = 120
    init_query                  = "SET search_path TO public"
    max_connections_percent     = 90
    max_idle_connections_percent = 50
    session_pinning_filters     = ["EXCLUDE_VARIABLE_SETS"]
  }
}

# Secrets Manager for Database Credentials
resource "aws_secretsmanager_secret" "db_credentials" {
  name = "schlep-engine/realtime-db-credentials"
  
  tags = {
    Name        = "schlep-engine-realtime-db-credentials"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password
  })
}

# IAM Role for RDS Proxy
resource "aws_iam_role" "rds_proxy" {
  name = "schlep-engine-rds-proxy-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
      }
    ]
  })
  
  tags = {
    Name = "schlep-engine-rds-proxy-role"
  }
}

resource "aws_iam_role_policy" "rds_proxy_policy" {
  name = "schlep-engine-rds-proxy-policy"
  role = aws_iam_role.rds_proxy.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = aws_secretsmanager_secret.db_credentials.arn
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}

# CloudWatch Alarms for Real-Time Database Performance
resource "aws_cloudwatch_metric_alarm" "db_cpu_high" {
  alarm_name          = "schlep-engine-realtime-db-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "60"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors RDS CPU utilization"
  alarm_actions       = [aws_sns_topic.db_alerts.arn]
  
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.realtime_primary.identifier
  }
  
  tags = {
    Name = "schlep-engine-realtime-db-cpu-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "db_connections_high" {
  alarm_name          = "schlep-engine-realtime-db-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "60"
  statistic           = "Average"
  threshold           = "400"  # 80% of max_connections
  alarm_description   = "This metric monitors RDS connection count"
  alarm_actions       = [aws_sns_topic.db_alerts.arn]
  
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.realtime_primary.identifier
  }
  
  tags = {
    Name = "schlep-engine-realtime-db-connections-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "db_read_latency_high" {
  alarm_name          = "schlep-engine-realtime-db-read-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "ReadLatency"
  namespace           = "AWS/RDS"
  period              = "60"
  statistic           = "Average"
  threshold           = "0.05"  # 50ms
  alarm_description   = "This metric monitors RDS read latency"
  alarm_actions       = [aws_sns_topic.db_alerts.arn]
  
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.realtime_primary.identifier
  }
  
  tags = {
    Name = "schlep-engine-realtime-db-read-latency-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "db_write_latency_high" {
  alarm_name          = "schlep-engine-realtime-db-write-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "WriteLatency"
  namespace           = "AWS/RDS"
  period              = "60"
  statistic           = "Average"
  threshold           = "0.05"  # 50ms
  alarm_description   = "This metric monitors RDS write latency"
  alarm_actions       = [aws_sns_topic.db_alerts.arn]
  
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.realtime_primary.identifier
  }
  
  tags = {
    Name = "schlep-engine-realtime-db-write-latency-alarm"
  }
}

# SNS Topic for Database Alerts
resource "aws_sns_topic" "db_alerts" {
  name = "schlep-engine-realtime-db-alerts"
  
  tags = {
    Name        = "schlep-engine-realtime-db-alerts"
    Environment = var.environment
  }
}

# Outputs for Database Configuration
output "realtime_primary_endpoint" {
  description = "Real-time optimized primary database endpoint"
  value       = aws_db_instance.realtime_primary.endpoint
  sensitive   = true
}

output "realtime_read_replica_endpoints" {
  description = "Real-time read replica endpoints"
  value = [
    aws_db_instance.realtime_read_replica_1.endpoint,
    aws_db_instance.realtime_read_replica_2.endpoint
  ]
  sensitive = true
}

output "analytics_read_replica_endpoint" {
  description = "Analytics read replica endpoint"
  value       = aws_db_instance.analytics_read_replica.endpoint
  sensitive   = true
}

output "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint for connection pooling"
  value       = aws_db_proxy.realtime_proxy.endpoint
  sensitive   = true
}