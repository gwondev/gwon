import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useAuth } from "../context/AuthContext";
import {
  getCachedItems,
  loadResourceItems,
  prependCachedItem,
  removeCachedItem,
  replaceCachedItems,
  patchCachedItem,
  subscribeResourceCache,
} from "./resourceCache";

export function useResource(resource) {
  const { token } = useAuth();
  const [items, setItems] = useState(() => getCachedItems(resource) || []);
  const [loading, setLoading] = useState(() => !getCachedItems(resource));
  const [error, setError] = useState(null);
  const reorderTimer = useRef(null);
  const reorderPrev = useRef(null);

  const load = useCallback(
    (force = false) => {
      if (!getCachedItems(resource) || force) {
        if (!getCachedItems(resource)) setLoading(true);
      }
      return loadResourceItems(resource, { force })
        .then((data) => {
          setItems(data);
          setError(null);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    },
    [resource]
  );

  useEffect(() => {
    load();
    return subscribeResourceCache((res, data) => {
      if (res === resource) setItems(data);
    });
  }, [load, resource]);

  useEffect(
    () => () => {
      if (reorderTimer.current) clearTimeout(reorderTimer.current);
    },
    []
  );

  const create = useCallback(
    async (body) => {
      const data = await api(`/${resource}`, { method: "POST", body, token });
      prependCachedItem(resource, data.item);
      return data.item;
    },
    [resource, token]
  );

  const remove = useCallback(
    async (id) => {
      await api(`/${resource}/${id}`, { method: "DELETE", token });
      removeCachedItem(resource, id);
    },
    [resource, token]
  );

  const update = useCallback(
    async (id, body) => {
      const data = await api(`/${resource}/${id}`, { method: "PUT", body, token });
      patchCachedItem(resource, data.item);
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
      replaceCachedItems(resource, nextItems);
      if (reorderTimer.current) clearTimeout(reorderTimer.current);
      reorderTimer.current = setTimeout(async () => {
        try {
          const data = await api(`/${resource}/reorder`, {
            method: "PUT",
            body: { ids: nextItems.map((it) => it.id) },
            token,
          });
          replaceCachedItems(resource, data.items || nextItems);
        } catch (e) {
          if (reorderPrev.current) replaceCachedItems(resource, reorderPrev.current);
          alert(`순서 변경 실패: ${e.message}`);
        }
      }, 350);
    },
    [resource, token]
  );

  return { items, loading, error, create, update, remove, reorder, reload: load };
}
