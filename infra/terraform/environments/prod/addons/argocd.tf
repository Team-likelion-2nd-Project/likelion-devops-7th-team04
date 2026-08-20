# =========================
# ArgoCD
# =========================

resource "helm_release" "argocd" {
  name       = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  namespace  = "argocd"

  create_namespace = true
  version          = "10.2.1"

  atomic          = true
  cleanup_on_fail = true
  timeout         = 900
}