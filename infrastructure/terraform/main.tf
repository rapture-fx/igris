terraform {
  required_version = ">= 1.4.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "pollarbase-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnets = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "19.0.0"

  cluster_name    = "pollarbase-eks"
  cluster_version = "1.27"
  subnets         = module.vpc.private_subnets
  vpc_id          = module.vpc.vpc_id

  manage_aws_auth_configmap = true
}

module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "6.0.0"

  identifier = "pollarbase-db"
  engine     = "postgres"
  engine_version = "15.3"
  instance_class = "db.t3.medium"

  allocated_storage    = 20
  storage_encrypted    = true
  multi_az             = false

  db_name  = "pollarbase"
  username = var.db_username
  password = var.db_password

  vpc_security_group_ids = [module.vpc.default_security_group_id]
  subnet_ids             = module.vpc.public_subnets
}

module "s3" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "3.0.0"

  bucket = "pollarbase-backups-${terraform.workspace}"
  versioning = {
    enabled = true
  }
  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm = "AES256"
      }
    }
  }
}

module "memorydb" {
  source  = "terraform-aws-modules/memorydb/aws"
  version = "1.1.0"

  name                = "pollarbase-memorydb"
  acl_name            = "open-access"
  node_type           = "db.t4g.small"
  num_shards          = 1
  replicas_per_shard  = 1
  security_group_ids  = [module.vpc.default_security_group_id]
  subnet_ids          = module.vpc.private_subnets
} 