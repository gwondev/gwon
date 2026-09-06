#!/usr/bin/env bash
# 예전에 쓰던 재배포와 동일한 순서. gwon-db / 운영 볼륨은 건드리지 않는다.
set -euo pipefail
cd ~
rm -rf gwon
git clone https://github.com/gwondev/gwon.git
cd gwon
chmod +x scripts/prepare-env.sh
./scripts/prepare-env.sh ../.env.production
docker compose down
docker compose up --build -d
docker compose ps
