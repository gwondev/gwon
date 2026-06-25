import { useCallback, useEffect, useState } from "react";
import { TECH_STACK_FALLBACK } from "./sections";
import { getCachedTechStack, loadTechStack } from "./resourceCache";

export function useTechStack() {
  const [groups, setGroups] = useState(() => getCachedTechStack() || TECH_STACK_FALLBACK);
  const [loading, setLoading] = useState(() => !getCachedTechStack());

  const load = useCallback(async (force = false) => {
    if (!getCachedTechStack()) setLoading(true);
    try {
      const data = await loadTechStack({ force });
      if (Array.isArray(data) && data.length) setGroups(data);
    } catch {
      setGroups(TECH_STACK_FALLBACK);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { groups, loading, reload: () => load(true) };
}
