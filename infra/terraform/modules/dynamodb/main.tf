# DEV-187: chat-bot-service가 기대하는 ChatSessions/ChatMessages 테이블이 이 저장소
# 어디에도 프로비저닝되어 있지 않았다 — apps/chat-bot-service/src/dynamodb/dynamodb.constants.ts와
# backend/scripts/dynamodb-init.ts 양쪽 다 "실제 테이블은 infra/terraform으로
# 프로비저닝됩니다"라고 되어 있었지만 실제로는 aws_dynamodb_table 리소스가 어디에도
# 없었다 — IRSA 자격증명(DEV-184)과 IAM 권한(DEV-186)을 다 고친 뒤에도
# ResourceNotFoundException으로 로그인 사용자 챗봇 호출이 계속 503을 반환한 원인
# (실측 확인, kubectl logs). backend/scripts/dynamodb-init.ts가 로컬 dynamodb-local에
# 만드는 것과 동일한 스키마로 실제 AWS DynamoDB에 생성한다.

# ChatSessions: PK sessionId, GSI userId-index (userId → sessionId 조회용, 로그인
# 사용자 1명당 세션 1개를 찾는 get-or-create에 사용). session.service.ts 참고.
resource "aws_dynamodb_table" "chat_sessions" {
  name         = var.chat_sessions_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sessionId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "N"
  }

  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-chat-sessions"
  }
}

# ChatMessages: PK sessionId + SK messageId(createdAt#uuid) — 세션별 대화 이력
# 시간순 조회용. message.service.ts 참고.
resource "aws_dynamodb_table" "chat_messages" {
  name         = var.chat_messages_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sessionId"
  range_key    = "messageId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  attribute {
    name = "messageId"
    type = "S"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-chat-messages"
  }
}
