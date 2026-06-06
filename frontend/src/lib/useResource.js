import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useAuth } from "../context/AuthContext";

// 공용 CRUD 훅: /api/<resource>
export function useResource(resource) {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reorderTimer = useRef(null);
  const reorderPrev = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    api(`/${resource}`)
      .then((data) => setItems(data.items || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [resource]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(
    () => () => {
      if (reorderTimer.current) clearTimeout(reorderTimer.current);
    },
    []
  );

  const create = useCallback(
    async (body) => {
      const data = await api(`/${resource}`, { method: "POST", body, token });
      setItems((prev) => [data.item, ...prev]);
      return data.item;
    },
    [resource, token]
  );

  const remove = useCallback(
    async (id) => {
      await api(`/${resource}/${id}`, { method: "DELETE", token });
      setItems((prev) => prev.filter((it) => it.id !== id));
    },
    [resource, token]
  );

  const update = useCallback(
    async (id, body) => {
      const data = await api(`/${resource}/${id}`, { method: "PUT", body, token });
      setItems((prev) => prev.map((it) => (it.id === id ? data.item : it)));
      return data.item;
    },
    [resource, token]
  );

  const reorder = useCallback(
    (nextItems) => {
      setItems((prev) => {
        reorderPrev.current = prev;
        return nextItems;
      });
      if (reorderTimer.current) clearTimeout(reorderTimer.current);
      reorderTimer.current = setTimeout(async () => {
        try {
          const data = await api(`/${resource}/reorder`, {
            method: "PUT",
            body: { ids: nextItems.map((it) => it.id) },
            token,
          });
          setItems(data.items || nextItems);
        } catch (e) {
          if (reorderPrev.current) setItems(reorderPrev.current);
          alert(`순서 변경 실패: ${e.message}`);
        }
      }, 350);
    },
    [resource, token]
  );

  return { items, loading, error, create, update, remove, reorder, reload: load };
}
