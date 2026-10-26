import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../../lib/api.js";
import "./DriveStore.css";

export function driveKindOf(section) {
  const src = section?.source;
  if (!src) return "root";
  if (src.kind === "projects") return "project";
  if (src.kind === "hero") return "hero";
  if (src.kind === "tab" || src.kind === "world") return src.id;
  return "root";
}

export function VaultButton({ onClick, label = "Drive 금고 열기" }) {
  return (
    <button
      type="button"
      className="uv-vault"
      data-no-nav
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.(e);
      }}
      aria-label={label}
      title={`${label} (Alt+클릭)`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.5" y="8" width="15" height="12" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 8V6.4A4 4 0 0 1 12 2.5 4 4 0 0 1 16 6.4V8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="14" r="1.5" fill="currentColor" />
      </svg>
    </button>
  );
}

function typeLabel(item) {
  if (!item) return "";
  if (item.isFolder) return "FOLDER";
  const mime = item.mime || "";
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("document") || mime.includes("msword")) return "DOC";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "SHEET";
  if (mime.includes("presentation")) return "SLIDE";
  if (mime.startsWith("text/")) return "TEXT";
  return "FILE";
}

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function FileMark({ item }) {
  const t = typeLabel(item);
  const thumb = item?.thumbnailLink && (t === "IMAGE" || t === "VIDEO");
  const [broken, setBroken] = useState(false);
  if (thumb && !broken) {
    return <img className="uv-drive__thumb" src={item.thumbnailLink} alt="" onError={() => setBroken(true)} />;
  }
  return (
    <span className={`uv-drive__glyph uv-drive__glyph--${t.toLowerCase()}`} aria-hidden="true">
      {t === "FOLDER" ? "▣" : t === "IMAGE" ? "▣" : t === "VIDEO" ? "▶" : t === "PDF" ? "P" : "◇"}
    </span>
  );
}

export default function DriveStore({ open, onClose, contentKind, contentId, contentTitle, token }) {
  const [status, setStatus] = useState(null);
  const [folder, setFolder] = useState(null);
  const [children, setChildren] = useState([]);
  const [path, setPath] = useState([]);
  const [link, setLink] = useState(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(() => (typeof window !== "undefined" ? window.innerWidth > 767 : true));
  const [currentId, setCurrentId] = useState(null);

  const title = contentTitle || "VAULT";

  const loadStatus = useCallback(async () => {
    if (!token) {
      setStatus({
        configured: false,
        missingEnv: [
          "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON",
          "GOOGLE_DRIVE_CLIENT_ID",
          "GOOGLE_DRIVE_CLIENT_SECRET",
          "GOOGLE_DRIVE_REFRESH_TOKEN",
          "GOOGLE_DRIVE_ROOT_FOLDER_ID",
        ],
        message: "로그인 토큰이 없습니다. 로컬 미리보기가 아니라 서버에 SUPER_ADMIN 으로 로그인해야 Drive 를 호출할 수 있습니다.",
      });
      return null;
    }
    const data = await api("/drive/status", { token });
    setStatus(data);
    return data;
  }, [token]);

  const loadFolder = useCallback(
    async (id) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      setErrorCode(null);
      setHits(null);
      try {
        const params = new URLSearchParams();
        if (id) params.set("id", id);
        if (contentKind) params.set("content_kind", contentKind);
        if (contentId != null) params.set("content_id", contentId);
        const data = await api(`/drive/folder?${params.toString()}`, { token });
        setFolder(data.folder || null);
        setChildren(data.children || []);
        setPath(data.path || []);
        setLink(data.link || null);
        setCurrentId(data.folder?.id || null);
      } catch (err) {
        setFolder(null);
        setChildren([]);
        setPath([]);
        setError(err.data?.error || err.message);
        setErrorCode(err.data?.code || null);
        if (err.data?.configured === false) {
          setStatus((s) => ({
            ...(s || {}),
            configured: false,
            missingEnv: err.data.missingEnv || s?.missingEnv || [],
            message: err.data.message || err.data.error,
          }));
        }
      } finally {
        setLoading(false);
      }
    },
    [token, contentKind, contentId]
  );

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setQuery("");
    setHits(null);
    setError(null);
    setCurrentId(null);
    (async () => {
      try {
        const st = await loadStatus();
        if (!alive) return;
        if (st?.configured) await loadFolder(null);
      } catch (err) {
        if (!alive) return;
        setError(err.data?.error || err.message);
        setErrorCode(err.data?.code || null);
      }
    })();
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, loadStatus, loadFolder, onClose]);

  useEffect(() => {
    if (!open || !token || !query.trim()) {
      setHits(null);
      setSearching(false);
      return undefined;
    }
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: query.trim() });
        if (currentId) params.set("id", currentId);
        const data = await api(`/drive/search?${params.toString()}`, { token });
        setHits(data.items || []);
        setError(null);
      } catch (err) {
        setError(err.data?.error || err.message);
        setErrorCode(err.data?.code || null);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [query, open, token, currentId]);

  const shown = hits || children;
  const configured = Boolean(status?.configured);
  const parentId = folder?.parents?.[0] || null;
  const atRoot = Boolean(status?.rootFolderId && folder?.id === status.rootFolderId);
  const canGoUp = Boolean(parentId) && !atRoot;
  const owner = folder?.owners?.[0];

  const syncLabel = useMemo(() => {
    if (syncing) return "SYNCING";
    if (status?.lastError) return "ERROR";
    if (status?.lastSyncAt) return "OK";
    return configured ? "IDLE" : "OFFLINE";
  }, [syncing, status, configured]);

  async function handleSync() {
    if (!token) return;
    setSyncing(true);
    try {
      await api("/drive/sync", { method: "POST", token });
      await loadStatus();
      await loadFolder(currentId);
    } catch (err) {
      setError(err.data?.error || err.message);
      setErrorCode(err.data?.code || null);
      await loadStatus().catch(() => {});
    } finally {
      setSyncing(false);
    }
  }

  async function handleLink(item) {
    if (!token || !contentKind || !item?.id) return;
    setLinking(true);
    try {
      const body = {
        content_kind: contentKind,
        content_id: contentId || "",
        role: item.isFolder ? "folder" : item.mime?.startsWith("video/") ? "video" : item.mime?.startsWith("image/") ? "cover" : "doc",
        folder_id: item.isFolder ? item.id : item.parents?.[0] || folder?.id || null,
        file_id: item.isFolder ? null : item.id,
      };
      const data = await api("/drive/link", { method: "PUT", token, body });
      setLink(data.link || null);
    } catch (err) {
      setError(err.data?.error || err.message);
      setErrorCode(err.data?.code || null);
    } finally {
      setLinking(false);
    }
  }

  async function linkCurrentFolder() {
    if (!folder?.id) return;
    await handleLink({ ...folder, isFolder: true, parents: folder.parents });
  }

  function openItem(item) {
    if (item.isFolder) {
      setQuery("");
      loadFolder(item.id);
      return;
    }
    if (item.webViewLink) window.open(item.webViewLink, "_blank", "noopener,noreferrer");
  }

  if (!open) return null;

  return createPortal(
    <div className="uv-drive" data-modal data-no-nav role="dialog" aria-modal="true" aria-label="Drive 금고">
      <button type="button" className="uv-drive__scrim" onClick={onClose} aria-label="닫기" />
      <div className="uv-drive__box">
        <header className="uv-drive__top">
          <div className="uv-drive__kicker">
            <span>VAULT</span>
            <i />
            <span>{contentKind || "root"}</span>
          </div>
          <h2 className="uv-drive__name" title={folder?.name || title}>
            {folder?.name || (configured ? "금고" : "미연결")}
          </h2>
          <p className="uv-drive__bound" title={title}>
            {title}
            {contentId ? ` · ${contentId}` : ""}
          </p>
          <div className="uv-drive__tools">
            <label className="uv-drive__search">
              <span>SEARCH</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이 폴더에서 이름 검색"
                disabled={!configured}
                autoComplete="off"
              />
            </label>
            <span className={`uv-drive__sync is-${syncLabel.toLowerCase()}`}>
              <b>SYNC</b> {syncLabel}
            </span>
            <button type="button" className="uv-drive__x" onClick={onClose} aria-label="닫기">
              ✕
            </button>
          </div>
        </header>

        <button
          type="button"
          className={`uv-drive__details-toggle${detailsOpen ? " is-on" : ""}`}
          onClick={() => setDetailsOpen((v) => !v)}
        >
          DETAILS {detailsOpen ? "▾" : "▸"}
        </button>
        {detailsOpen && (
          <dl className="uv-drive__meta">
            <div>
              <dt>PATH</dt>
              <dd title={path.map((p) => p.name).join(" / ")}>{path.length ? path.map((p) => p.name).join(" / ") : "—"}</dd>
            </div>
            <div>
              <dt>FOLDER ID</dt>
              <dd className="uv-drive__mono">{folder?.id || "—"}</dd>
            </div>
            <div>
              <dt>MIME</dt>
              <dd>{folder?.mime || "—"}</dd>
            </div>
            <div>
              <dt>LAST SYNC</dt>
              <dd>{formatWhen(status?.lastSyncAt)}</dd>
            </div>
            <div>
              <dt>OWNER</dt>
              <dd>{owner ? owner.name || owner.email : status?.serviceAccountEmail || "—"}</dd>
            </div>
            <div>
              <dt>LINK</dt>
              <dd>{link?.folderId || link?.fileId || "미연결"}</dd>
            </div>
          </dl>
        )}

        <div className="uv-drive__body" data-ui-scroll>
          {!configured ? (
            <div className="uv-drive__empty">
              <span className="uv-drive__code">NO SIGNAL</span>
              <p>{status?.message || error || "Google Drive 가 연결되지 않았습니다."}</p>
              {status?.missingEnv?.length > 0 && (
                <ul>
                  {status.missingEnv.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              )}
              <p className="uv-drive__hint">서버 .env 에만 넣고, 프론트엔드에 시크릿을 넣지 마세요. 폴더 ID는 Drive에서 확인한 값만 사용합니다.</p>
            </div>
          ) : error && !folder ? (
            <div className="uv-drive__empty">
              <span className="uv-drive__code">{(errorCode || "ERROR").toUpperCase()}</span>
              <p>{error}</p>
            </div>
          ) : loading && !folder ? (
            <div className="uv-drive__empty">
              <span className="uv-drive__code">LOADING</span>
              <p>Drive 목록을 불러오는 중입니다.</p>
            </div>
          ) : (
            <>
              {error && <p className="uv-drive__banner">{error}</p>}
              {searching && <p className="uv-drive__banner">검색 중…</p>}
              {hits && (
                <p className="uv-drive__banner">
                  현재 폴더에서 “{query.trim()}” · {hits.length}건
                </p>
              )}
              {!shown.length ? (
                <div className="uv-drive__empty">
                  <span className="uv-drive__code">EMPTY</span>
                  <p>이 폴더에 표시할 파일이 없습니다. Drive에 실제로 있는 항목만 보여 줍니다.</p>
                </div>
              ) : (
                <ul className="uv-drive__grid">
                  {shown.map((item) => (
                    <li key={item.id}>
                      <button type="button" className="uv-drive__card" onDoubleClick={() => openItem(item)} onClick={() => openItem(item)}>
                        <FileMark item={item} />
                        <span className="uv-drive__card-name" title={item.name}>
                          {item.name || item.id}
                        </span>
                        <span className="uv-drive__card-type">{typeLabel(item)}</span>
                        <span className="uv-drive__card-when">{formatWhen(item.modifiedTime)}</span>
                      </button>
                      {contentKind && (
                        <button type="button" className="uv-drive__pin" onClick={() => handleLink(item)} disabled={linking}>
                          연결
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <footer className="uv-drive__bar">
          <button type="button" onClick={() => loadFolder(parentId)} disabled={!canGoUp || loading}>
            UP
          </button>
          <button type="button" onClick={() => loadFolder(currentId)} disabled={!configured || loading}>
            REFRESH
          </button>
          <button
            type="button"
            onClick={() => folder?.webViewLink && window.open(folder.webViewLink, "_blank", "noopener,noreferrer")}
            disabled={!folder?.webViewLink}
          >
            OPEN IN DRIVE
          </button>
          <button type="button" onClick={handleSync} disabled={!configured || syncing}>
            {syncing ? "SYNC…" : "SYNC NOW"}
          </button>
          {contentKind && (
            <button type="button" onClick={linkCurrentFolder} disabled={!folder?.id || linking}>
              {linking ? "LINK…" : "LINK FOLDER"}
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body
  );
}
