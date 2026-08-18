#!/usr/bin/env bash
# backend-secrets(namespace: backend) K8s Secret을 만들거나 최신화합니다.
#
# EC2 MariaDB / ElastiCache Redis는 비용 문제로 apply/destroy를 반복하므로 private
# IP/엔드포인트가 매번 바뀝니다. 이 스크립트는 그 두 값만 Terraform state에서 자동으로
# 읽어오고(root outputs.tf가 없어 `terraform state show`/`terraform show -json`으로 직접
# 조회 — Terraform 파일은 건드리지 않음), 나머지(DB_USERNAME/DB_PASSWORD/DB_DATABASE/
# REDIS_PASSWORD/REDIS_TLS/JWT_ACCESS_SECRET/JWT_REFRESH_SECRET)는 git에 커밋되지 않는
# backend/.env.k8s 파일에서 읽어 kubectl create secret 커맨드를 만듭니다.
#
# ⚠️ 이 세션에서 실행/검증하지 않았습니다 — EC2/ElastiCache가 아직 apply되지 않아
#    terraform state에 해당 리소스가 없습니다. `bash -n`으로 문법만 확인했습니다.
#
# 사용법:
#   1. backend/.env.k8s.example을 backend/.env.k8s로 복사하고 실제 값을 채웁니다
#      (DB_HOST/REDIS_HOST는 자동으로 채워지므로 비워둬도 됩니다)
#   2. terraform apply로 EC2/ElastiCache를 만든 뒤 이 스크립트를 실행합니다
#   3. kubeconfig가 team04-hotel-dev-eks를 가리키는 상태여야 합니다
#      (aws eks update-kubeconfig --name team04-hotel-dev-eks --region us-east-1)
#
#   ./gitops/scripts/sync-backend-secrets.sh            # kubectl apply까지 실행
#   ./gitops/scripts/sync-backend-secrets.sh --dry-run   # 생성될 Secret YAML만 출력

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TF_DIR="${REPO_ROOT}/infra/terraform/environments/dev"
ENV_K8S_FILE="${REPO_ROOT}/backend/.env.k8s"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

if [[ ! -f "${ENV_K8S_FILE}" ]]; then
  echo "다음 파일이 없습니다: ${ENV_K8S_FILE}" >&2
  echo "backend/.env.k8s.example을 복사해서 값을 채운 뒤 다시 실행하세요." >&2
  exit 1
fi

# DB_USERNAME/DB_PASSWORD/DB_DATABASE/REDIS_PASSWORD/REDIS_TLS/JWT_ACCESS_SECRET/
# JWT_REFRESH_SECRET을 읽어옵니다 (git에 커밋되지 않는 파일, .gitignore의 .env* 패턴에 포함됨).
set -a
# shellcheck disable=SC1090
source "${ENV_K8S_FILE}"
set +a

echo "Terraform state에서 DB_HOST(EC2 MariaDB private IP)/REDIS_HOST(ElastiCache 엔드포인트) 조회 중..."

STATE_JSON="$(cd "${TF_DIR}" && terraform show -json)"

DB_HOST="$(echo "${STATE_JSON}" | jq -r '
  .values.root_module | .. | objects
  | select(.address? == "module.database.aws_instance.mariadb")
  | .values.private_ip // empty
')"

REDIS_HOST="$(echo "${STATE_JSON}" | jq -r '
  .values.root_module | .. | objects
  | select(.address? == "module.redis.aws_elasticache_cluster.redis")
  | .values.cache_nodes[0].address // empty
')"

if [[ -z "${DB_HOST}" ]]; then
  echo "경고: module.database.aws_instance.mariadb를 state에서 찾지 못했습니다 (아직 apply 안 됐을 수 있음)." >&2
fi
if [[ -z "${REDIS_HOST}" ]]; then
  echo "경고: module.redis.aws_elasticache_cluster.redis를 state에서 찾지 못했습니다 (아직 apply 안 됐을 수 있음)." >&2
fi

: "${DB_PORT:=3306}"
: "${DB_USERNAME:?backend/.env.k8s에 DB_USERNAME이 필요합니다}"
: "${DB_PASSWORD:?backend/.env.k8s에 DB_PASSWORD가 필요합니다}"
: "${DB_DATABASE:?backend/.env.k8s에 DB_DATABASE가 필요합니다}"
: "${REDIS_PASSWORD?backend/.env.k8s에 REDIS_PASSWORD가 필요합니다 (없으면 빈 문자열로 명시)}"
: "${REDIS_TLS:=false}"
: "${JWT_ACCESS_SECRET:?backend/.env.k8s에 JWT_ACCESS_SECRET이 필요합니다}"
: "${JWT_REFRESH_SECRET:?backend/.env.k8s에 JWT_REFRESH_SECRET이 필요합니다}"

KUBECTL_ARGS=(
  create secret generic backend-secrets
  -n backend
  --from-literal="DB_HOST=${DB_HOST}"
  --from-literal="DB_USERNAME=${DB_USERNAME}"
  --from-literal="DB_PASSWORD=${DB_PASSWORD}"
  --from-literal="DB_DATABASE=${DB_DATABASE}"
  --from-literal="REDIS_HOST=${REDIS_HOST}"
  --from-literal="REDIS_PASSWORD=${REDIS_PASSWORD}"
  --from-literal="REDIS_TLS=${REDIS_TLS}"
  --from-literal="JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}"
  --from-literal="JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}"
  --dry-run=client
  -o yaml
)

if [[ "${DRY_RUN}" == "true" ]]; then
  kubectl "${KUBECTL_ARGS[@]}"
else
  kubectl "${KUBECTL_ARGS[@]}" | kubectl apply -f -
  echo "backend-secrets (namespace: backend) 적용 완료."
fi
