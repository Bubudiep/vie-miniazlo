type CacheEntry<T> = { savedAt: number; value: T };

export function readSessionCache<T>(key: string, maxAgeMs: number): T | null {
  try {
    const entry = JSON.parse(sessionStorage.getItem(key) || "null") as CacheEntry<T> | null;
    return entry && Date.now() - entry.savedAt <= maxAgeMs ? entry.value : null;
  } catch {
    return null;
  }
}

export function writeSessionCache<T>(key: string, value: T) {
  try { sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value })); }
  catch { /* Cache is optional when storage is unavailable. */ }
}
