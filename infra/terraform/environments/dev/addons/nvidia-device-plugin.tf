# =========================
# NVIDIA Device Plugin
# =========================

resource "helm_release" "nvidia_device_plugin" {
  name       = "nvidia-device-plugin"
  repository = "https://nvidia.github.io/k8s-device-plugin"
  chart      = "nvidia-device-plugin"
  namespace  = "nvidia-device-plugin"

  create_namespace = true
  version          = "0.19.3"

  atomic          = true
  cleanup_on_fail = true
  timeout         = 600

  values = [
    yamlencode({
      # DEV-46 GPU Node Group에만 배치
      nodeSelector = {
        workload = "chatbot"
      }

      # NFD 없이도 GPU Node에 배치할 수 있도록
      # chart 기본 affinity 조건 제거
      affinity = {}

      # GPU Node Group의 NoSchedule taint 허용
      tolerations = [
        {
          key      = "nvidia.com/gpu"
          operator = "Exists"
          effect   = "NoSchedule"
        }
      ]
    })
  ]
}