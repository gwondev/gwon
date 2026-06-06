const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export async function askGemini({ system, history, message }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI API 키가 설정되지 않았습니다.");

  const contents = [];
  for (const turn of history || []) {
    if (!turn?.content?.trim()) continue;
    contents.push({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content.trim() }],
    });
  }
  contents.push({ role: "user", parts: [{ text: message.trim() }] });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
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
    throw new Error(msg);
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .filter(Boolean)
    .join("")
    ?.trim();

  if (!text) throw new Error("답변을 생성하지 못했습니다.");
  return text;
}
