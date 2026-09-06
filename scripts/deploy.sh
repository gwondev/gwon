#!/usr/bin/env bash
#
# deploy.sh — 서버 배포 (강제 동기화 + 빌드)
#
# git pull 만으로 반영이 안 될 때 사용합니다.
# 로컬(서버) 변경을 버리고 origin/main 과 완전히 동일하게 맞춘 뒤 재빌드합니다.
#
# 사용법 (gwon 레포 루트에서):
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh
#
# 또는 홈에서 한 번에:
#   cd ~/gwon && ./scripts/deploy.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_SRC="${ENV_SRC:-../.env.production}"
BRANCH="${BRANCH:-main}"

echo "════════════════════════════════════════"
echo "  GWON deploy  ($(date '+%Y-%m-%d %H:%M:%S'))"
echo "  dir: $ROOT"
echo "════════════════════════════════════════"

# ── 1) Git: 원격과 강제 동기화 ───────────────────────────────────────
if [[ ! -d .git ]]; then
  echo "[deploy] 오류: git 저장소가 아닙니다. 먼저 clone 하세요." >&2
  exit 1
fi

echo "[deploy] git fetch origin ${BRANCH} …"
git fetch origin "${BRANCH}"

# main 브랜치로 전환 (없으면 생성)
git checkout "${BRANCH}" 2>/dev/null || git checkout -B "${BRANCH}" "origin/${BRANCH}"

BEFORE="$(git rev-parse --short HEAD)"
git reset --hard "origin/${BRANCH}"
AFTER="$(git rev-parse --short HEAD)"

echo "[deploy] git sync: ${BEFORE} → ${AFTER} (origin/${BRANCH})"

if [[ "${BEFORE}" == "${AFTER}" ]]; then
  echo "[deploy] 코드 변경 없음 — 이미 최신이거나 GitHub에 push 가 안 된 상태일 수 있습니다."
  echo "[deploy] 로컬 PC에서 'git push origin main' 했는지 확인하세요."
fi

# 추적되지 않는 빌드 산출물만 정리 (.env, mysql_data 는 보존)
git clean -fd -e .env -e mysql_data -e data 2>/dev/null || true

# ── 2) 환경변수 주입 ─────────────────────────────────────────────────
chmod +x scripts/prepare-env.sh
./scripts/prepare-env.sh "${ENV_SRC}"

# ── 3) Docker 재빌드 ─────────────────────────────────────────────────
echo "[deploy] docker compose down …"
docker compose down

echo "[deploy] docker compose up --build -d …"
docker compose up --build -d

echo ""
docker compose ps
echo ""
echo "[deploy] 완료."
