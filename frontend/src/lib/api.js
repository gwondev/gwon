const BASE = import.meta.env.VITE_API_BASE || "/api";

function isRetryableStatus(status) {
  return status === 502 || status === 503 || status === 504 || status === 429;
}

export function isQuietNetworkError(err) {
  const status = Number(err?.status);
  const msg = String(err?.message || err || "");
  return (
    status === 418 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /418|429|502|503|504|공개 API|failed to fetch|networkerror|load failed|econnreset|econnrefused|etimedout|timeout|시세를 잠시|일시적/i.test(msg)
  );
}

async function requestOnce(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `요청 실패 (${res.status})`);
    err.status = res.status;
    err.data = data;
    if (data.quota) err.quota = data.quota;
    throw err;
  }
  return data;
}

export async function api(path, opts = {}) {
  try {
    return await requestOnce(path, opts);
  } catch (err) {
    const method = String(opts.method || "GET").toUpperCase();
    if (method === "GET" && (isRetryableStatus(err.status) || isQuietNetworkError(err))) {
      await new Promise((r) => setTimeout(r, 350));
      return requestOnce(path, opts);
    }
    throw err;
  }
}
