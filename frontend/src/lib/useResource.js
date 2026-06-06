import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "../context/AuthContext";

// 공용 CRUD 훅: /api/<resource>
export function useResource(resource) {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  return { items, loading, error, create, update, remove, reload: load };
}
