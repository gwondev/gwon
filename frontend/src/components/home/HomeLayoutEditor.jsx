import "./HomeLayoutEditor.css";

const FIELDS = [
  { key: "profileCols", label: "프로필 칸 수", min: 1, max: 6, step: 1, suffix: "칸" },
  { key: "profileCardH", label: "프로필 카드 높이", min: 140, max: 720, step: 10, suffix: "px" },
  { key: "projectMediaH", label: "프로젝트 미디어 높이", min: 18, max: 80, step: 1, suffix: "vh" },
  { key: "projectMediaMax", label: "미디어 최대 높이", min: 180, max: 900, step: 10, suffix: "px" },
];

export default function HomeLayoutEditor({ homeLayout }) {
  const { layout, key, mobile, dirty, saving, patch, save, reset } = homeLayout;
  const bp = layout[key];

  return (
    <aside className="world-layout" aria-label="홈 레이아웃 편집">
      <header className="world-layout__head">
        <p>레이아웃</p>
        <em>{mobile ? "모바일" : "데스크탑"}</em>
      </header>
      <p className="world-layout__hint">지금 화면 너비에 저장됩니다. 창을 줄이거나 늘려 각각 맞추세요.</p>
      {FIELDS.map((f) => (
        <label key={f.key} className="world-layout__row">
          <span>
            {f.label}
            <b>
              {bp[f.key]}
              {f.suffix}
            </b>
          </span>
          <input
            type="range"
            min={f.min}
            max={f.max}
            step={f.step}
            value={bp[f.key]}
            onChange={(e) => patch(key, f.key, Number(e.target.value))}
          />
        </label>
      ))}
      <div className="world-layout__acts">
        <button type="button" onClick={reset}>
          기본값
        </button>
        <button type="button" className="is-save" disabled={!dirty || saving} onClick={save}>
          {saving ? "저장…" : dirty ? "저장" : "저장됨"}
        </button>
      </div>
    </aside>
  );
}
