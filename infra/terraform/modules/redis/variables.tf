variable "environment" {
  description = "Deployment environment (dev, prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where Redis will be deployed"
  type        = string
}

variable "private_data_subnet_ids" {
  description = "List of Private Data Subnet IDs for Redis"
  type        = list(string)
}

variable "redis_security_group_id" {
  description = "Security Group ID for Redis"
  type        = string
}

variable "node_type" {
  description = "ElastiCache Redis Instance Node Type"
  type        = string
  default     = "cache.t3.micro"
}

variable "num_cache_nodes" {
  description = "Number of Cache Nodes"
  type        = number
  default     = 1
}

variable "parameter_group_name" {
  description = "ElastiCache Parameter Group Name"
  type        = string
  default     = "default.redis7"
}

variable "engine_version" {
  description = "Redis Engine Version"
  type        = string
  default     = "7.0"
}