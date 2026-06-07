import { normalizeUrl } from "../lib/url";

export default function RecordUrl({ url }) {
  const raw = String(url || "").trim();
  if (!raw) return null;

  return (
    <p className="record__url">
      <b>접속주소</b>
      <a
        href={normalizeUrl(raw)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {raw}
      </a>
    </p>
  );
}
