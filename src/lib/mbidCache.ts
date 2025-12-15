/**
 * MBID cache to avoid repeated MusicBrainz API lookups
 * 
 * Caches are stored in localStorage with a TTL
 */

interface CachedMBIDResult {
  recording_mbid?: string;
  artist_mbids?: string[];
  release_mbid?: string;
  release_group_mbid?: string;
  cached_at: number;
  source: 'isrc' | 'text-search' | 'none';
}

interface MBIDCache {
  [key: string]: CachedMBIDResult;
}

const CACHE_KEY = 'de.airsi.listenbrainz-plus/mbid-cache/v1';
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
const MAX_CACHE_ENTRIES = 1000; // Prevent cache from growing indefinitely

const log = (...args: any[]) => {
  import('../stores/main')
    .then(({ useMainStore }) => {
      try {
        if (useMainStore().debugLoggingEnabled) console.log(...args);
      } catch {}
    })
    .catch(() => {});
};

const error = (...args: any[]) => {
  import('../stores/main')
    .then(({ useMainStore }) => {
      try {
        if (useMainStore().debugLoggingEnabled) console.error(...args);
      } catch {}
    })
    .catch(() => {});
};

let memoryCache: MBIDCache = {};
let cacheLoaded = false;

/**
 * Load cache from localStorage
 */
function loadCache(): MBIDCache {
  if (cacheLoaded) {
    return memoryCache;
  }
  
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Clean up expired entries
      const now = Date.now();
      const cleaned: MBIDCache = {};
      let count = 0;
      
      for (const [key, value] of Object.entries(parsed)) {
        const cached = value as CachedMBIDResult;
        if (now - cached.cached_at < CACHE_TTL && count < MAX_CACHE_ENTRIES) {
          cleaned[key] = cached;
          count++;
        }
      }
      
      memoryCache = cleaned;
      cacheLoaded = true;
      log(`[MBIDCache] Loaded ${Object.keys(cleaned).length} entries`);
      return cleaned;
    }
  } catch (err) {
    error('[MBIDCache] Failed to load cache:', err);
  }
  
  memoryCache = {};
  cacheLoaded = true;
  return memoryCache;
}

/**
 * Save cache to localStorage
 */
function saveCache(cache: MBIDCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    error('[MBIDCache] Failed to save cache:', err);
  }
}

/**
 * Generate cache key from track identifiers
 */
function getCacheKey(
  artistName: string,
  trackName: string,
  albumName?: string,
  isrc?: string
): string {
  // Prefer ISRC as it's most reliable
  if (isrc) {
    return `isrc:${isrc}`;
  }
  
  // Normalize text for consistent caching
  const artist = artistName.toLowerCase().trim();
  const track = trackName.toLowerCase().trim();
  const album = albumName?.toLowerCase().trim() || '';
  
  return `text:${artist}|${track}|${album}`;
}

/**
 * Get MBIDs from cache
 */
export function getCachedMBIDs(
  artistName: string,
  trackName: string,
  albumName?: string,
  isrc?: string
): CachedMBIDResult | null {
  const cache = loadCache();
  const key = getCacheKey(artistName, trackName, albumName, isrc);
  const cached = cache[key];
  
  if (!cached) {
    return null;
  }
  
  // Check TTL
  const now = Date.now();
  if (now - cached.cached_at > CACHE_TTL) {
    // Expired, remove it
    delete cache[key];
    saveCache(cache);
    return null;
  }
  
  log(`[MBIDCache] Cache hit for: ${trackName} by ${artistName}`);
  return cached;
}

/**
 * Store MBIDs in cache
 */
export function cacheMBIDs(
  artistName: string,
  trackName: string,
  result: {
    recording_mbid?: string;
    artist_mbids?: string[];
    release_mbid?: string;
    release_group_mbid?: string;
  } | null,
  source: 'isrc' | 'text-search' | 'none',
  albumName?: string,
  isrc?: string
): void {
  const cache = loadCache();
  const key = getCacheKey(artistName, trackName, albumName, isrc);
  
  const cached: CachedMBIDResult = {
    ...result,
    cached_at: Date.now(),
    source,
  };
  
  cache[key] = cached;
  
  // Enforce max cache size by removing oldest entries
  const entries = Object.entries(cache);
  if (entries.length > MAX_CACHE_ENTRIES) {
    entries.sort((a, b) => a[1].cached_at - b[1].cached_at);
    const toRemove = entries.length - MAX_CACHE_ENTRIES;
    for (let i = 0; i < toRemove; i++) {
      delete cache[entries[i][0]];
    }
  }
  
  saveCache(cache);
  log(`[MBIDCache] Cached MBIDs for: ${trackName} by ${artistName}`);
}

/**
 * Clear all cached MBIDs
 */
export function clearMBIDCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    memoryCache = {};
    cacheLoaded = false;
    log('[MBIDCache] Cache cleared');
  } catch (err) {
    error('[MBIDCache] Failed to clear cache:', err);
  }
}

/**
 * Get cache statistics
 */
export function getMBIDCacheStats(): {
  entryCount: number;
  oldestEntry: number | null;
  newestEntry: number | null;
} {
  const cache = loadCache();
  const entries = Object.values(cache);
  
  if (entries.length === 0) {
    return { entryCount: 0, oldestEntry: null, newestEntry: null };
  }
  
  const timestamps = entries.map(e => e.cached_at);
  
  return {
    entryCount: entries.length,
    oldestEntry: Math.min(...timestamps),
    newestEntry: Math.max(...timestamps),
  };
}
