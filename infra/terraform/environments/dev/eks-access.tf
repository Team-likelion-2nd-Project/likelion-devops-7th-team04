# =========================
# 팀원 EKS 클러스터 접근 권한 (Access Entry)
# =========================
# team04-hotel-dev-eks는 IAM Access Entry 기반 인증을 사용하며,
# 클러스터를 생성한 IAM 주체에게만 자동으로 관리자 권한이 부여된다.
# 나머지 팀원은 여기서 개별적으로 Access Entry를 등록해야 kubectl을 쓸 수 있다.
# 실제 ARN 값은 terraform.tfvars(로컬 전용, git 미추적)에서 주입한다.

resource "aws_eks_access_entry" "team_members" {
  for_each = toset(var.team_member_arns)

  cluster_name  = module.eks.cluster_name
  principal_arn = each.value
}

resource "aws_eks_access_policy_association" "team_members_admin" {
  for_each = aws_eks_access_entry.team_members

  cluster_name  = module.eks.cluster_name
  principal_arn = each.value.principal_arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

  access_scope {
    type = "cluster"
  }
}
