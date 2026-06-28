import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "../components/PageTransition";
import { useAuth } from "../context/AuthContext";
import { useResource } from "../lib/useResource";
import { parseMedia, stringifyMedia, mediaDisplayName } from "../lib/media";
import "./DataPage.css";

const SECTIONS = [
  {
    table: "projects",
    title: "프로젝트 & 공모전",
    desc: "프로젝트·공모전 기록에 등록된 사진·영상 원본 자료입니다.",
  },
  {
    table: "activities",
    title: "활동",
    desc: "동아리·대외활동 기록에 등록된 사진·영상 자료입니다.",
  },
  {
    table: "certifications",
    title: "자격증",
    desc: "자격·인증 관련으로 등록된 사진·영상 자료입니다.",
  },
  {
    table: "careers",
    title: "경력",
    desc: "실무 경력 기록에 등록된 사진·영상 자료입니다.",
  },
];

const MIME_EXT = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
};

function dataUrlMime(dataUrl) {
  const m = /^data:([^;]+)/.exec(dataUrl || "");
  return m ? m[1] : "";
}

function extFromDataUrl(dataUrl) {
  const mime = dataUrlMime(dataUrl);
  if (MIME_EXT[mime]) return MIME_EXT[mime];
  if (mime.startsWith("video/")) return "mp4";
  if (mime === "application/pdf") return "pdf";
  return "jpg";
}

function dataUrlToBlob(dataUrl) {
  const [head, b64] = String(dataUrl).split(",");
  const mime = /:(.*?);/.exec(head)?.[1] || "application/octet-stream";
  const bin = atob(b64 || "");
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function sanitizeFilename(name) {
  return String(name || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim() || "media";
}

function downloadMedia(src, filename) {
  try {
    const blob = dataUrlToBlob(src);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch {
    // data URL 직접 다운로드로 폴백
    const a = document.createElement("a");
    a.href = src;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

function MediaRow({ row, onSave }) {
  const [value, setValue] = useState(row.displayName);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setValue(row.displayName);
  }, [row.displayName]);

  const src = row.media.video || row.media.image || row.media.pdf || "";

  const commit = async () => {
    const next = value.trim();
    if (!next || next === (row.media.name || "").trim()) return;
    await onSave(row, next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  };

  const handleDownload = () => {
    if (!src) return;
    const base = sanitizeFilename(value || row.displayName);
    downloadMedia(src, `${base}.${extFromDataUrl(src)}`);
  };

  return (
    <div className="datacard">
      <div className="datacard__thumb">
        {row.media.pdf ? (
          <span className="datacard__pdf">PDF</span>
        ) : row.media.video ? (
          <video src={row.media.video} muted playsInline />
        ) : row.media.image ? (
          <img src={row.media.image} alt={value} />
        ) : (
          <span>미디어 없음</span>
        )}
        <span className="datacard__kind">{row.kindLabel}</span>
      </div>

      <div className="datacard__body">
        <input
          className="datacard__name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          placeholder="이름"
          aria-label="자료 이름"
        />
        {savedFlash && <span className="datacard__saved">저장됨</span>}
        {row.media.caption && <p className="datacard__caption">{row.media.caption}</p>}
        <button type="button" className="datacard__download" onClick={handleDownload} disabled={!src}>
          ↓ 다운로드
        </button>
      </div>
    </div>
  );
}

function DataSection({ table, title, desc }) {
  const { items, loading, error, update } = useResource(table);

  // 항목(프로젝트 등)별로 묶고, 번호는 항목 안에서 따로 매긴다.
  const groups = [];
  let totalCount = 0;
  for (const item of items) {
    const list = parseMedia(item.media);
    let imgN = 0;
    let vidN = 0;
    let pdfN = 0;
    const rows = [];
    list.forEach((media, mediaIndex) => {
      if (!media || (!media.image && !media.video && !media.pdf)) return;
      const isPdf = Boolean(media.pdf);
      const isVideo = !isPdf && Boolean(media.video);
      const kindIndex = isPdf ? ++pdfN : isVideo ? ++vidN : ++imgN;
      rows.push({
        key: `${item.id}:${mediaIndex}`,
        itemId: item.id,
        mediaIndex,
        media,
        kindLabel: isPdf ? "PDF" : isVideo ? "동영상" : "사진",
        displayName: mediaDisplayName(media, kindIndex),
      });
    });
    if (rows.length > 0) {
      totalCount += rows.length;
      groups.push({ item, rows });
    }
  }

  const handleSave = async (row, newName) => {
    const list = parseMedia(items.find((it) => it.id === row.itemId)?.media);
    if (!list[row.mediaIndex]) return;
    list[row.mediaIndex] = { ...list[row.mediaIndex], name: newName };
    await update(row.itemId, { media: stringifyMedia(list) });
  };

  return (
    <section className="datasection">
      <header className="datasection__head">
        <h2 className="datasection__title">{title}</h2>
        <span className="datasection__count">{totalCount}개 자료</span>
      </header>
      <p className="datasection__desc">{desc}</p>

      {loading ? (
        <div className="state">불러오는 중…</div>
      ) : error ? (
        <div className="state">목록을 불러오지 못했습니다.</div>
      ) : groups.length === 0 ? (
        <div className="state">저장된 사진·영상·PDF가 없습니다.</div>
      ) : (
        <div className="datasection__groups">
          {groups.map((g) => (
            <div className="datagroup" key={g.item.id}>
              <div className="datagroup__head">
                <span className="datagroup__title">{g.item.title || `#${g.item.id}`}</span>
                <span className="datagroup__count">{g.rows.length}</span>
              </div>
              <div className="datasection__grid">
                {g.rows.map((row) => (
                  <MediaRow key={row.key} row={row} onSave={handleSave} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function DataPage() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isSuperAdmin) navigate("/", { replace: true });
  }, [loading, isSuperAdmin, navigate]);

  if (!isSuperAdmin) return null;

  return (
    <PageTransition className="page data-page">
      <motion.header
        className="data-page__head"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div>
          <span className="eyebrow">Data Vault · SUPER ADMIN</span>
          <h1 className="section-title">데이터 보관함</h1>
        </div>
        <button type="button" className="data-page__back" onClick={() => navigate("/")}>
          ← 메인으로
        </button>
      </motion.header>

      <p className="data-page__lead">
        각 DB에 저장된 사진·영상 원본을 확인하고 내려받을 수 있습니다. 이름을 입력하면 파일명으로
        저장되며, 비워두면 저장 순서대로 임시 이름(사진1, 동영상1…)이 적용됩니다.
      </p>

      {SECTIONS.map((s) => (
        <DataSection key={s.table} table={s.table} title={s.title} desc={s.desc} />
      ))}
    </PageTransition>
  );
}
