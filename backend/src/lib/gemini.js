const MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-2.0-flash",
  "gemini-1.5-flash",
].filter(Boolean);

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
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

export async function askGemini({ system, history, message }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI API 키가 설정되지 않았습니다.");

  const contents = normalizeHistory(history);
  contents.push({ role: "user", parts: [{ text: message.trim() }] });

  let lastErr;
  for (const model of [...new Set(MODELS)]) {
    try {
      return await callModel(model, apiKey, system, contents);
    } catch (err) {
      lastErr = err;
      console.warn(`[gemini] ${model} failed:`, err.message);
      // 모델 없음/권한 문제면 다음 모델 시도
      if (err.status === 404 || /not found/i.test(err.message)) continue;
      throw err;
    }
  }
  throw lastErr || new Error("Gemini API 호출에 실패했습니다.");
}
