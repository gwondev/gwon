#!/usr/bin/env bash
# 홈에서 레포를 지우고 다시 clone 한 뒤 올린다.
# 운영 DB(/home/gwon/mysql_data)와 gwon-db 컨테이너는 건드리지 않는다.
set -euo pipefail

HOME_DIR="${HOME:-/home/gwon}"
REPO_DIR="$HOME_DIR/gwon"
LIVE_DB="$HOME_DIR/mysql_data"
ENV_SRC="$HOME_DIR/.env.production"

if [[ -d "$LIVE_DB" && "$REPO_DIR/mysql_data" -ef "$LIVE_DB" ]]; then
  echo "[fresh-deploy] 중단: 레포 안 mysql_data 가 운영 DB와 같은 경로입니다." >&2
  exit 1
fi

echo "[fresh-deploy] 레포 안 잔여 mysql_data 만 제거 (운영 DB 는 유지)"
if [[ -d "$REPO_DIR/mysql_data" ]]; then
  docker run --rm -v "$REPO_DIR:/repo" alpine rm -rf /repo/mysql_data
fi

if [[ -d "$REPO_DIR" ]]; then
  echo "[fresh-deploy] rm -rf $REPO_DIR"
  rm -rf "$REPO_DIR"
fi

echo "[fresh-deploy] git clone"
git clone https://github.com/gwondev/gwon.git "$REPO_DIR"
cd "$REPO_DIR"

chmod +x scripts/prepare-env.sh
./scripts/prepare-env.sh "$ENV_SRC"

docker compose down
docker compose up --build -d
docker compose ps
echo "[fresh-deploy] backend logs:"
docker compose logs --tail=30 backend
