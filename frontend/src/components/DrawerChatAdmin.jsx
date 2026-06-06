import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import "./DrawerChatAdmin.css";

export default function DrawerChatAdmin({ open }) {
  const { token, localMode } = useAuth();
  const [systemPrompt, setSystemPrompt] = useState("");
  const [extraPrompt, setExtraPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    if (localMode) {
      setSystemPrompt("");
      setExtraPrompt("");
      return;
    }
    try {
      const data = await api("/admin/chat-prompt", { token });
      setSystemPrompt(data.systemPrompt || "");
      setExtraPrompt(data.extraPrompt || "");
    } catch (e) {
      setMsg({ type: "err", text: e.message });
    }
  }, [token, localMode]);

  useEffect(() => {
    if (open) {
      setMsg(null);
      load();
    }
  }, [open, load]);

  const save = async (e) => {
    e.preventDefault();
    if (localMode) {
      setMsg({ type: "ok", text: "로컬 모드 — 저장은 서버 배포 후 가능합니다." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await api("/admin/chat-prompt", {
        method: "PUT",
        body: { systemPrompt, extraPrompt },
        token,
      });
      setMsg({ type: "ok", text: "AI 프롬프트가 저장되었습니다." });
    } catch (e2) {
      setMsg({ type: "err", text: e2.message });
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <form className="drawer-chat-admin" onSubmit={save}>
      <p className="drawer-chat-admin__desc">
        기본 규칙과 추가 지침은 DB에 저장되며, 챗봇 답변에 반영됩니다.
      </p>
      <label className="drawer-chat-admin__label">
        기본 규칙
        <textarea
          className="drawer-chat-admin__area"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={5}
          placeholder="AI 기본 답변 규칙"
        />
      </label>
      <label className="drawer-chat-admin__label">
        추가 지침
        <textarea
          className="drawer-chat-admin__area"
          value={extraPrompt}
          onChange={(e) => setExtraPrompt(e.target.value)}
          rows={4}
          placeholder="예: 강점은 백엔드와 IoT 프로젝트 경험입니다. 수상 경력을 우선 언급해주세요."
        />
      </label>
      {msg && (
        <p className={`drawer-chat-admin__msg ${msg.type === "err" ? "is-err" : "is-ok"}`}>
          {msg.text}
        </p>
      )}
      <button type="submit" className="btn btn-accent drawer-chat-admin__save" disabled={busy}>
        {busy ? "저장 중…" : "지침 저장"}
      </button>
    </form>
  );
}
