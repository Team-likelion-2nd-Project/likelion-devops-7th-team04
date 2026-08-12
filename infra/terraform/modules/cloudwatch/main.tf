# 1. CloudWatch 경보 발생 시 이메일을 보낼 SNS Topic 생성
resource "aws_sns_topic" "user_updates" {
  name = "team04-${var.environment}-cloudwatch-alarms-topic"
}

# 2. SNS Topic에 이메일 구독자(Subscription) 추가
resource "aws_sns_topic_subscription" "user_updates_sqs_target" {
  topic_arn = aws_sns_topic.user_updates.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# 3. EC2 CPU 사용량 고부하 경보 (CPU > 80% 5분 지속 시)
resource "aws_cloudwatch_metric_alarm" "ec2_cpu_high" {
  count               = var.ec2_instance_id != "" ? 1 : 0
  alarm_name          = "team04-${var.environment}-ec2-high-cpu-alarm"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "EC2 CPU utilization exceeds 80% for 10 minutes"
  alarm_actions       = [aws_sns_topic.user_updates.arn]

  dimensions = {
    InstanceId = var.ec2_instance_id
  }
}