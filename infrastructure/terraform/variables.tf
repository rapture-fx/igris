variable "aws_region" {
  description = "The AWS region to deploy resources in."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "The name of the project."
  type        = string
  default     = "schlep-engine"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "schlep-engine"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "eks_role_arn" {
  description = "The ARN of the EKS role"
  type        = string
} 