import { useEffect, useState } from "react";
import { getCachedItems, loadPortfolioBundle, subscribeResourceCache } from "./resourceCache";

function buildPreview(bundle) {
  return {
    projects: bundle.projects ?? [],
    activities: bundle.activities ?? [],
    certifications: bundle.certifications ?? [],
    career: bundle.careers ?? [],
  };
}

function previewFromCache() {
  const projects = getCachedItems("projects");
  if (projects === null) return null;
  return buildPreview({
    projects,
    activities: getCachedItems("activities"),
    certifications: getCachedItems("certifications"),
    careers: getCachedItems("careers"),
  });
}

export function usePortfolioPreview() {
  const [preview, setPreview] = useState(() => previewFromCache() || buildPreview({}));
  const [loading, setLoading] = useState(() => getCachedItems("projects") === null);

  useEffect(() => {
    let alive = true;

    const syncFromCache = () => {
      const cached = previewFromCache();
      if (!cached || !alive) return;
      setPreview(cached);
      setLoading(false);
    };

    loadPortfolioBundle()
      .then((bundle) => {
        if (!alive) return;
        setPreview(buildPreview(bundle));
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));

    const unsub = subscribeResourceCache(syncFromCache);
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  return { preview, loading };
}
