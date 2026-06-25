import { api } from "./api";

const CACHE_TTL_MS = 120_000;
const cache = new Map();
const inflight = new Map();
const listeners = new Set();

function notify(resource, items) {
  for (const fn of listeners) fn(resource, items);
}

export function getCachedItems(resource) {
  return cache.get(resource)?.items ?? null;
}

export function setCachedItems(resource, items) {
  cache.set(resource, { items, at: Date.now() });
  notify(resource, items);
}

export function invalidateResource(resource) {
  cache.delete(resource);
  inflight.delete(resource);
}

export function subscribeResourceCache(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function loadResourceItems(resource, { force = false } = {}) {
  const entry = cache.get(resource);
  const fresh = entry && Date.now() - entry.at < CACHE_TTL_MS;

  if (!force && fresh) {
    if (Date.now() - entry.at > CACHE_TTL_MS / 2) {
      loadResourceItems(resource, { force: true }).catch(() => {});
    }
    return entry.items;
  }

  if (!force && inflight.has(resource)) {
    return inflight.get(resource);
  }

  const promise = api(`/${resource}`)
    .then((data) => {
      const items = data.items || [];
      setCachedItems(resource, items);
      inflight.delete(resource);
      return items;
    })
    .catch((err) => {
      inflight.delete(resource);
      if (entry?.items?.length) return entry.items;
      throw err;
    });

  inflight.set(resource, promise);
  return promise;
}

const TECH_KEY = "__tech_stack__";
let techCache = null;
let techInflight = null;
let techFetchedAt = 0;

export function getCachedTechStack() {
  return techCache;
}

export async function loadTechStack({ force = false } = {}) {
  const fresh = techCache && Date.now() - techFetchedAt < CACHE_TTL_MS;
  if (!force && fresh) {
    if (Date.now() - techFetchedAt > CACHE_TTL_MS / 2) {
      loadTechStack({ force: true }).catch(() => {});
    }
    return techCache;
  }
  if (!force && techInflight) return techInflight;

  techInflight = api("/tech-stack")
    .then((data) => {
      if (Array.isArray(data.groups) && data.groups.length) {
        techCache = data.groups;
        techFetchedAt = Date.now();
      }
      techInflight = null;
      return techCache;
    })
    .catch((err) => {
      techInflight = null;
      if (techCache) return techCache;
      throw err;
    });

  return techInflight;
}

export async function loadPortfolioBundle({ force = false } = {}) {
  const [projects, activities, certifications, careers] = await Promise.all([
    loadResourceItems("projects", { force }),
    loadResourceItems("activities", { force }),
    loadResourceItems("certifications", { force }),
    loadResourceItems("careers", { force }),
  ]);
  return { projects, activities, certifications, careers };
}

export function patchCachedItem(resource, item) {
  const items = getCachedItems(resource);
  if (!items) return;
  setCachedItems(
    resource,
    items.map((it) => (it.id === item.id ? item : it))
  );
}

export function prependCachedItem(resource, item) {
  const items = getCachedItems(resource) || [];
  setCachedItems(resource, [item, ...items]);
}

export function removeCachedItem(resource, id) {
  const items = getCachedItems(resource);
  if (!items) return;
  setCachedItems(
    resource,
    items.filter((it) => it.id !== id)
  );
}

export function replaceCachedItems(resource, items) {
  setCachedItems(resource, items);
}
