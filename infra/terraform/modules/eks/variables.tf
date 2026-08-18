variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "cluster_role_arn" {
  description = "IAM role ARN used by the EKS cluster"
  type        = string
}

variable "node_role_arn" {
  description = "IAM role ARN used by the EKS managed node group"
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet IDs used by EKS"
  type        = list(string)
}

variable "cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.35"
}

variable "fargate_pod_execution_role_arn" {
  description = "IAM role ARN used by the EKS Fargate pod execution role (CPU workloads)"
  type        = string
}

variable "gpu_instance_types" {
  description = "EC2 GPU instance types used by the chatbot node group"
  type        = list(string)
  default     = ["g4dn.xlarge"]
}

variable "gpu_desired_size" {
  description = "Desired number of GPU worker nodes"
  type        = number
  default     = 0
}

variable "gpu_min_size" {
  description = "Minimum number of GPU worker nodes"
  type        = number
  default     = 0
}

variable "gpu_max_size" {
  description = "Maximum number of GPU worker nodes"
  type        = number
  default     = 1
}
variable "vpc_cni_role_arn" {
  description = "IAM role ARN used by the VPC CNI add-on"
  type        = string
}
variable "alb_controller_role_arn" {
  description = "IAM role ARN used by AWS Load Balancer Controller"
  type        = string
}
variable "chatbot_role_arn" {
  description = "IAM role ARN used by the chatbot service"
  type        = string
}

variable "chatbot_namespace" {
  description = "Kubernetes namespace used by the chatbot service"
  type        = string
  default     = "chatbot"
}

variable "chatbot_service_account" {
  description = "Kubernetes service account used by the chatbot service"
  type        = string
  default     = "chatbot-service"
}

variable "langchain_namespace" {
  description = "Kubernetes namespace used by the langchain AI pipeline (llm-service, n8n, ollama). Only pods labeled compute=fargate in this namespace are matched by the CPU Fargate profile — ollama is scheduled onto the GPU node group instead."
  type        = string
  default     = "langchain"
}