import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

// You can name the return value of `defineStore()` anything you want,
// but it's best to use the name of the store and surround it with `use`
// and `Store` (e.g. `useUserStore`, `useCartStore`, `useProductStore`)
// the first argument is a unique id of the store across your application
export const useMainStore = defineStore('main-store', () => {
  const STORAGE_KEY = 'de.airsi.listenbrainz-plus/settings/v1';

  const listenbrainzToken = ref<string>('');
  const scrobblingEnabled = ref<boolean>(false);
  const scrobblePercent = ref<number>(50); // percent of track duration
  const scrobbleMinSeconds = ref<number>(60); // absolute fallback seconds
  const mbidPreloadEnabled = ref<boolean>(true);
  const mbidEnrichmentEnabled = ref<boolean>(true);
  const debugLoggingEnabled = ref<boolean>(false);

  function loadPersisted() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.token) listenbrainzToken.value = String(parsed.token);
      if (typeof parsed.enabled === 'boolean') scrobblingEnabled.value = parsed.enabled;
      if (typeof parsed.scrobblePercent === 'number') scrobblePercent.value = parsed.scrobblePercent;
      if (typeof parsed.scrobbleMinSeconds === 'number') scrobbleMinSeconds.value = parsed.scrobbleMinSeconds;
      if (typeof parsed.mbidPreloadEnabled === 'boolean') mbidPreloadEnabled.value = parsed.mbidPreloadEnabled;
      if (typeof parsed.mbidEnrichmentEnabled === 'boolean') mbidEnrichmentEnabled.value = parsed.mbidEnrichmentEnabled;
      if (typeof parsed.debugLoggingEnabled === 'boolean') debugLoggingEnabled.value = parsed.debugLoggingEnabled;
    } catch (err) {
      console.warn('[ListenBrainz] Failed to load settings', err);
    }
  }

  function persist() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          token: listenbrainzToken.value,
          enabled: scrobblingEnabled.value,
          scrobblePercent: scrobblePercent.value,
          scrobbleMinSeconds: scrobbleMinSeconds.value,
          mbidPreloadEnabled: mbidPreloadEnabled.value,
          mbidEnrichmentEnabled: mbidEnrichmentEnabled.value,
          debugLoggingEnabled: debugLoggingEnabled.value,
        })
      );
    } catch (err) {
      console.warn('[ListenBrainz] Failed to persist settings', err);
    }
  }

  loadPersisted();

  function setListenbrainzToken(token: string) {
    listenbrainzToken.value = token.trim();
    persist();
  }

  function setScrobblingEnabled(enabled: boolean) {
    scrobblingEnabled.value = !!enabled;
    persist();
  }

  function setScrobblePercent(percent: number) {
    const clamped = Math.max(1, Math.min(100, Math.round(percent)));
    scrobblePercent.value = clamped;
    persist();
  }

  function setScrobbleMinSeconds(seconds: number) {
    const clamped = Math.max(10, Math.round(seconds));
    scrobbleMinSeconds.value = clamped;
    persist();
  }

  function setMbidPreloadEnabled(enabled: boolean) {
    mbidPreloadEnabled.value = !!enabled;
    persist();
  }

  function setMbidEnrichmentEnabled(enabled: boolean) {
    mbidEnrichmentEnabled.value = !!enabled;
    // If enrichment is disabled, also disable preload to avoid confusion
    if (!mbidEnrichmentEnabled.value) mbidPreloadEnabled.value = false;
    persist();
  }

  function setDebugLoggingEnabled(enabled: boolean) {
    debugLoggingEnabled.value = !!enabled;
    persist();
  }

  watch(
    () => [listenbrainzToken.value, scrobblingEnabled.value, scrobblePercent.value, scrobbleMinSeconds.value, mbidPreloadEnabled.value, mbidEnrichmentEnabled.value, debugLoggingEnabled.value],
    persist,
    { deep: false }
  );

  return {
    listenbrainzToken,
    scrobblingEnabled,
    scrobblePercent,
    scrobbleMinSeconds,
    mbidPreloadEnabled,
    mbidEnrichmentEnabled,
    debugLoggingEnabled,
    setListenbrainzToken,
    setScrobblingEnabled,
    setScrobblePercent,
    setScrobbleMinSeconds,
    setMbidPreloadEnabled,
    setMbidEnrichmentEnabled,
    setDebugLoggingEnabled,
  }
})