import { useEffect, useState } from "react";
import {
  getCachedPortfolioPreview,
  loadPortfolioBundle,
} from "./resourceCache";

function buildPreview(bundle) {
  return {
    projects: bundle.projects ?? [],
    activities: bundle.activities ?? [],
    certifications: bundle.certifications ?? [],
    career: bundle.careers ?? [],
  };
}

export function usePortfolioPreview() {
  const [preview, setPreview] = useState(() =>
    buildPreview(getCachedPortfolioPreview() || {})
  );
  const [loading, setLoading] = useState(() => !getCachedPortfolioPreview());

  useEffect(() => {
    let alive = true;

    loadPortfolioBundle()
      .then((bundle) => {
        if (!alive) return;
        setPreview(buildPreview(bundle));
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, []);

  return { preview, loading };
}
