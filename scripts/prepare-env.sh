#!/usr/bin/env bash
#
# prepare-env.sh
# 서버의 공용 시크릿 파일(.env.production)에서 이 프로젝트(GWON)에 필요한 값만
# 골라 docker compose 가 읽는 .env 파일을 생성합니다.
#
# 사용법:
#   chmod +x scripts/prepare-env.sh
#   ./scripts/prepare-env.sh ../.env.production
#
set -euo pipefail

SRC="${1:-../.env.production}"
OUT=".env"

if [[ ! -f "$SRC" ]]; then
  echo "[prepare-env] 시크릿 파일을 찾을 수 없습니다: $SRC" >&2
  exit 1
fi

# 파일에서 KEY=VALUE 형태의 값을 읽는다 (값에 '='가 들어 있어도 안전)
read_val() {
  local key="$1" file="$2"
  [[ -f "$file" ]] || return 0
  grep -E "^${key}=" "$file" | head -n1 | sed -E "s/^${key}=//" || true
}

# ── 1) 운영 시크릿(.env.production)에서 주입 ───────────────────────────
GOOGLE_CLIENT_ID="$(read_val GOOGLE_CLIENT_ID_GWON "$SRC")"
DB_ROOT_PASSWORD="$(read_val DB_PASSWORD "$SRC")"
JWT_SECRET="$(read_val JWT_SECRET "$SRC")"
# 관리자(ADMIN)로 자동 승격할 이메일 목록 (쉼표 구분). 예: ADMIN_EMAILS_GWON=me@gmail.com
ADMIN_EMAILS="$(read_val ADMIN_EMAILS_GWON "$SRC")"
[[ -z "$ADMIN_EMAILS" ]] && ADMIN_EMAILS="$(read_val ADMIN_EMAILS "$SRC")"

GEMINI_API_KEY="$(read_val GWON_GEMINI_API_KEY "$SRC")"
CLOUDFLARE_TUNNEL_TOKEN="$(read_val CLOUDFLARE_TUNNEL_TOKEN "$SRC")"
[[ -z "$CLOUDFLARE_TUNNEL_TOKEN" ]] && CLOUDFLARE_TUNNEL_TOKEN="$(read_val CLOUDFLARE_TUNNEL_TOKEN "$OUT")"
[[ -z "${DB_ROOT_PASSWORD}" ]] && DB_ROOT_PASSWORD="$(read_val DB_ROOT_PASSWORD "$OUT")"

# JWT_SECRET 이 없으면 생성하고, 다음 배포에도 유지되도록 시크릿 파일에 보관
if [[ -z "$JWT_SECRET" ]]; then
  JWT_SECRET="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  echo "JWT_SECRET=${JWT_SECRET}" >> "$SRC"
  echo "[prepare-env] JWT_SECRET 을 새로 생성해 ${SRC} 에 저장했습니다."
fi

# ── 3) 필수값 검증 ───────────────────────────────────────────────────
if [[ -z "$GOOGLE_CLIENT_ID" ]]; then
  echo "[prepare-env] 경고: ${SRC} 에서 GOOGLE_CLIENT_ID_GWON 을 찾지 못했습니다. 구글 로그인이 동작하지 않습니다." >&2
fi
if [[ -z "$DB_ROOT_PASSWORD" ]]; then
  echo "[prepare-env] 오류: DB_PASSWORD(또는 DB_ROOT_PASSWORD) 를 찾지 못했습니다." >&2
  exit 1
fi
if [[ -z "$CLOUDFLARE_TUNNEL_TOKEN" ]]; then
  echo "[prepare-env] 경고: CLOUDFLARE_TUNNEL_TOKEN 이 비어 있습니다." >&2
fi
if [[ -z "$GEMINI_API_KEY" ]]; then
  echo "[prepare-env] 경고: GWON_GEMINI_API_KEY 를 찾지 못했습니다. AI 챗봇이 동작하지 않습니다." >&2
fi

# ── 4) .env 생성 ─────────────────────────────────────────────────────
cat > "$OUT" <<EOF
# 이 파일은 scripts/prepare-env.sh 가 자동 생성합니다. 직접 수정하지 마세요.
DB_ROOT_PASSWORD=${DB_ROOT_PASSWORD}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
JWT_SECRET=${JWT_SECRET}
ADMIN_EMAILS=${ADMIN_EMAILS}
GEMINI_API_KEY=${GEMINI_API_KEY}
CLOUDFLARE_TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
EOF

echo "[prepare-env] .env 생성 완료:"
echo "  - DB_ROOT_PASSWORD      : (설정됨)"
echo "  - GOOGLE_CLIENT_ID      : ${GOOGLE_CLIENT_ID:0:18}…"
echo "  - JWT_SECRET            : (설정됨)"
echo "  - ADMIN_EMAILS          : ${ADMIN_EMAILS:-(없음 — 관리자 자동승격 비활성)}"
echo "  - GEMINI_API_KEY        : ${GEMINI_API_KEY:+ (설정됨)}${GEMINI_API_KEY:- (없음 — 챗봇 비활성)}"
echo "  - CLOUDFLARE_TUNNEL_TOKEN: (${#CLOUDFLARE_TUNNEL_TOKEN} chars)"
