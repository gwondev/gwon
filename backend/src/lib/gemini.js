// 2026-06 기준: 2.0/1.5 flash 계열 종료 → 3.5/2.5 사용
const FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

const MODELS = [process.env.GEMINI_MODEL, ...FALLBACK_MODELS].filter(Boolean);

function normalizeHistory(history) {
  const out = [];
  for (const turn of history || []) {
    const role = turn.role === "assistant" ? "model" : "user";
    const text = turn.content?.trim();
    if (!text) continue;
    if (out.length && out[out.length - 1].role === role) {
      out[out.length - 1].parts[0].text += `\n${text}`;
      continue;
    }
    out.push({ role, parts: [{ text }] });
  }
  if (out.length && out[0].role === "model") out.shift();
  return out;
}

async function callModel(model, apiKey, system, contents, generationConfigOverrides = {}) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
          temperature: 0.55,
          maxOutputTokens: 1024,
          ...generationConfigOverrides,
        },
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `Gemini API 오류 (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .filter(Boolean)
    .join("")
    ?.trim();

  if (!text) throw new Error("답변을 생성하지 못했습니다.");
  return text;
}

export function getGeminiModels() {
  return [...new Set(MODELS)];
}

/**
 * Gemini에 구조화된 JSON 응답을 요청한다. schema는 Gemini의 OpenAPI 서브셋 스키마 객체.
 * 모델이 스키마를 못 지키면 코드펜스 제거 후 1회 재시도 후 실패 처리한다.
 */
export async function askGeminiJson({ system, message, schema }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI API 키가 설정되지 않았습니다.");

  const contents = [{ role: "user", parts: [{ text: message.trim() }] }];
  const generationConfigOverrides = {
    // 후보가 많으면(예: 55개) 기본 1024 토큰으로는 응답이 중간에 잘려 JSON이 깨진다.
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
    ...(schema ? { responseSchema: schema } : {}),
  };

  let lastErr;
  for (const model of getGeminiModels()) {
    try {
      const raw = await callModel(model, apiKey, system, contents, generationConfigOverrides);
      try {
        return JSON.parse(raw);
      } catch {
        // 코드펜스 제거 + 트레일링 콤마 제거 후 1회 더 시도
        const cleaned = raw
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/```\s*$/, "")
          .replace(/,(\s*[}\]])/g, "$1")
          .trim();
        return JSON.parse(cleaned);
      }
    } catch (err) {
      lastErr = err;
      console.warn(`[gemini:json] ${model} failed:`, err.message);
      if (err.status === 404 || /not found|not supported/i.test(err.message)) continue;
      throw err;
    }
  }
  throw lastErr || new Error("Gemini JSON 응답 생성에 실패했습니다.");
}

export async function askGemini({ system, history, message, maxOutputTokens, temperature }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI API 키가 설정되지 않았습니다.");

  const contents = normalizeHistory(history);
  contents.push({ role: "user", parts: [{ text: message.trim() }] });
  const overrides = {};
  if (maxOutputTokens) overrides.maxOutputTokens = maxOutputTokens;
  if (temperature != null) overrides.temperature = temperature;

  let lastErr;
  for (const model of getGeminiModels()) {
    try {
      const reply = await callModel(model, apiKey, system, contents, overrides);
      console.log(`[gemini] ok: ${model}`);
      return reply;
    } catch (err) {
      lastErr = err;
      console.warn(`[gemini] ${model} failed:`, err.message);
      if (err.status === 404 || /not found|not supported/i.test(err.message)) continue;
      throw err;
    }
  }
  throw lastErr || new Error("Gemini API 호출에 실패했습니다.");
}
