output "sns_topic_arn" {
  value       = aws_sns_topic.user_updates.arn
  description = "CloudWatch 알림 전송용 SNS Topic ARN"
}