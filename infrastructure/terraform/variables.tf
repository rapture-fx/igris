variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "db_username" {
  description = "Master username for RDS Postgres instance"
  type        = string
  default     = "pollarbase"
}

variable "db_password" {
  description = "Master password for RDS Postgres instance"
  type        = string
  sensitive   = true
} 