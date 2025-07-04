# ======================================================================================
# Main Terraform Configuration for Schlep Engine
#
# This file defines the core cloud infrastructure for the application, including:
# - AWS provider configuration
# - Virtual Private Cloud (VPC)
# - Elastic Kubernetes Service (EKS) cluster
# - Relational Database Service (RDS) instance for PostgreSQL
# - S3 bucket for backups
# - ElastiCache (Redis) cluster for caching and session management
# ======================================================================================

provider "aws" {
  region = var.aws_region
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  tags = {
    Name = "schlep-engine-vpc"
  }
}

# Add subnet and security group resources here...

resource "aws_eks_cluster" "main" {
  name     = "schlep-engine-eks"
  role_arn = var.eks_role_arn

  vpc_config {
    # Reference your subnets and security groups here
    subnet_ids = [] 
  }

  depends_on = [aws_vpc.main]
}

resource "aws_db_instance" "main" {
  allocated_storage    = 20
  engine               = "postgres"
  engine_version       = "15.3"
  instance_class       = "db.t3.micro"
  identifier           = "schlep-engine-db"
  db_name              = "schlep_engine"
  username             = var.db_username
  password             = var.db_password
  parameter_group_name = "default.postgres15"
  skip_final_snapshot  = true
}

resource "aws_s3_bucket" "backups" {
  bucket = "schlep-engine-backups-${terraform.workspace}"
  tags = {
    Name        = "Schlep Engine Backups"
    Environment = terraform.workspace
  }
}

resource "aws_elasticache_cluster" "main" {
  cluster_id           = "schlep-engine-memorydb"
  engine               = "redis"
  node_type            = "cache.t3.small"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
}