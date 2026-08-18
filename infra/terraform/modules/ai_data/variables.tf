variable "project_name" {
  type        = string
  default     = "team04"
  description = "프로젝트 이름"
}

variable "environment" {
  type        = string
  description = "배포 환경 (예: dev, prod)"
}

variable "vector_bucket_name" {
  type        = string
  default     = ""
  description = "S3 Vector Bucket 이름 (미지정 시 자동 생성)"
}

variable "vector_index_name" {
  type        = string
  default     = "team04-chatbot-vector-index"
  description = "S3 Vector Index 이름"
}

# --- DEV-126 추가 변수 ---
variable "vector_dimension" {
  type        = number
  default     = 1536
  description = "Embedding model vector dimension (e.g., 1536 for OpenAI text-embedding-3-small / Titan)"
}

variable "vector_data_type" {
  type        = string
  default     = "float32"
  description = "Vector data type (e.g., float32)"
}

variable "vector_distance_metric" {
  type        = string
  default     = "cosine"
  description = "Distance metric for vector search (e.g., cosine, euclidean)"
}