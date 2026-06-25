import { useEffect, useState } from "react";
import {
  DEMO_ACTIVITIES,
  DEMO_CAREERS,
  DEMO_CERTIFICATIONS,
  DEMO_PROJECTS,
  withDemoFallback,
} from "./demoData";
import { getCachedItems, loadPortfolioBundle, subscribeResourceCache } from "./resourceCache";

function buildPreview(projects, activities, certifications, careers) {
  return {
    projects: withDemoFallback(projects, DEMO_PROJECTS),
    activities: withDemoFallback(activities, DEMO_ACTIVITIES),
    certifications: withDemoFallback(certifications, DEMO_CERTIFICATIONS),
    career: withDemoFallback(careers, DEMO_CAREERS),
  };
}

function previewFromCache() {
  const projects = getCachedItems("projects");
  if (!projects) return null;
  return buildPreview(
    projects,
    getCachedItems("activities"),
    getCachedItems("certifications"),
    getCachedItems("careers")
  );
}

export function usePortfolioPreview() {
  const [preview, setPreview] = useState(() => previewFromCache() || buildPreview([], [], [], []));
  const [loading, setLoading] = useState(() => !previewFromCache());

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
        setPreview(
          buildPreview(bundle.projects, bundle.activities, bundle.certifications, bundle.careers)
        );
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
