import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { TECH_STACK_FALLBACK } from "./sections";

export function useTechStack() {
  const [groups, setGroups] = useState(TECH_STACK_FALLBACK);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api("/tech-stack");
      if (Array.isArray(data.groups) && data.groups.length) {
        setGroups(data.groups);
      }
    } catch {
      setGroups(TECH_STACK_FALLBACK);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { groups, loading, reload: load };
}
