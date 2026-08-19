output "chat_sessions_table_arn" {
  description = "ChatSessions table ARN"
  value       = aws_dynamodb_table.chat_sessions.arn
}

output "chat_sessions_table_name" {
  description = "ChatSessions table name"
  value       = aws_dynamodb_table.chat_sessions.name
}

output "chat_messages_table_arn" {
  description = "ChatMessages table ARN"
  value       = aws_dynamodb_table.chat_messages.arn
}

output "chat_messages_table_name" {
  description = "ChatMessages table name"
  value       = aws_dynamodb_table.chat_messages.name
}
