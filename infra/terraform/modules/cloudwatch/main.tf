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

# 4. DEV-177: HPA/CloudWatch 모니터링 대시보드
# Container Insights(amazon-cloudwatch-observability addon)가 채우는 ContainerInsights
# 네임스페이스 메트릭을 사용한다. 파드/노드 이름은 스케일링·재생성으로 계속 바뀌므로,
# 이름이 고정된 지표(Service 차원)는 직접 참조하고, 이름이 동적인 지표는 SEARCH()로
# 범위(ClusterName/Namespace) 안에서 동적으로 찾는다.
# ⚠️ 정확한 metric/차원 조합은 addon이 실제 데이터를 수집해야 CloudWatch 메트릭
# 탐색기에서 확인 가능 — 적용 후 위젯에 데이터가 채워지는지 반드시 검증할 것.

data "aws_region" "current" {}

resource "aws_cloudwatch_dashboard" "eks_hpa" {
  dashboard_name = "team04-${var.environment}-eks-hpa-monitoring"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "api-gateway Running Pod Count"
          view   = "timeSeries"
          region = data.aws_region.current.name
          period = 300
          stat   = "Average"
          metrics = [
            ["ContainerInsights", "pod_number_of_running_pods", "ClusterName", var.cluster_name, "Namespace", "backend", "Service", "api-gateway"]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "api-gateway Pod Network RX/TX"
          view   = "timeSeries"
          region = data.aws_region.current.name
          period = 300
          stat   = "Average"
          metrics = [
            [{ expression = "SEARCH('{ContainerInsights,ClusterName,Namespace,PodName} MetricName=\"pod_network_rx_bytes\" ClusterName=\"${var.cluster_name}\" Namespace=\"backend\"', 'Average', 300)", label = "RX", id = "rx1" }],
            [{ expression = "SEARCH('{ContainerInsights,ClusterName,Namespace,PodName} MetricName=\"pod_network_tx_bytes\" ClusterName=\"${var.cluster_name}\" Namespace=\"backend\"', 'Average', 300)", label = "TX", id = "tx1" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 24
        height = 6
        properties = {
          title  = "api-gateway Pod CPU (%)"
          view   = "timeSeries"
          region = data.aws_region.current.name
          period = 300
          stat   = "Average"
          metrics = [
            ["ContainerInsights", "pod_cpu_utilization", "ClusterName", var.cluster_name, "Namespace", "backend", "Service", "api-gateway"]
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 24
        height = 6
        properties = {
          title  = "api-gateway Pod Memory (%)"
          view   = "timeSeries"
          region = data.aws_region.current.name
          period = 300
          stat   = "Average"
          metrics = [
            ["ContainerInsights", "pod_memory_utilization", "ClusterName", var.cluster_name, "Namespace", "backend", "Service", "api-gateway"]
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 18
        width  = 12
        height = 6
        properties = {
          title  = "Node CPU (%) — GPU 노드 그룹(챗봇/ollama) 포함 전체 노드"
          view   = "timeSeries"
          region = data.aws_region.current.name
          period = 300
          stat   = "Average"
          metrics = [
            [{ expression = "SEARCH('{ContainerInsights,ClusterName,NodeName} MetricName=\"node_cpu_utilization\" ClusterName=\"${var.cluster_name}\"', 'Average', 300)", label = "", id = "ncpu1" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 18
        width  = 12
        height = 6
        properties = {
          title  = "Node Memory (%) — GPU 노드 그룹(챗봇/ollama) 포함 전체 노드"
          view   = "timeSeries"
          region = data.aws_region.current.name
          period = 300
          stat   = "Average"
          metrics = [
            [{ expression = "SEARCH('{ContainerInsights,ClusterName,NodeName} MetricName=\"node_memory_utilization\" ClusterName=\"${var.cluster_name}\"', 'Average', 300)", label = "", id = "nmem1" }]
          ]
        }
      }
    ]
  })
}