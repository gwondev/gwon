/**
 * Google Drive 미니 금고 (서버 전용).
 *
 * 필요한 환경 변수 (프론트에 넣지 말 것. 값은 로그에 남기지 말 것):
 *   서비스 계정:
 *     GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON  — 인라인 JSON 또는 컨테이너 안 파일 경로
 *   또는 사용자 refresh token:
 *     GOOGLE_DRIVE_CLIENT_ID
 *     GOOGLE_DRIVE_CLIENT_SECRET
 *     GOOGLE_DRIVE_REFRESH_TOKEN
 *   선택:
 *     GOOGLE_DRIVE_ROOT_FOLDER_ID  — 사이트 금고 폴더 ID. 절대 임의 생성하지 않음.
 *
 * 스코프: drive.readonly (목록·검색·Changes API). 쓰기는 Drive가 아니라 우리 DB 매핑만.
 * 공유 폴더는 서비스 계정 이메일(또는 refresh token 계정)에 공유되어 있어야 한다.
 */
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import pool from "../db.js";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const DRIVE_READONLY = "https://www.googleapis.com/auth/drive.readonly";
const FILE_FIELDS =
  "id,name,mimeType,modifiedTime,thumbnailLink,webViewLink,iconLink,owners(displayName,emailAddress),parents,trashed,size";
const LIST_FIELDS = `nextPageToken,files(${FILE_FIELDS})`;

export const CONTENT_KINDS = [
  "project",
  "certs",
  "experience",
  "career",
  "awards",
  "profile",
  "hero",
  "root",
  "infrastructure",
];
export const LINK_ROLES = ["folder", "cover", "video", "doc", "other"];

function env(name) {
  return String(process.env[name] || "").trim();
}

function looksLikeJson(s) {
  const t = s.trim();
  return t.startsWith("{") && t.endsWith("}");
}

function parseServiceAccount() {
  const raw = env("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON");
  if (!raw) return { credentials: null, source: null, error: null };
  try {
    if (looksLikeJson(raw)) {
      return { credentials: JSON.parse(raw), source: "inline", error: null };
    }
    const filePath = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
    if (!fs.existsSync(filePath)) {
      return {
        credentials: null,
        source: "path",
        error: "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON 경로의 파일이 없습니다.",
      };
    }
    const text = fs.readFileSync(filePath, "utf8");
    return { credentials: JSON.parse(text), source: "path", error: null };
  } catch {
    return {
      credentials: null,
      source: looksLikeJson(raw) ? "inline" : "path",
      error: "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON 이 올바른 JSON이 아닙니다.",
    };
  }
}

export function driveConfig() {
  const sa = parseServiceAccount();
  const clientId = env("GOOGLE_DRIVE_CLIENT_ID");
  const clientSecret = env("GOOGLE_DRIVE_CLIENT_SECRET");
  const refreshToken = env("GOOGLE_DRIVE_REFRESH_TOKEN");
  const rootFolderId = env("GOOGLE_DRIVE_ROOT_FOLDER_ID") || null;

  const missingEnv = [];
  let authMode = null;
  let configured = false;
  const notes = [];

  if (sa.error) {
    missingEnv.push("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON");
    notes.push(sa.error);
  } else if (sa.credentials?.client_email && sa.credentials?.private_key) {
    authMode = "service_account";
    configured = true;
  }

  if (!configured) {
    if (!clientId) missingEnv.push("GOOGLE_DRIVE_CLIENT_ID");
    if (!clientSecret) missingEnv.push("GOOGLE_DRIVE_CLIENT_SECRET");
    if (!refreshToken) missingEnv.push("GOOGLE_DRIVE_REFRESH_TOKEN");
    if (clientId && clientSecret && refreshToken) {
      authMode = "refresh_token";
      configured = true;
      // refresh token 경로가 되면 SA 관련 결함은 자격 증명 부족이 아님
      const saIdx = missingEnv.indexOf("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON");
      if (saIdx >= 0) missingEnv.splice(saIdx, 1);
    }
  }

  if (!configured && !missingEnv.length) {
    missingEnv.push(
      "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON",
      "GOOGLE_DRIVE_CLIENT_ID",
      "GOOGLE_DRIVE_CLIENT_SECRET",
      "GOOGLE_DRIVE_REFRESH_TOKEN"
    );
  }

  if (!rootFolderId) missingEnv.push("GOOGLE_DRIVE_ROOT_FOLDER_ID");

  let message;
  if (configured && rootFolderId) {
    message = "Google Drive 가 연결되어 있습니다.";
  } else if (configured && !rootFolderId) {
    message =
      "Drive 자격 증명은 있습니다. 사이트 금고 폴더 ID(GOOGLE_DRIVE_ROOT_FOLDER_ID)가 없거나, 콘텐츠에 루트 폴더를 연결해야 목록을 열 수 있습니다. 폴더 ID는 Drive에서 확인한 값만 쓰세요.";
  } else {
    message = `Google Drive 가 연결되지 않았습니다. 서비스 계정(GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON) 또는 refresh token(GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN)을 서버 환경 변수로 설정하세요.${notes.length ? ` ${notes.join(" ")}` : ""}`;
  }

  return {
    configured,
    authMode,
    missingEnv: [...new Set(missingEnv)],
    rootFolderId,
    message,
    serviceAccountEmail: sa.credentials?.client_email || null,
    sa,
    clientId,
    clientSecret,
    refreshToken,
  };
}

let cachedAuth = null;
let cachedAuthKey = "";

function authCacheKey(cfg) {
  if (cfg.authMode === "service_account") {
    return `sa:${cfg.serviceAccountEmail || ""}`;
  }
  if (cfg.authMode === "refresh_token") {
    return `rt:${cfg.clientId}:len${cfg.refreshToken.length}`;
  }
  return "";
}

function getAuth(cfg) {
  const key = authCacheKey(cfg);
  if (cachedAuth && cachedAuthKey === key) return cachedAuth;
  if (cfg.authMode === "service_account") {
    cachedAuth = new google.auth.GoogleAuth({
      credentials: cfg.sa.credentials,
      scopes: [DRIVE_READONLY],
    });
  } else if (cfg.authMode === "refresh_token") {
    const oauth2 = new google.auth.OAuth2(cfg.clientId, cfg.clientSecret);
    oauth2.setCredentials({ refresh_token: cfg.refreshToken });
    cachedAuth = oauth2;
  } else {
    cachedAuth = null;
  }
  cachedAuthKey = key;
  return cachedAuth;
}

export function getDriveClient(cfg = driveConfig()) {
  if (!cfg.configured) return null;
  const auth = getAuth(cfg);
  if (!auth) return null;
  return google.drive({ version: "v3", auth });
}

export function classifyDriveError(err) {
  const status = Number(err?.status || err?.code || err?.response?.status || 0);
  const reason = String(err?.errors?.[0]?.reason || err?.response?.data?.error?.errors?.[0]?.reason || "");
  const msg = String(err?.message || err?.response?.data?.error?.message || "");
  if (status === 404 || reason === "notFound" || /file not found|not found/i.test(msg)) return "not_found";
  if (status === 403 || reason === "forbidden" || /insufficient|permission|forbidden/i.test(msg)) return "forbidden";
  if (status === 401 || /invalid_grant|unauthorized|invalid credential/i.test(msg)) return "unauthorized";
  if (status === 410 || /pageToken|invalid.*token/i.test(msg)) return "stale_token";
  return "error";
}

export function driveErrorMessage(code) {
  switch (code) {
    case "unconfigured":
      return "Google Drive 가 연결되지 않았습니다.";
    case "missing":
      return "금고 폴더 ID가 없습니다. GOOGLE_DRIVE_ROOT_FOLDER_ID 를 설정하거나 루트 폴더를 연결하세요. ID는 Drive에서 확인한 값만 사용합니다.";
    case "not_found":
      return "Drive에서 해당 폴더 또는 파일을 찾을 수 없습니다.";
    case "forbidden":
      return "Drive 접근 권한이 없습니다. 폴더를 서비스 계정(또는 refresh token 계정)과 공유했는지, 스코프가 drive.readonly 이상인지 확인하세요.";
    case "unauthorized":
      return "Drive 자격 증명이 거부되었습니다. refresh token 또는 서비스 계정 JSON을 다시 확인하세요.";
    case "stale_token":
      return "동기화 커서가 만료되어 전체 목록부터 다시 맞춥니다.";
    default:
      return "Drive 요청 중 오류가 발생했습니다.";
  }
}

export function isDriveId(value) {
  return /^[a-zA-Z0-9_-]{10,128}$/.test(String(value || "").trim());
}

function escapeDriveQuery(s) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function mapFile(f) {
  if (!f?.id) return null;
  const mime = f.mimeType || "";
  return {
    id: f.id,
    name: f.name || "",
    mime,
    modifiedTime: f.modifiedTime || null,
    thumbnailLink: f.thumbnailLink || null,
    webViewLink: f.webViewLink || null,
    iconLink: f.iconLink || null,
    isFolder: mime === FOLDER_MIME,
    size: f.size != null ? Number(f.size) : null,
    owners: (f.owners || []).map((o) => ({
      name: o.displayName || "",
      email: o.emailAddress || "",
    })),
    parents: f.parents || [],
    trashed: Boolean(f.trashed),
  };
}

export async function ensureSyncStateRow() {
  await pool.query("INSERT IGNORE INTO drive_sync_state (id) VALUES (1)");
}

export async function readSyncState() {
  await ensureSyncStateRow();
  const [rows] = await pool.query("SELECT * FROM drive_sync_state WHERE id = 1");
  const row = rows[0] || {};
  return {
    pageToken: row.page_token || row.start_page_token || null,
    lastSyncAt: row.last_sync_at || null,
    lastError: row.last_error || null,
  };
}

async function writeSyncState({ pageToken, lastError } = {}) {
  await ensureSyncStateRow();
  const token = pageToken === undefined ? undefined : pageToken;
  if (token !== undefined) {
    await pool.query(
      `UPDATE drive_sync_state
       SET page_token = ?, start_page_token = ?, last_sync_at = CURRENT_TIMESTAMP, last_error = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [token, token, lastError || null]
    );
  } else {
    await pool.query(
      `UPDATE drive_sync_state
       SET last_sync_at = CURRENT_TIMESTAMP, last_error = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [lastError || null]
    );
  }
}

export async function resolveRootFolderId(cfg = driveConfig()) {
  if (cfg.rootFolderId && isDriveId(cfg.rootFolderId)) return cfg.rootFolderId;
  const [rows] = await pool.query(
    `SELECT folder_id, file_id FROM drive_links
     WHERE content_kind = 'root' AND role = 'folder'
     ORDER BY id ASC LIMIT 1`
  );
  const id = rows[0]?.folder_id || rows[0]?.file_id || null;
  return isDriveId(id) ? id : null;
}

export async function getLink(contentKind, contentId, role = "folder") {
  const [rows] = await pool.query(
    `SELECT * FROM drive_links
     WHERE content_kind = ? AND content_id = ? AND role = ?
     LIMIT 1`,
    [contentKind, contentId || "", role]
  );
  return rows[0] || null;
}

export async function listLinksFor(contentKind, contentId) {
  const [rows] = await pool.query(
    `SELECT * FROM drive_links WHERE content_kind = ? AND content_id = ? ORDER BY role ASC, id ASC`,
    [contentKind, contentId || ""]
  );
  return rows;
}

function driveIdFromLink(row) {
  return row?.folder_id || row?.file_id || row?.drive_id || null;
}

export async function upsertLink({
  contentKind,
  contentId,
  role,
  folderId,
  fileId,
  name,
  mime,
  modifiedAt,
  syncStatus,
  syncError,
}) {
  const kind = String(contentKind || "").trim();
  const cid = String(contentId || "");
  const r = LINK_ROLES.includes(role) ? role : "folder";
  const fid = folderId && isDriveId(folderId) ? folderId : null;
  const file = fileId && isDriveId(fileId) ? fileId : null;
  const driveId = fid || file;
  const contentKey = `${kind}:${cid}`;
  const status = syncStatus || "pending";

  const [existing] = await pool.query(
    `SELECT id FROM drive_links WHERE content_kind = ? AND content_id = ? AND role = ? LIMIT 1`,
    [kind, cid, r]
  );

  if (existing.length) {
    await pool.query(
      `UPDATE drive_links SET
         folder_id = ?, file_id = ?, name = ?, mime = ?, modified_at = ?,
         sync_status = ?, sync_error = ?, last_seen_at = CURRENT_TIMESTAMP, last_sync_at = CURRENT_TIMESTAMP,
         content_key = ?, drive_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        fid,
        file,
        name || null,
        mime || null,
        modifiedAt || null,
        status,
        syncError || null,
        contentKey,
        driveId,
        existing[0].id,
      ]
    );
    const [rows] = await pool.query("SELECT * FROM drive_links WHERE id = ?", [existing[0].id]);
    return rows[0];
  }

  const [result] = await pool.query(
    `INSERT INTO drive_links (
       content_kind, content_id, folder_id, file_id, role, name, mime, modified_at,
       sync_status, sync_error, last_seen_at, last_sync_at, content_key, drive_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?)`,
    [kind, cid, fid, file, r, name || null, mime || null, modifiedAt || null, status, syncError || null, contentKey, driveId]
  );
  const [rows] = await pool.query("SELECT * FROM drive_links WHERE id = ?", [result.insertId]);
  return rows[0];
}

export async function getFileMeta(drive, fileId) {
  const res = await drive.files.get({
    fileId,
    fields: FILE_FIELDS,
    supportsAllDrives: true,
  });
  return mapFile(res.data);
}

async function filesList(drive, params) {
  try {
    return await drive.files.list(params);
  } catch (err) {
    if (params.orderBy) {
      const { orderBy: _ignored, ...rest } = params;
      return drive.files.list(rest);
    }
    throw err;
  }
}

export async function listChildren(drive, folderId) {
  const children = [];
  let pageToken;
  do {
    const res = await filesList(drive, {
      q: `'${escapeDriveQuery(folderId)}' in parents and trashed = false`,
      fields: LIST_FIELDS,
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      orderBy: "folder,name",
    });
    for (const f of res.data.files || []) {
      const mapped = mapFile(f);
      if (mapped) children.push(mapped);
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);
  return children;
}

export async function folderPath(drive, folderId, rootId) {
  const pathItems = [];
  let id = folderId;
  const seen = new Set();
  for (let i = 0; i < 20 && id && !seen.has(id); i++) {
    seen.add(id);
    try {
      const res = await drive.files.get({
        fileId: id,
        fields: "id,name,parents",
        supportsAllDrives: true,
      });
      pathItems.unshift({ id: res.data.id, name: res.data.name || "" });
      if (rootId && id === rootId) break;
      id = res.data.parents?.[0] || null;
    } catch {
      break;
    }
  }
  return pathItems;
}

export async function searchInFolder(drive, folderId, query) {
  const q = escapeDriveQuery(query.trim());
  if (!q) return [];
  const res = await filesList(drive, {
    q: `'${escapeDriveQuery(folderId)}' in parents and trashed = false and name contains '${q}'`,
    fields: LIST_FIELDS,
    pageSize: 50,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    orderBy: "folder,name",
  });
  return (res.data.files || []).map(mapFile).filter(Boolean);
}

const MAX_WALK_FOLDERS = 400;

async function listAllUnder(drive, rootId) {
  const files = [];
  const queue = [rootId];
  const seenFolders = new Set([rootId]);
  let truncated = false;

  while (queue.length) {
    if (seenFolders.size > MAX_WALK_FOLDERS) {
      truncated = true;
      break;
    }
    const id = queue.shift();
    let pageToken;
    do {
      const res = await drive.files.list({
        q: `'${escapeDriveQuery(id)}' in parents and trashed = false`,
        fields: LIST_FIELDS,
        pageSize: 100,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      for (const f of res.data.files || []) {
        const mapped = mapFile(f);
        if (!mapped) continue;
        files.push({ ...mapped, parentId: id });
        if (mapped.isFolder && !seenFolders.has(mapped.id)) {
          seenFolders.add(mapped.id);
          queue.push(mapped.id);
        }
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
  }

  return { files, truncated };
}

async function markLinkStatus(id, status, error, extra = {}) {
  const sets = ["sync_status = ?", "sync_error = ?", "last_sync_at = CURRENT_TIMESTAMP"];
  const params = [status, error || null];
  if (extra.name !== undefined) {
    sets.push("name = ?");
    params.push(extra.name);
  }
  if (extra.mime !== undefined) {
    sets.push("mime = ?");
    params.push(extra.mime);
  }
  if (extra.modifiedAt !== undefined) {
    sets.push("modified_at = ?");
    params.push(extra.modifiedAt);
  }
  if (status === "ok") {
    sets.push("last_seen_at = CURRENT_TIMESTAMP");
  }
  params.push(id);
  await pool.query(`UPDATE drive_links SET ${sets.join(", ")} WHERE id = ?`, params);
}

async function applyFileToLinks(file, status, error) {
  if (!file?.id) return 0;
  const [rows] = await pool.query(
    `SELECT id FROM drive_links WHERE folder_id = ? OR file_id = ? OR drive_id = ?`,
    [file.id, file.id, file.id]
  );
  for (const row of rows) {
    await markLinkStatus(row.id, status, error, {
      name: file.name,
      mime: file.mime,
      modifiedAt: file.modifiedTime,
    });
  }
  return rows.length;
}

async function fullSync(drive, rootId) {
  const { files, truncated } = await listAllUnder(drive, rootId);
  const byId = new Map(files.map((f) => [f.id, f]));
  byId.set(rootId, byId.get(rootId) || { id: rootId });

  try {
    const rootMeta = await getFileMeta(drive, rootId);
    if (rootMeta) byId.set(rootId, rootMeta);
  } catch (err) {
    const code = classifyDriveError(err);
    throw Object.assign(new Error(driveErrorMessage(code)), { driveCode: code, cause: err });
  }

  const [links] = await pool.query("SELECT id, folder_id, file_id, drive_id FROM drive_links");
  let updated = 0;
  let missing = 0;
  let forbidden = 0;
  for (const link of links) {
    const target = link.folder_id || link.file_id || link.drive_id;
    if (!target) continue;
    let file = byId.get(target);
    if (!file || file.name === undefined) {
      try {
        file = await getFileMeta(drive, target);
        if (file) byId.set(target, file);
      } catch (err) {
        const code = classifyDriveError(err);
        if (code === "forbidden") {
          await markLinkStatus(link.id, "forbidden", driveErrorMessage("forbidden"));
          forbidden += 1;
          continue;
        }
        await markLinkStatus(link.id, "missing", "Drive에서 이 파일/폴더를 찾지 못했습니다. 행은 유지합니다.");
        missing += 1;
        continue;
      }
    }
    if (file?.name !== undefined) {
      await markLinkStatus(link.id, "ok", null, {
        name: file.name,
        mime: file.mime,
        modifiedAt: file.modifiedTime,
      });
      updated += 1;
    } else {
      await markLinkStatus(link.id, "missing", "Drive에서 이 파일/폴더를 찾지 못했습니다. 행은 유지합니다.");
      missing += 1;
    }
  }

  let pageToken = null;
  try {
    const tokenRes = await drive.changes.getStartPageToken({ supportsAllDrives: true });
    pageToken = tokenRes.data.startPageToken || null;
  } catch (err) {
    console.warn("[drive] getStartPageToken 실패:", classifyDriveError(err));
  }
  await writeSyncState({ pageToken, lastError: truncated ? "금고 폴더가 너무 깊어 일부만 동기화했습니다." : null });
  return { mode: "full", scanned: files.length, updated, missing, forbidden, truncated, pageToken: Boolean(pageToken) };
}

async function incrementalSync(drive, pageToken) {
  let token = pageToken;
  let changesSeen = 0;
  let updated = 0;
  const seenIds = new Set();

  while (token) {
    const res = await drive.changes.list({
      pageToken: token,
      fields:
        "newStartPageToken,nextPageToken,changes(fileId,removed,file(id,name,mimeType,modifiedTime,trashed,parents,owners,thumbnailLink,webViewLink))",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      pageSize: 100,
    });
    for (const ch of res.data.changes || []) {
      changesSeen += 1;
      const fileId = ch.fileId || ch.file?.id;
      if (!fileId) continue;
      seenIds.add(fileId);
      if (ch.removed || ch.file?.trashed) {
        const n = await applyFileToLinks({ id: fileId }, "missing", "Drive에서 삭제되었거나 휴지통에 있습니다. 행은 유지합니다.");
        updated += n;
        continue;
      }
      const mapped = mapFile(ch.file);
      if (mapped) {
        const n = await applyFileToLinks(mapped, "ok", null);
        updated += n;
      }
    }
    if (res.data.nextPageToken) {
      token = res.data.nextPageToken;
    } else {
      const next = res.data.newStartPageToken || token;
      await writeSyncState({ pageToken: next, lastError: null });
      return { mode: "incremental", changes: changesSeen, updated, pageToken: Boolean(next) };
    }
  }

  await writeSyncState({ pageToken: token, lastError: null });
  return { mode: "incremental", changes: changesSeen, updated, pageToken: Boolean(token) };
}

let syncLock = false;

export async function runSync() {
  const cfg = driveConfig();
  if (!cfg.configured) {
    return { ok: false, configured: false, code: "unconfigured", missingEnv: cfg.missingEnv, error: cfg.message };
  }
  const rootId = await resolveRootFolderId(cfg);
  if (!rootId) {
    return { ok: false, configured: true, code: "missing", missingEnv: cfg.missingEnv, error: driveErrorMessage("missing") };
  }
  if (syncLock) {
    return { ok: false, configured: true, code: "busy", error: "이미 동기화가 진행 중입니다." };
  }

  const drive = getDriveClient(cfg);
  syncLock = true;
  try {
    const state = await readSyncState();
    if (state.pageToken) {
      try {
        const result = await incrementalSync(drive, state.pageToken);
        return { ok: true, configured: true, ...result };
      } catch (err) {
        const code = classifyDriveError(err);
        if (code === "stale_token") {
          const result = await fullSync(drive, rootId);
          return { ok: true, configured: true, fellBackToFull: true, ...result };
        }
        if (code === "forbidden") {
          const [links] = await pool.query("SELECT id FROM drive_links");
          for (const row of links) {
            await markLinkStatus(row.id, "forbidden", driveErrorMessage("forbidden"));
          }
          await writeSyncState({ lastError: driveErrorMessage("forbidden") });
          return { ok: false, configured: true, code: "forbidden", error: driveErrorMessage("forbidden") };
        }
        throw err;
      }
    }
    const result = await fullSync(drive, rootId);
    return { ok: true, configured: true, ...result };
  } catch (err) {
    const code = classifyDriveError(err);
    const message = err.driveCode ? err.message : driveErrorMessage(code);
    await writeSyncState({ lastError: message });
    return { ok: false, configured: true, code: code === "error" ? "error" : code, error: message };
  } finally {
    syncLock = false;
  }
}

export function publicLink(row) {
  if (!row) return null;
  return {
    id: row.id,
    contentKind: row.content_kind,
    contentId: row.content_id,
    folderId: row.folder_id || null,
    fileId: row.file_id || null,
    role: row.role,
    name: row.name || null,
    mime: row.mime || null,
    modifiedAt: row.modified_at || null,
    syncStatus: row.sync_status,
    syncError: row.sync_error || null,
    lastSeenAt: row.last_seen_at || null,
    lastSyncAt: row.last_sync_at || null,
  };
}

export { FOLDER_MIME, driveIdFromLink };
