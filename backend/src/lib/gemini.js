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

async function callModel(model, apiKey, system, contents) {
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

export async function askGemini({ system, history, message }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI API 키가 설정되지 않았습니다.");

  const contents = normalizeHistory(history);
  contents.push({ role: "user", parts: [{ text: message.trim() }] });

  let lastErr;
  for (const model of getGeminiModels()) {
    try {
      const reply = await callModel(model, apiKey, system, contents);
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
