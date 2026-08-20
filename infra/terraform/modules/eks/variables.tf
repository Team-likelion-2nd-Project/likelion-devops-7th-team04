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

variable "gpu_disk_size" {
  description = "Root EBS volume size (GB) for GPU worker nodes. Default AMI size (20GB) is too small for the Ollama image (7B chat model + embedding model baked in) and trips kubelet's disk-pressure taint (DEV-163)."
  type        = number
  default     = 100
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

variable "cloudwatch_observability_role_arn" {
  description = "IRSA role ARN for the amazon-cloudwatch-observability addon (Container Insights)"
  type        = string
}

# DEV-196: api-gateway/n8n용 전용 EC2 CPU 노드그룹 — aws_eks_node_group.api_cpu 참고.
variable "api_cpu_instance_types" {
  description = "EC2 instance types for the api-gateway/n8n dedicated CPU node group"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "api_cpu_desired_size" {
  description = "Desired number of api-cpu worker nodes. Unlike gpu_desired_size(=0, cost-saving default), this must stay up — api-gateway is on the live request path."
  type        = number
  default     = 2
}

# DEV-196: Cluster Autoscaler 도입 후 min_size=2로 올려 상시 최소 이중화를 보장한다
# (Cluster Autoscaler는 min_size 밑으로는 절대 안 줄임) — api-gateway HPA
# (gitops/backend/base/api-gateway/hpa.yaml)가 minReplicas=2라 이 노드그룹이 1대뿐이면
# 그 노드 하나가 죽었을 때 api-gateway/n8n이 동시에 전부 다운되는 단일 장애점이 된다.
variable "api_cpu_min_size" {
  description = "Minimum number of api-cpu worker nodes"
  type        = number
  default     = 2
}

# DEV-196: HPA가 api-gateway를 최대 10 replica까지 늘릴 수 있어 여유를 넉넉히 잡음 —
# Cluster Autoscaler가 필요할 때만 늘리므로 상한을 높게 잡아도 평소 비용엔 영향 없다.
variable "api_cpu_max_size" {
  description = "Maximum number of api-cpu worker nodes"
  type        = number
  default     = 4
}