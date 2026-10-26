import { Router } from "express";
import { requireSuperAdmin } from "../auth-middleware.js";
import {
  CONTENT_KINDS,
  LINK_ROLES,
  classifyDriveError,
  driveConfig,
  driveErrorMessage,
  folderPath,
  getDriveClient,
  getFileMeta,
  isDriveId,
  listChildren,
  listLinksFor,
  publicLink,
  readSyncState,
  resolveRootFolderId,
  runSync,
  searchInFolder,
  upsertLink,
} from "../lib/drive.js";

const router = Router();
router.use(requireSuperAdmin);

function unconfiguredBody(cfg) {
  return {
    configured: false,
    missingEnv: cfg.missingEnv,
    error: cfg.message,
    code: "unconfigured",
    message: cfg.message,
  };
}

function httpFor(code) {
  if (code === "unconfigured" || code === "missing") return 400;
  if (code === "not_found") return 404;
  if (code === "forbidden" || code === "unauthorized") return 403;
  if (code === "busy") return 409;
  return 500;
}

router.get("/status", async (_req, res, next) => {
  try {
    const cfg = driveConfig();
    const state = cfg.configured ? await readSyncState() : { pageToken: null, lastSyncAt: null, lastError: null };
    res.json({
      configured: cfg.configured,
      authMode: cfg.authMode,
      missingEnv: cfg.missingEnv,
      message: cfg.message,
      rootFolderId: cfg.rootFolderId,
      hasRootFolder: Boolean(cfg.rootFolderId),
      serviceAccountEmail: cfg.serviceAccountEmail,
      lastSyncAt: state.lastSyncAt,
      lastError: state.lastError,
      hasPageToken: Boolean(state.pageToken),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/folder", async (req, res, next) => {
  try {
    const cfg = driveConfig();
    if (!cfg.configured) {
      return res.status(400).json(unconfiguredBody(cfg));
    }

    const drive = getDriveClient(cfg);
    const contentKind = String(req.query.content_kind || "").trim();
    const contentId = String(req.query.content_id || "");
    const requestedId = String(req.query.id || "").trim();

    let folderId = null;
    let link = null;
    let links = [];

    if (requestedId) {
      if (!isDriveId(requestedId)) {
        return res.status(400).json({
          configured: true,
          code: "not_found",
          error: "폴더 ID 형식이 올바르지 않습니다. Drive 목록에서 고른 ID만 사용하세요.",
        });
      }
      folderId = requestedId;
    }

    if (contentKind && CONTENT_KINDS.includes(contentKind)) {
      links = await listLinksFor(contentKind, contentId);
      link = links.find((r) => r.role === "folder") || links[0] || null;
      if (!folderId && link) {
        const fromLink = link.folder_id || (link.mime === "application/vnd.google-apps.folder" ? link.file_id : null);
        if (isDriveId(fromLink)) folderId = fromLink;
      }
    }

    if (!folderId) {
      folderId = await resolveRootFolderId(cfg);
    }

    if (!folderId) {
      return res.status(400).json({
        configured: true,
        code: "missing",
        missingEnv: cfg.missingEnv,
        error: driveErrorMessage("missing"),
      });
    }

    let folder;
    try {
      folder = await getFileMeta(drive, folderId);
    } catch (err) {
      const code = classifyDriveError(err);
      return res.status(httpFor(code)).json({
        configured: true,
        code,
        error: driveErrorMessage(code),
        folderId,
      });
    }

    if (!folder || folder.trashed) {
      return res.status(404).json({
        configured: true,
        code: "not_found",
        error: driveErrorMessage("not_found"),
        folderId,
      });
    }

    let children;
    try {
      children = await listChildren(drive, folderId);
    } catch (err) {
      const code = classifyDriveError(err);
      return res.status(httpFor(code)).json({
        configured: true,
        code,
        error: driveErrorMessage(code),
        folder: { id: folder.id, name: folder.name, mime: folder.mime },
      });
    }

    const rootId = await resolveRootFolderId(cfg);
    const pathItems = await folderPath(drive, folderId, rootId);

    res.json({
      configured: true,
      folder: {
        id: folder.id,
        name: folder.name,
        mime: folder.mime,
        modifiedTime: folder.modifiedTime,
        webViewLink: folder.webViewLink,
        isFolder: folder.isFolder,
        owners: folder.owners,
        parents: folder.parents,
      },
      children,
      path: pathItems,
      rootFolderId: rootId,
      atRoot: Boolean(rootId && folder.id === rootId),
      link: publicLink(link),
      links: links.map(publicLink),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/search", async (req, res, next) => {
  try {
    const cfg = driveConfig();
    if (!cfg.configured) {
      return res.status(400).json(unconfiguredBody(cfg));
    }
    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.json({ configured: true, q: "", items: [] });
    }

    const folderIdRaw = String(req.query.id || "").trim();
    let folderId = isDriveId(folderIdRaw) ? folderIdRaw : await resolveRootFolderId(cfg);
    if (!folderId) {
      return res.status(400).json({
        configured: true,
        code: "missing",
        missingEnv: cfg.missingEnv,
        error: driveErrorMessage("missing"),
      });
    }

    const drive = getDriveClient(cfg);
    try {
      const items = await searchInFolder(drive, folderId, q);
      res.json({ configured: true, q, folderId, items });
    } catch (err) {
      const code = classifyDriveError(err);
      return res.status(httpFor(code)).json({
        configured: true,
        code,
        error: driveErrorMessage(code),
      });
    }
  } catch (err) {
    next(err);
  }
});

router.post("/sync", async (_req, res, next) => {
  try {
    const result = await runSync();
    if (!result.ok) {
      return res.status(httpFor(result.code || "error")).json(result);
    }
    const state = await readSyncState();
    res.json({
      ...result,
      lastSyncAt: state.lastSyncAt,
      lastError: state.lastError,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/link", async (req, res, next) => {
  try {
    const contentKind = String(req.query.content_kind || "").trim();
    const contentId = String(req.query.content_id || "");
    if (!CONTENT_KINDS.includes(contentKind)) {
      return res.status(400).json({ error: "content_kind 가 올바르지 않습니다.", allowed: CONTENT_KINDS });
    }
    const links = await listLinksFor(contentKind, contentId);
    res.json({
      configured: driveConfig().configured,
      contentKind,
      contentId,
      links: links.map(publicLink),
    });
  } catch (err) {
    next(err);
  }
});

router.put("/link", async (req, res, next) => {
  try {
    const cfg = driveConfig();
    if (!cfg.configured) {
      return res.status(400).json(unconfiguredBody(cfg));
    }

    const body = req.body || {};
    const contentKind = String(body.content_kind || body.contentKind || "").trim();
    const contentId = String(body.content_id ?? body.contentId ?? "");
    const role = String(body.role || "folder").trim();
    const folderId = String(body.folder_id || body.folderId || "").trim() || null;
    const fileId = String(body.file_id || body.fileId || "").trim() || null;

    if (!CONTENT_KINDS.includes(contentKind)) {
      return res.status(400).json({ error: "content_kind 가 올바르지 않습니다.", allowed: CONTENT_KINDS });
    }
    if (!LINK_ROLES.includes(role)) {
      return res.status(400).json({ error: "role 이 올바르지 않습니다.", allowed: LINK_ROLES });
    }

    const targetId = folderId || fileId;
    if (!isDriveId(targetId)) {
      return res.status(400).json({
        error: "folder_id 또는 file_id 가 필요합니다. Drive 목록에서 고른 ID만 보내세요. ID를 임의로 만들지 마세요.",
      });
    }
    if (folderId && !isDriveId(folderId)) {
      return res.status(400).json({ error: "folder_id 형식이 올바르지 않습니다." });
    }
    if (fileId && !isDriveId(fileId)) {
      return res.status(400).json({ error: "file_id 형식이 올바르지 않습니다." });
    }

    const drive = getDriveClient(cfg);
    let meta;
    try {
      meta = await getFileMeta(drive, targetId);
    } catch (err) {
      const code = classifyDriveError(err);
      return res.status(httpFor(code)).json({
        configured: true,
        code,
        error: driveErrorMessage(code),
      });
    }

    const isFolder = Boolean(meta?.isFolder);
    const saved = await upsertLink({
      contentKind,
      contentId,
      role,
      folderId: isFolder ? meta.id : folderId && isDriveId(folderId) ? folderId : meta.parents?.[0] || null,
      fileId: isFolder ? null : meta.id,
      name: meta.name,
      mime: meta.mime,
      modifiedAt: meta.modifiedTime,
      syncStatus: "ok",
    });

    res.json({
      configured: true,
      link: publicLink(saved),
      file: meta,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
