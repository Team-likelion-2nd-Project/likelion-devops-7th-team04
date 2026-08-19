variable "project_name" {
  type        = string
  description = "Project name used for resource tagging"
}

variable "environment" {
  type        = string
  description = "배포 환경 (예: dev, prod)"
}

variable "chat_sessions_table_name" {
  type        = string
  default     = "ChatSessions"
  description = "ChatSessions 테이블 이름 — apps/chat-bot-service/src/dynamodb/dynamodb.constants.ts 및 gitops/backend/base/chat-bot-service/deployment.yaml의 DYNAMODB_CHAT_SESSIONS_TABLE과 반드시 일치해야 합니다."
}

variable "chat_messages_table_name" {
  type        = string
  default     = "ChatMessages"
  description = "ChatMessages 테이블 이름 — apps/chat-bot-service/src/dynamodb/dynamodb.constants.ts 및 gitops/backend/base/chat-bot-service/deployment.yaml의 DYNAMODB_CHAT_MESSAGES_TABLE과 반드시 일치해야 합니다."
}
