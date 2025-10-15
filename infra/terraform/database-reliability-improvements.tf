# ======================================================================================
# Database Reliability Improvements for Schlep Engine
#
# This file contains Terraform configurations to implement the critical database
# reliability improvements identified in the data integrity review.
#
# Implementation Priority: CRITICAL
# ======================================================================================

# ======================================================================================
# POSTGRESQL HIGH AVAILABILITY IMPROVEMENTS
# ======================================================================================

# Update the existing RDS instance to Multi-AZ
resource "aws_db_instance" "main_ha" {
  # This replaces the existing main RDS instance with HA improvements
  count = var.enable_ha_improvements ? 1 : 0
  
  # Basic Configuration (keep existing)
  identifier     = "schlep-engine-db-ha"
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class_ha
  
  # Storage Configuration (enhanced)
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.rds.arn
  iops                 = var.db_iops
  storage_throughput   = var.db_storage_throughput
  
  # Database Configuration
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password
  port     = 5432
  
  # Network Configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds_ha.id]
  publicly_accessible    = false
  
  # HIGH AVAILABILITY CONFIGURATION
  multi_az               = true  # Enable Multi-AZ deployment
  availability_zone      = null  # Let AWS choose for Multi-AZ
  
  # BACKUP CONFIGURATION (Enhanced)
  backup_retention_period   = var.db_backup_retention_period_ha
  backup_window            = "03:00-04:00"
  maintenance_window       = "sun:04:00-sun:05:00"
  copy_tags_to_snapshot    = true
  delete_automated_backups = false
  
  # MONITORING CONFIGURATION (Enhanced)
  monitoring_interval          = 60
  monitoring_role_arn         = aws_iam_role.rds_enhanced_monitoring.arn
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  
  # SECURITY & MAINTENANCE
  deletion_protection    = var.environment == "production" ? true : false
  skip_final_snapshot   = var.environment == "production" ? false : true
  final_snapshot_identifier = var.environment == "production" ? "${var.db_name}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null
  auto_minor_version_upgrade = true
  
  # Parameter group for reliability
  parameter_group_name = aws_db_parameter_group.main_ha[0].name
  
  tags = {
    Name        = "schlep-engine-db-ha"
    Environment = var.environment
    Purpose     = "Primary HA Database"
  }
}

# Enhanced DB Parameter Group for High Availability
resource "aws_db_parameter_group" "main_ha" {
  count  = var.enable_ha_improvements ? 1 : 0
  family = "postgres15"
  name   = "schlep-engine-db-params-ha"
  
  # Performance and reliability parameters
  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements,pg_cron,auto_explain"
  }
  
  parameter {
    name  = "log_statement"
    value = "ddl"  # Log DDL for audit
  }
  
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"  # Log slow queries > 1s
  }
  
  parameter {
    name  = "log_connections"
    value = "1"
  }
  
  parameter {
    name  = "log_disconnections"
    value = "1"
  }
  
  parameter {
    name  = "log_checkpoints"
    value = "1"
  }
  
  parameter {
    name  = "checkpoint_completion_target"
    value = "0.9"
  }
  
  parameter {
    name  = "wal_buffers"
    value = "16MB"
  }
  
  parameter {
    name  = "effective_cache_size"
    value = "{DBInstanceClassMemory*3/4}"
  }
  
  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/4}"
  }
  
  parameter {
    name  = "max_connections"
    value = var.db_max_connections
  }
  
  parameter {
    name  = "statement_timeout"
    value = "300000"  # 5 minutes
  }
  
  parameter {
    name  = "idle_in_transaction_session_timeout"
    value = "600000"  # 10 minutes
  }
  
  # Data integrity parameters
  parameter {
    name  = "data_checksums"
    value = "1"
  }
  
  parameter {
    name  = "fsync"
    value = "1"
  }
  
  parameter {
    name  = "synchronous_commit"
    value = "on"
  }
  
  tags = {
    Name = "schlep-engine-db-params-ha"
  }
}

# Read Replica for Load Distribution
resource "aws_db_instance" "read_replica" {
  count = var.enable_ha_improvements && var.create_read_replica ? 1 : 0
  
  identifier              = "schlep-engine-db-read-replica"
  replicate_source_db     = aws_db_instance.main_ha[0].identifier
  instance_class          = var.db_read_replica_instance_class
  publicly_accessible     = false
  auto_minor_version_upgrade = true
  
  # Performance Insights for read replica
  performance_insights_enabled = true
  monitoring_interval         = 60
  monitoring_role_arn        = aws_iam_role.rds_enhanced_monitoring.arn
  
  tags = {
    Name        = "schlep-engine-db-read-replica"
    Environment = var.environment
    Purpose     = "Read Replica"
  }
}

# Enhanced Security Group for HA RDS
resource "aws_security_group" "rds_ha" {
  count       = var.enable_ha_improvements ? 1 : 0
  name_prefix = "schlep-engine-rds-ha-"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
    description     = "PostgreSQL from EKS nodes"
  }
  
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion[0].id]
    description     = "PostgreSQL from bastion host"
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "schlep-engine-rds-ha-sg"
  }
}

# ======================================================================================
# REDIS HIGH AVAILABILITY IMPROVEMENTS
# ======================================================================================

# Enhanced ElastiCache Replication Group
resource "aws_elasticache_replication_group" "main_ha" {
  count = var.enable_ha_improvements ? 1 : 0
  
  replication_group_id       = "schlep-engine-redis-ha"
  description               = "Redis cluster for Schlep Engine (HA mode)"
  
  port                      = 6379
  parameter_group_name      = aws_elasticache_parameter_group.main_ha[0].name
  node_type                = var.redis_node_type_ha
  num_cache_clusters        = var.redis_num_cache_clusters_ha
  
  # Network Configuration
  subnet_group_name         = aws_elasticache_subnet_group.main.name
  security_group_ids        = [aws_security_group.redis_ha[0].id]
  
  # HIGH AVAILABILITY CONFIGURATION
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  # SECURITY CONFIGURATION
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                = var.redis_auth_token_ha
  
  # BACKUP CONFIGURATION (Enhanced)
  snapshot_retention_limit  = var.redis_snapshot_retention_limit_ha
  snapshot_window          = "03:00-05:00"
  maintenance_window       = "sun:05:00-sun:07:00"
  
  # NOTIFICATION CONFIGURATION
  notification_topic_arn   = aws_sns_topic.database_alerts.arn
  
  # Enable logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_logs[0].name
    destination_type = "cloudwatch-logs"
    log_format      = "json"
    log_type        = "slow-log"
  }
  
  tags = {
    Name        = "schlep-engine-redis-ha"
    Environment = var.environment
    Purpose     = "Primary HA Cache"
  }
}

# Enhanced Redis Parameter Group
resource "aws_elasticache_parameter_group" "main_ha" {
  count  = var.enable_ha_improvements ? 1 : 0
  family = "redis7.x"
  name   = "schlep-engine-redis-params-ha"
  
  # Memory management for reliability
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }
  
  parameter {
    name  = "maxmemory-samples"
    value = "5"
  }
  
  # Persistence configuration
  parameter {
    name  = "save"
    value = "900 1 300 10 60 10000"
  }
  
  # Performance tuning
  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }
  
  parameter {
    name  = "timeout"
    value = "0"
  }
  
  # Slow log configuration
  parameter {
    name  = "slowlog-log-slower-than"
    value = "10000"  # 10ms
  }
  
  parameter {
    name  = "slowlog-max-len"
    value = "128"
  }
  
  tags = {
    Name = "schlep-engine-redis-params-ha"
  }
}

# Enhanced Security Group for Redis
resource "aws_security_group" "redis_ha" {
  count       = var.enable_ha_improvements ? 1 : 0
  name_prefix = "schlep-engine-redis-ha-"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
    description     = "Redis from EKS nodes"
  }
  
  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion[0].id]
    description     = "Redis from bastion host"
  }
  
  tags = {
    Name = "schlep-engine-redis-ha-sg"
  }
}

# ======================================================================================
# BACKUP ENHANCEMENTS
# ======================================================================================

# Cross-Region Backup Replication for RDS
resource "aws_db_instance_automated_backups_replication" "main" {
  count = var.enable_ha_improvements && var.enable_cross_region_backups ? 1 : 0
  
  source_db_instance_arn = aws_db_instance.main_ha[0].arn
  kms_key_id            = aws_kms_key.backup_replica[0].arn
  
  provider = aws.backup_region
  
  tags = {
    Name = "schlep-engine-cross-region-backup"
  }
}

# KMS Key for Cross-Region Backups
resource "aws_kms_key" "backup_replica" {
  count = var.enable_ha_improvements && var.enable_cross_region_backups ? 1 : 0
  
  provider    = aws.backup_region
  description = "KMS key for cross-region backup encryption"
  
  tags = {
    Name = "schlep-engine-backup-replica-kms"
  }
}

# ======================================================================================
# MONITORING ENHANCEMENTS
# ======================================================================================

# CloudWatch Log Group for Redis
resource "aws_cloudwatch_log_group" "redis_logs" {
  count = var.enable_ha_improvements ? 1 : 0
  
  name              = "/aws/elasticache/schlep-engine-redis"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.cloudwatch.arn
  
  tags = {
    Name = "schlep-engine-redis-logs"
  }
}

# SNS Topic for Database Alerts
resource "aws_sns_topic" "database_alerts" {
  name = "schlep-engine-database-alerts"
  
  tags = {
    Name = "Schlep Engine Database Alerts"
  }
}

# SNS Topic Subscription for Email Alerts
resource "aws_sns_topic_subscription" "database_alerts_email" {
  count = var.database_alert_email != "" ? 1 : 0
  
  topic_arn = aws_sns_topic.database_alerts.arn
  protocol  = "email"
  endpoint  = var.database_alert_email
}

# ======================================================================================
# BASTION HOST FOR SECURE DATABASE ACCESS
# ======================================================================================

# Bastion Host Security Group
resource "aws_security_group" "bastion" {
  count       = var.enable_ha_improvements ? 1 : 0
  name_prefix = "schlep-engine-bastion-"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.bastion_allowed_cidrs
    description = "SSH access to bastion"
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "schlep-engine-bastion-sg"
  }
}

# Bastion Host EC2 Instance
resource "aws_instance" "bastion" {
  count = var.enable_ha_improvements && var.create_bastion_host ? 1 : 0
  
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = "t3.micro"
  key_name              = var.bastion_key_name
  vpc_security_group_ids = [aws_security_group.bastion[0].id]
  subnet_id             = aws_subnet.public[0].id
  
  associate_public_ip_address = true
  
  user_data = base64encode(templatefile("${path.module}/bastion-userdata.sh", {
    postgres_host = aws_db_instance.main_ha[0].endpoint
    redis_host    = aws_elasticache_replication_group.main_ha[0].primary_endpoint_address
  }))
  
  tags = {
    Name = "schlep-engine-bastion"
  }
}

# ======================================================================================
# OUTPUTS
# ======================================================================================

output "ha_rds_endpoint" {
  description = "RDS HA instance endpoint"
  value       = var.enable_ha_improvements ? aws_db_instance.main_ha[0].endpoint : null
  sensitive   = true
}

output "ha_redis_endpoint" {
  description = "Redis HA cluster endpoint" 
  value       = var.enable_ha_improvements ? aws_elasticache_replication_group.main_ha[0].primary_endpoint_address : null
  sensitive   = true
}

output "read_replica_endpoint" {
  description = "Read replica endpoint"
  value       = var.enable_ha_improvements && var.create_read_replica ? aws_db_instance.read_replica[0].endpoint : null
  sensitive   = true
}

output "bastion_host_ip" {
  description = "Bastion host public IP"
  value       = var.enable_ha_improvements && var.create_bastion_host ? aws_instance.bastion[0].public_ip : null
}

output "database_alert_topic_arn" {
  description = "SNS topic ARN for database alerts"
  value       = aws_sns_topic.database_alerts.arn
}