#!/usr/bin/env bash
# gwon-db / meter 복구. 볼륨은 지우지 않는다.
set -euo pipefail

ENV_FILE="${HOME}/gwon/.env"
[[ -f "$ENV_FILE" ]] || ENV_FILE="${HOME}/.env.production"
PASS=""
if [[ -f "$ENV_FILE" ]]; then
  PASS="$(grep -E '^[[:space:]]*DB_ROOT_PASSWORD=' "$ENV_FILE" | head -n1 | sed -E 's/^[[:space:]]*DB_ROOT_PASSWORD=//' | tr -d '\r')"
  [[ -z "$PASS" ]] && PASS="$(grep -E '^[[:space:]]*DB_PASSWORD=' "$ENV_FILE" | head -n1 | sed -E 's/^[[:space:]]*DB_PASSWORD=//' | tr -d '\r')"
fi
if [[ -z "$PASS" && -f "${HOME}/.env.production" ]]; then
  PASS="$(grep -E '^[[:space:]]*DB_PASSWORD=' "${HOME}/.env.production" | head -n1 | sed -E 's/^[[:space:]]*DB_PASSWORD=//' | tr -d '\r')"
fi
if [[ -z "$PASS" ]]; then
  echo "[recover] DB 비밀번호를 못 찾았습니다." >&2
  exit 1
fi

echo "======== 컨테이너 ========"
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'

echo "======== 3306 점유 ========"
ss -lntp 2>/dev/null | grep 3306 || true
docker ps --format '{{.Names}} {{.Ports}}' | grep 3306 || true

echo "======== MySQL 볼륨 스키마 ========"
sudo find /var/lib/docker/volumes -maxdepth 3 -name ibdata1 2>/dev/null | while read -r f; do
  dir="$(dirname "$f")"
  echo "-- $dir"
  sudo ls -1 "$dir" | grep -vE '^(#|ib|undo|binlog|auto\.cnf|ca|client|server|private|public|mysql\.sock|mysql_upgrade|mysql\.ibd)' || true
done

echo "======== 프로젝트 폴더 ========"
ls -la "${HOME}" | sed -n '1,80p'

CENTRAL="${HOME}/mysql_data"
HAS_CENTRAL_GWON=0
if sudo test -d "${CENTRAL}/gwon"; then
  HAS_CENTRAL_GWON=1
  echo "[recover] 중앙 경로에 gwon 스키마 있음: $CENTRAL"
fi

docker network inspect global_network >/dev/null 2>&1 || docker network create global_network

echo "[recover] 죽은 gwon-db 제거 (볼륨은 유지)"
docker rm -f gwon-db >/dev/null 2>&1 || true

if [[ "$HAS_CENTRAL_GWON" -eq 1 ]]; then
  echo "[recover] /home/gwon/mysql_data 로 gwon-db 기동 (호스트 3306 안 염)"
  docker run -d \
    --name gwon-db \
    --restart always \
    --network global_network \
    -e MYSQL_ROOT_PASSWORD="$PASS" \
    -v "${CENTRAL}:/var/lib/mysql" \
    mysql:latest \
    --character-set-server=utf8mb4 \
    --collation-server=utf8mb4_unicode_ci
else
  echo "[recover] 중앙 경로에 gwon 없음. 예전 볼륨 gwon_db_data 를 붙입니다."
  docker run -d \
    --name gwon-db \
    --restart always \
    --network global_network \
    -e MYSQL_ROOT_PASSWORD="$PASS" \
    -v gwon_db_data:/var/lib/mysql \
    mysql:latest \
    --character-set-server=utf8mb4 \
    --collation-server=utf8mb4_unicode_ci
fi

echo "[recover] MySQL 대기"
ok=0
for i in $(seq 1 30); do
  if docker exec gwon-db mysqladmin ping -uroot -p"$PASS" --silent >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done
if [[ "$ok" -ne 1 ]]; then
  echo "[recover] MySQL 기동 실패. 로그:" >&2
  docker logs --tail=40 gwon-db || true
  exit 1
fi

echo "======== SHOW DATABASES ========"
docker exec gwon-db mysql -uroot -p"$PASS" -e "SHOW DATABASES;"
docker exec gwon-db mysql -uroot -p"$PASS" -e "SHOW TABLES FROM gwon;" 2>/dev/null || true

if docker inspect gwon-backend >/dev/null 2>&1; then
  echo "[recover] gwon-backend 재시작"
  docker restart gwon-backend
fi

echo "======== meter ========"
docker ps -a --format '{{.Names}} {{.Status}}' | grep -i meter || true
for d in "${HOME}/meter" "${HOME}/Meter" "${HOME}/gwon-meter"; do
  if [[ -f "${d}/docker-compose.yml" ]]; then
    echo "[recover] meter compose: $d"
    (cd "$d" && docker compose up -d)
  fi
done
for name in $(docker ps -a --format '{{.Names}}' | grep -i meter || true); do
  echo "[recover] restart $name"
  docker start "$name" >/dev/null || docker restart "$name" || true
done

echo "======== 최종 상태 ========"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
if docker inspect gwon-backend >/dev/null 2>&1; then
  sleep 3
  docker logs --tail=15 gwon-backend || true
fi
echo "[recover] 완료"
