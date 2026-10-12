import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { useAuth } from "../context/AuthContext";
import {
  HOME_LAYOUT_DEFAULT,
  mergeHomeLayout,
  readStoredLayout,
  writeStoredLayout,
} from "./homeLayout.js";

const MOBILE_MAX = 859;

export function useHomeLayout() {
  const { token } = useAuth();
  const [layout, setLayout] = useState(() => readStoredLayout());
  const [saved, setSaved] = useState(() => readStoredLayout());
  const [mobile, setMobile] = useState(() => (typeof window === "undefined" ? false : window.innerWidth <= MOBILE_MAX));
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= MOBILE_MAX);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    api("/portfolio/home-layout")
      .then((data) => {
        const next = mergeHomeLayout(data?.layout);
        setLayout(next);
        setSaved(next);
        writeStoredLayout(next);
      })
      .catch(() => {});
  }, []);

  const key = mobile ? "mobile" : "desktop";
  const breakpoint = layout[key];
  const dirty = useMemo(() => JSON.stringify(layout) !== JSON.stringify(saved), [layout, saved]);

  const patch = useCallback((bp, field, value) => {
    setLayout((prev) => {
      const next = {
        ...prev,
        [bp]: { ...prev[bp], [field]: value },
      };
      writeStoredLayout(next);
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    writeStoredLayout(layout);
    if (!token) {
      setSaved(layout);
      setSaving(false);
      return;
    }
    try {
      const data = await api("/admin/home-layout", {
        method: "PUT",
        body: { layout },
        token,
      });
      const next = mergeHomeLayout(data?.layout || layout);
      setLayout(next);
      setSaved(next);
      writeStoredLayout(next);
    } catch {
      setSaved(layout);
    } finally {
      setSaving(false);
    }
  }, [layout, token]);

  const reset = useCallback(() => {
    const next = mergeHomeLayout(HOME_LAYOUT_DEFAULT);
    setLayout(next);
    writeStoredLayout(next);
  }, []);

  return { layout, breakpoint, key, mobile, dirty, saving, patch, save, reset };
}
