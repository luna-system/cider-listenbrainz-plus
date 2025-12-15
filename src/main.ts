import { defineCustomElement } from "vue";
import type { App } from "vue";
import { createPinia } from "pinia";
import {
  definePluginContext,
  addMainMenuEntry,
  addCustomButton,
  useCiderAudio,
  useMusicKit,
} from "@ciderapp/pluginkit";
import MySettings from "./components/MySettings.vue";
import StatusDropdown from "./components/StatusDropdown.vue";
import PluginConfig from "./plugin.config";
import AdvancedPage from "./pages/AdvancedPage.vue";

/**
 * Initializing a Vue app instance so we can use things like Pinia.
 */
const pinia = createPinia();

/**
 * Function that configures the app instances of the custom elements
 */
function configureApp(app: App) {
  app.use(pinia);
}

/**
 * Custom Elements that will be registered in the app
 */
export const CustomElements = {
  "settings": defineCustomElement(MySettings, {
    shadowRoot: false,
    configureApp,
  }),
  "status-dropdown": defineCustomElement(StatusDropdown, {
    shadowRoot: false,
    configureApp,
  }),
  "page-advanced": defineCustomElement(AdvancedPage, {
    shadowRoot: false,
    configureApp,
  }),
};

/**
 * Defining the plugin context
 */
let setupAlreadyRan = false;

// Lightweight logger gated by settings
async function log(...args: any[]) {
  try {
    const { useMainStore } = await import('./stores/main');
    const mainStore = useMainStore();
    if (mainStore.debugLoggingEnabled) console.log(...args);
  } catch {}
}
// Optionally use warn() if needed to gate console.warn
async function error(...args: any[]) {
  try {
    const { useMainStore } = await import('./stores/main');
    const mainStore = useMainStore();
    if (mainStore.debugLoggingEnabled) console.error(...args);
  } catch {}
}

const { plugin, setupConfig, customElementName, goToPage, useCPlugin } =
  definePluginContext({
    ...PluginConfig,
    CustomElements,
    setup() {
      // Prevent setup from running multiple times (Cider bug: plugin store watch triggers on every component mount)
      if (setupAlreadyRan) {
        log("[ListenBrainz+] Setup already ran, skipping duplicate call");
        return;
      }
      setupAlreadyRan = true;
      log("[ListenBrainz+] Plugin setup() called - initializing once");
      
      // Initialize scrobble queue
      import("./lib/scrobbleQueue").then(({ getScrobbleQueue }) => {
        try {
          log('[ListenBrainz+] Initializing scrobble queue...');
          const queue = getScrobbleQueue();
          log('[ListenBrainz+] Queue size:', queue.getQueueSize());
          queue.resume();
          log('[ListenBrainz+] Queue processing resumed');
        } catch (err) {
          error('[ListenBrainz+] Failed to initialize queue:', err);
        }
      }).catch(err => {
        error('[ListenBrainz+] Failed to import scrobble queue:', err);
      });

      /**
       * Registering the custom elements in the app
       */
      for (const [key, value] of Object.entries(CustomElements)) {
        const _key = key as keyof typeof CustomElements;
        const elementName = customElementName(_key);
        // Only define if not already registered
        if (!customElements.get(elementName)) {
          customElements.define(elementName, value);
          log(`[ListenBrainz+] Registered custom element: ${elementName}`);
        } else {
          log(`[ListenBrainz+] Custom element already registered: ${elementName}`);
        }
      }

      /**
       * Defining our custom settings element
       */
      this.SettingsElement = customElementName("settings");

      addMainMenuEntry({
        label: "ListenBrainz Plus Advanced",
        onClick() {
          goToPage({
            name: "page-advanced",
          });
        },
      });

      // Add status dropdown button to chrome
      addCustomButton({
        element: "🎵",
        location: "chrome-top/right",
        title: "ListenBrainz Status",
        menuElement: customElementName("status-dropdown"),
      });

      const audio = (window as any).CiderAudio || useCiderAudio();
      audio.subscribe("ready", () => {
        log("CiderAudio is ready!", audio.context);
        import("./stores/debug").then((m) => {
          const debugStore = (m as any).useDebugStore();
          debugStore.addLog("CiderAudio ready", 'info');
          debugStore.setScrobbleState('idle', 0);
        }).catch(() => {
          // Pinia not ready yet, ignore
        });
      });

      let music;
      try {
        log('[ListenBrainz+] Getting MusicKit API...');
        music = useMusicKit();
        log('[ListenBrainz+] MusicKit API result:', !!music);
      } catch (err) {
        error('[ListenBrainz+] Exception getting MusicKit:', err);
      }
      
      if (!music) {
        error('[ListenBrainz+] MusicKit instance not available');
        import("./stores/debug").then((m) => {
          const debugStore = (m as any).useDebugStore();
          debugStore.addLog("MusicKit instance not available", 'error');
        }).catch(() => {
          // Pinia not ready yet, ignore
        });
        return;
      }
      
      log('[ListenBrainz+] Setting up MusicKit listeners...');

      const mkAny = music as any;
      const player = mkAny?.player;
      const queue = mkAny?._queue;
      const controller = mkAny?._playbackController || (mkAny?.playbackControllers ? mkAny.playbackControllers[0] : undefined);
      const musicKitEvents = (window as any).MusicKit?.Events ?? {};
      const mediaItemEvent = musicKitEvents.mediaItemDidChange ?? "mediaItemDidChange";
      const playbackEvent = musicKitEvents.playbackStateDidChange ?? "playbackStateDidChange";

      // Scrobbling state
      let currentTrackId: string | null = null;
      let currentTrackData: any = null;
      let currentTrackMBIDs: any | null = null; // preloaded MBIDs for the current track
      let trackStartTime = 0;
      let isCurrentlyPlaying = false;
      let hasSubmittedCurrentTrack = false;
      let lastSkipReason: string | null = null;
      let hasSeekOccurred = false;
      let lastCheckedElapsed = 0;

      const playerAny = player as any;
      const controllerAny = controller as any;
      const mkListenerHost = playerAny?.addEventListener
        ? playerAny
        : mkAny?.addEventListener
        ? mkAny
        : controllerAny?.addEventListener
        ? controllerAny
        : queue as any;

      if (mkListenerHost?.addEventListener) {
        mkListenerHost.addEventListener(mediaItemEvent, (event: any) => {
          const item = event?.item ?? event?.nextItem ?? event;
          const attributes = item?.attributes ?? item;
          const newId = item?.id || attributes?.playParams?.id;

          log('[ListenBrainz] mediaItemDidChange:', attributes?.name, 'by', attributes?.artistName);

          if (newId && newId !== currentTrackId) {
            currentTrackId = newId;
            currentTrackData = attributes;
            currentTrackMBIDs = null; // reset MBIDs for new track
            trackStartTime = Math.floor(Date.now() / 1000);
            hasSubmittedCurrentTrack = false;
            isCurrentlyPlaying = true;
            hasSeekOccurred = false;
            lastCheckedElapsed = 0;

            // ISRC extraction happens during scrobbling
            if (attributes?.isrc) {
              log('[ListenBrainz+] ISRC found:', attributes.isrc);
            }

            import("./stores/debug").then((m) => {
              const debugStore = (m as any).useDebugStore();
              debugStore.addLog(`Track changed: ${attributes?.artistName} - ${attributes?.name}`, 'info');
              debugStore.setNowPlaying({
                artist: attributes?.artistName,
                track: attributes?.name,
                album: attributes?.albumName,
              });
              debugStore.setPlaybackState(true);
              debugStore.setLastNowPlayingPayload(event);
              debugStore.setScrobbleState('waiting', 0, false);
            }).catch(() => {
              // Pinia not ready yet, ignore
            });

            // Kick off MBID enrichment immediately when track starts (if enabled)
            // Defer slightly and wait for Pinia so debug store logging works reliably
            (async () => {
              try {
                // Ensure Pinia is ready before accessing any stores
                // Wait briefly for Pinia to initialize; stores can be unavailable immediately at startup
                await new Promise(res => setTimeout(res, 600));

                // Small delay to allow MusicKit to populate attributes like ISRC
                await new Promise(res => setTimeout(res, 400));
                const artist = attributes?.artistName ?? "";
                const track = attributes?.name ?? "";
                const release = attributes?.albumName ?? undefined;
                const isrc = attributes?.isrc;
                const { getCachedMBIDs, cacheMBIDs } = await import("./lib/mbidCache");
                const { lookupMBIDs } = await import("./lib/musicbrainz");
                const { useMainStore } = await import('./stores/main');
                const mainStore = useMainStore();
                if (!mainStore.mbidEnrichmentEnabled) {
                  console.log('[ListenBrainz+] MBID enrichment disabled by settings');
                  return;
                }
                if (!mainStore.mbidPreloadEnabled) {
                  console.log('[ListenBrainz+] MBID preload disabled by settings');
                  return;
                }

                const cached = getCachedMBIDs(artist, track, release, isrc);
                let debugStore: any;
                try {
                  const { useDebugStore } = await import("./stores/debug");
                  debugStore = useDebugStore();
                  debugStore.addLog(`Starting MBID preload: ${artist} - ${track}`,'info');
                  debugStore.setCurrentMBIDs(null);
                } catch {}

                if (cached) {
                  currentTrackMBIDs = cached;
                  if (debugStore) {
                    debugStore.setCurrentMBIDs({
                      recording_mbid: cached.recording_mbid,
                      artist_mbids: cached.artist_mbids,
                      release_mbid: cached.release_mbid,
                      release_group_mbid: cached.release_group_mbid,
                      source: cached.source,
                    });
                    debugStore.addLog(`💾 MBIDs preloaded from cache (${cached.source})`, 'info');
                  }
                  console.log('[ListenBrainz+] Preloaded MBIDs from cache:', cached);
                } else {
                  console.log('[ListenBrainz+] Preloading MBIDs via lookup...', { artist, track, release, isrc });
                  const result = await lookupMBIDs(artist, track, release, isrc);
                  if (result) {
                    currentTrackMBIDs = result;
                    cacheMBIDs(artist, track, result, isrc ? 'isrc' : 'text-search', release, isrc);
                    if (debugStore) {
                      debugStore.setCurrentMBIDs({
                        recording_mbid: result.recording_mbid,
                        artist_mbids: result.artist_mbids,
                        release_mbid: result.release_mbid,
                        release_group_mbid: result.release_group_mbid,
                        source: isrc ? 'isrc' : 'text-search',
                      });
                      debugStore.addLog(`✓ MBIDs preloaded (${isrc ? 'ISRC' : 'text search'})`, 'success');
                    }
                  } else {
                    cacheMBIDs(artist, track, null, 'none', release, isrc);
                    if (debugStore) {
                      debugStore.setCurrentMBIDs({ source: 'none' });
                      debugStore.addLog('✗ No MBIDs found during preload', 'info');
                    }
                  }
                }
              } catch (err) {
                console.error('[ListenBrainz+] MBID preload failed:', err);
                try {
                  const { useDebugStore } = await import("./stores/debug");
                  const debugStore = useDebugStore();
                  debugStore.addLog(`✗ MBID preload error: ${err instanceof Error ? err.message : String(err)}`, 'error');
                } catch {}
              }
            })();
            // Re-attempt preload after 1500ms if MBIDs not yet available (ISRC may appear late)
            setTimeout(() => {
              if (!currentTrackMBIDs) {
                (async () => {
                  try {
                    const { useMainStore } = await import('./stores/main');
                    const mainStore = useMainStore();
                    if (!mainStore.mbidEnrichmentEnabled || !mainStore.mbidPreloadEnabled) return;
                    const candidate = (playerAny && (playerAny as any).nowPlayingItem) || (mkAny && (mkAny as any).nowPlayingItem);
                    const latestAttrs = candidate?.attributes ?? candidate ?? attributes;
                    const artist = latestAttrs?.artistName ?? "";
                    const track = latestAttrs?.name ?? "";
                    const release = latestAttrs?.albumName ?? undefined;
                    const isrc = latestAttrs?.isrc;
                    const { getCachedMBIDs, cacheMBIDs } = await import("./lib/mbidCache");
                    const { lookupMBIDs } = await import("./lib/musicbrainz");
                    const cached = getCachedMBIDs(artist, track, release, isrc);
                    let debugStore: any;
                    try {
                      const { useDebugStore } = await import("./stores/debug");
                      debugStore = useDebugStore();
                      debugStore.addLog(`Retry MBID preload: ${artist} - ${track}`,'info');
                    } catch {}
                    if (cached) {
                      currentTrackMBIDs = cached;
                      if (debugStore) {
                        debugStore.setCurrentMBIDs({
                          recording_mbid: cached.recording_mbid,
                          artist_mbids: cached.artist_mbids,
                          release_mbid: cached.release_mbid,
                          release_group_mbid: cached.release_group_mbid,
                          source: cached.source,
                        });
                        debugStore.addLog(`💾 MBIDs preloaded from cache (retry)`, 'info');
                      }
                    } else {
                      const result = await lookupMBIDs(artist, track, release, isrc);
                      if (result) {
                        currentTrackMBIDs = result;
                        cacheMBIDs(artist, track, result, isrc ? 'isrc' : 'text-search', release, isrc);
                        if (debugStore) {
                          debugStore.setCurrentMBIDs({
                            recording_mbid: result.recording_mbid,
                            artist_mbids: result.artist_mbids,
                            release_mbid: result.release_mbid,
                            release_group_mbid: result.release_group_mbid,
                            source: isrc ? 'isrc' : 'text-search',
                          });
                          debugStore.addLog(`✓ MBIDs preloaded (retry)`, 'success');
                        }
                      } else {
                        cacheMBIDs(artist, track, null, 'none', release, isrc);
                        if (debugStore) {
                          debugStore.setCurrentMBIDs({ source: 'none' });
                          debugStore.addLog('✗ No MBIDs found during preload (retry)', 'info');
                        }
                      }
                    }
                  } catch (err) {
                    console.error('[ListenBrainz+] MBID retry preload failed:', err);
                  }
                })();
              }
            }, 1500);
          }
        });

        mkListenerHost.addEventListener(playbackEvent, (payload: any) => {
          const playbackStates = (window as any).MusicKit?.PlaybackStates ?? {};
          const playingState = playbackStates.playing ?? 2;
          const baseIsPlaying = (playerAny && playerAny.isPlaying === true) || (mkAny && mkAny.isPlaying === true) || payload?.isPlaying === true;
          const playingFlag = payload?.state === playingState || payload?.state === 2 || baseIsPlaying;
          isCurrentlyPlaying = !!playingFlag;

          log('[ListenBrainz] playbackStateDidChange:', payload);

          // If nowPlayingItem is present here, update track context as a fallback.
          const candidateItem = payload?.nowPlayingItem;
          const attrs = candidateItem?.attributes ?? candidateItem;
          const candidateId = candidateItem?.id || attrs?.playParams?.id;
          if (candidateId && candidateId !== currentTrackId) {
            currentTrackId = candidateId;
            currentTrackData = attrs;
            trackStartTime = Math.floor(Date.now() / 1000);
            hasSubmittedCurrentTrack = false;
            lastSkipReason = null;
            hasSeekOccurred = false;
            lastCheckedElapsed = 0;

            // Also kick off MBID preload here, since some environments only surface item data on playbackStateDidChange
            (async () => {
              try {
                const { useMainStore } = await import('./stores/main');
                const mainStore = useMainStore();
                if (!mainStore.mbidEnrichmentEnabled || !mainStore.mbidPreloadEnabled) return;
                const artist = attrs?.artistName ?? "";
                const track = attrs?.name ?? "";
                const release = attrs?.albumName ?? undefined;
                const isrc = attrs?.isrc;
                const { getCachedMBIDs, cacheMBIDs } = await import("./lib/mbidCache");
                const { lookupMBIDs } = await import("./lib/musicbrainz");

                const cached = getCachedMBIDs(artist, track, release, isrc);
                let debugStore: any;
                try {
                  const { useDebugStore } = await import("./stores/debug");
                  debugStore = useDebugStore();
                  debugStore.addLog(`Starting MBID preload (playback): ${artist} - ${track}`,'info');
                  debugStore.setCurrentMBIDs(null);
                } catch {}

                if (cached) {
                  currentTrackMBIDs = cached;
                  if (debugStore) {
                    debugStore.setCurrentMBIDs({
                      recording_mbid: cached.recording_mbid,
                      artist_mbids: cached.artist_mbids,
                      release_mbid: cached.release_mbid,
                      release_group_mbid: cached.release_group_mbid,
                      source: cached.source,
                    });
                    debugStore.addLog(`💾 MBIDs preloaded from cache (playback)`, 'info');
                  }
                } else {
                  const result = await lookupMBIDs(artist, track, release, isrc);
                  if (result) {
                    currentTrackMBIDs = result;
                    cacheMBIDs(artist, track, result, isrc ? 'isrc' : 'text-search', release, isrc);
                    if (debugStore) {
                      debugStore.setCurrentMBIDs({
                        recording_mbid: result.recording_mbid,
                        artist_mbids: result.artist_mbids,
                        release_mbid: result.release_mbid,
                        release_group_mbid: result.release_group_mbid,
                        source: isrc ? 'isrc' : 'text-search',
                      });
                      debugStore.addLog(`✓ MBIDs preloaded (playback)`, 'success');
                    }
                  } else {
                    cacheMBIDs(artist, track, null, 'none', release, isrc);
                    if (debugStore) {
                      debugStore.setCurrentMBIDs({ source: 'none' });
                      debugStore.addLog('✗ No MBIDs found during preload (playback)', 'info');
                    }
                  }
                }
              } catch (err) {
                console.error('[ListenBrainz+] MBID preload (playback) failed:', err);
              }
            })();
          }

          import("./stores/debug").then((m) => {
            const debugStore = (m as any).useDebugStore();
            debugStore.addLog(`Playback: ${isCurrentlyPlaying ? '▶ Playing' : '⏸ Paused'}`, 'info');
            debugStore.setPlaybackState(isCurrentlyPlaying);
            debugStore.setLastPlaybackPayload(payload);
            if (candidateId && candidateId === currentTrackId) {
              debugStore.setNowPlaying({
                artist: attrs?.artistName,
                track: attrs?.name,
                album: attrs?.albumName,
              });
              debugStore.setLastNowPlayingPayload(payload);
              debugStore.setScrobbleState(isCurrentlyPlaying ? 'waiting' : 'idle');
            }
          }).catch(() => {
            // Pinia not ready yet, ignore
          });
        });

        import("./stores/debug").then((m) => {
          const debugStore = (m as any).useDebugStore();
          debugStore.addLog(`MusicKit listeners attached (${mediaItemEvent}, ${playbackEvent})`, 'info');
        }).catch(() => {
          // Pinia not ready yet, ignore
        });
      } else {
        import("./stores/debug").then((m) => {
          const debugStore = (m as any).useDebugStore();
          const musicKeys = music ? Object.keys(music as any) : [];
          const playerKeys = player ? Object.keys(player as any) : [];
          const queueKeys = queue ? Object.keys(queue as any) : [];
          const controllerKeys = controller ? Object.keys(controller as any) : [];
          debugStore.addLog('MusicKit addEventListener not found on player/instance/controller/queue', 'error');
          debugStore.addLog(`MusicKit keys: ${musicKeys.join(', ')}`, 'info');
          debugStore.addLog(`MusicKit.player keys: ${playerKeys.join(', ')}`, 'info');
          debugStore.addLog(`MusicKit._queue keys: ${queueKeys.join(', ')}`, 'info');
          debugStore.addLog(`MusicKit._playbackController keys: ${controllerKeys.join(', ')}`, 'info');
          console.warn('MusicKit addEventListener missing', { music, player, queue, controller, musicKeys, playerKeys, queueKeys, controllerKeys });
        }).catch(() => {
          // Pinia not ready yet, ignore
        });
      }

      // Helper to safely access stores (waits for Pinia to be ready)
      let piniaReady = false;
      const waitForPinia = async () => {
        if (piniaReady) return true;
        try {
          // Try to access a store to check if Pinia is ready
          const { useMainStore } = await import("./stores/main");
          useMainStore(); // Just call it to verify Pinia is available
          piniaReady = true;
          return true;
        } catch (err) {
          // Pinia not ready yet
          return false;
        }
      };

      // Poll to check if we should submit (runs every 2 seconds)
      setInterval(async () => {
        // Skip if Pinia isn't ready yet
        if (!(await waitForPinia())) {
          return;
        }
        
        // Fallback: poll nowPlayingItem in case auto-advance didn't fire the mediaItem event
        try {
          const liveItem = (playerAny && (playerAny as any).nowPlayingItem) || (mkAny && (mkAny as any).nowPlayingItem);
          const liveAttrs = liveItem?.attributes ?? liveItem;
          const liveId = liveItem?.id || liveAttrs?.playParams?.id;
          if (liveId && liveId !== currentTrackId) {
            currentTrackId = liveId;
            currentTrackData = liveAttrs;
            trackStartTime = Math.floor(Date.now() / 1000);
            hasSubmittedCurrentTrack = false;
            lastSkipReason = null;
            hasSeekOccurred = false;
            lastCheckedElapsed = 0;

            try {
              const { useDebugStore } = await import("./stores/debug");
              const debugStore = useDebugStore();
              debugStore.setNowPlaying({
                artist: liveAttrs?.artistName,
                track: liveAttrs?.name,
                album: liveAttrs?.albumName,
              });
              debugStore.setLastNowPlayingPayload(liveItem);
              debugStore.setScrobbleState(isCurrentlyPlaying ? 'waiting' : 'idle', 0, false);
            } catch (err) {
              // Store not ready yet, skip
            }
          }
        } catch (err) {
          console.warn('[ListenBrainz] Poll nowPlaying fallback failed', err);
        }

        if (!currentTrackData) {
          if (lastSkipReason !== 'no-track') {
            try {
              const { useDebugStore } = await import("./stores/debug");
              const debugStore = useDebugStore();
              debugStore.setScrobbleState('idle', 0);
            } catch (err) {
              // Store not ready yet, skip
            }
            lastSkipReason = 'no-track';
          }
          return;
        }

        if (hasSubmittedCurrentTrack) {
          try {
            const { useDebugStore } = await import("./stores/debug");
            const debugStore = useDebugStore();
            debugStore.setScrobbleState('submitted', 1);
          } catch (err) {
            // Store not ready yet, skip
          }
          return;
        }

        if (!isCurrentlyPlaying) {
          if (lastSkipReason !== 'paused') {
            try {
              const { useDebugStore } = await import("./stores/debug");
              const debugStore = useDebugStore();
              debugStore.setScrobbleState('idle', 0);
            } catch (err) {
              // Store not ready yet, skip
            }
            lastSkipReason = 'paused';
          }
          return;
        }

        lastSkipReason = null;

        try {
          const { useMainStore } = await import("./stores/main");
          const mainStore = useMainStore();
          if (!mainStore.scrobblingEnabled || !mainStore.listenbrainzToken) {
            const { useDebugStore } = await import("./stores/debug");
            const debugStore = useDebugStore();
            debugStore.setScrobbleState('idle', 0);
            return;
          }

          const durationMs = Number(currentTrackData?.durationInMillis ?? 0);
          const durationSec = durationMs / 1000;
          const elapsedSec = Math.floor(Date.now() / 1000) - trackStartTime;

          const { useDebugStore } = await import("./stores/debug");
          const debugStore = useDebugStore();

          // Detect seeking: check actual playback position from MusicKit
          try {
            const liveItem = (playerAny && (playerAny as any).nowPlayingItem) || (mkAny && (mkAny as any).nowPlayingItem);
            const currentPlaybackTime = liveItem?.attributes?.currentPlaybackTime ?? 
                                       (playerAny && (playerAny as any).currentPlaybackTime) ??
                                       (mkAny && (mkAny as any).currentPlaybackTime);
            
            if (!hasSeekOccurred && lastCheckedElapsed > 0 && typeof currentPlaybackTime === 'number') {
              const expectedDelta = 2; // poll interval
              const actualDelta = currentPlaybackTime - lastCheckedElapsed;
              // Allow small variance but catch big jumps (forward or backward)
              if (Math.abs(actualDelta - expectedDelta) > 5) {
                hasSeekOccurred = true;
                debugStore.addLog(`Seek detected (jumped ${actualDelta.toFixed(1)}s); using time-based threshold only`, 'info');
              }
            }
            
            if (typeof currentPlaybackTime === 'number') {
              lastCheckedElapsed = currentPlaybackTime;
            }
          } catch (err) {
            console.warn('[ListenBrainz] Failed to check playback position', err);
          }

          const percent = Number(mainStore.scrobblePercent ?? 50) / 100;
          const minSeconds = Number(mainStore.scrobbleMinSeconds ?? 240);
          
          // If seeking occurred, only use time-based threshold
          const pctThreshold = (hasSeekOccurred || durationSec <= 0) ? minSeconds : durationSec * percent;
          const threshold = hasSeekOccurred ? minSeconds : Math.min(pctThreshold, minSeconds);
          const halfPlayed = !hasSeekOccurred && durationSec > 0 && elapsedSec >= pctThreshold;
          const longEnough = elapsedSec >= minSeconds;
          const shouldSubmit = halfPlayed || longEnough;
          const progress = Math.max(0, Math.min(elapsedSec / Math.max(threshold, 1), 1));
          debugStore.setScrobbleState(shouldSubmit ? 'submitted' : 'waiting', shouldSubmit ? 1 : progress, hasSeekOccurred);

          if (shouldSubmit) {
            const artist = currentTrackData?.artistName ?? "";
            const track = currentTrackData?.name ?? "";
            const release = currentTrackData?.albumName ?? undefined;
            const isrc = currentTrackData?.isrc;
            const trackNumber = currentTrackData?.trackNumber;
            
            console.log('[ListenBrainz+] Preparing scrobble with preloaded MBIDs:', { artist, track, release, isrc });
            debugStore.addLog(`Preparing scrobble: ${artist} - ${track}`, 'info');
            
            // Look up MBIDs (only if enrichment enabled)
            let mbids: any = null;
            try {
              const { getCachedMBIDs, cacheMBIDs } = await import("./lib/mbidCache");
              const { lookupMBIDs } = await import("./lib/musicbrainz");
              const { useMainStore } = await import('./stores/main');
              const mainStore = useMainStore();
              if (!mainStore.mbidEnrichmentEnabled) {
                console.log('[ListenBrainz+] MBID enrichment disabled; skipping lookup');
              } else {
              // Prefer preloaded MBIDs if available
              if (currentTrackMBIDs) {
                mbids = currentTrackMBIDs;
                console.log('[ListenBrainz+] Using preloaded MBIDs:', mbids);
                debugStore.addLog('💾 Using preloaded MBIDs', 'info');
              } else {
                // Fallback: check cache and do a quick lookup if needed
                mbids = getCachedMBIDs(artist, track, release, isrc);
                if (!mbids) {
                  console.log('[ListenBrainz+] No preloaded MBIDs; quick lookup...');
                  const lookupResult = await lookupMBIDs(artist, track, release, isrc);
                  if (lookupResult) {
                    cacheMBIDs(artist, track, lookupResult, isrc ? 'isrc' : 'text-search', release, isrc);
                    mbids = lookupResult;
                    console.log('[ListenBrainz+] ✓ MBIDs found (fallback):', mbids);
                    debugStore.addLog('✓ MBIDs found (fallback)', 'success');
                  } else {
                    cacheMBIDs(artist, track, null, 'none', release, isrc);
                    console.log('[ListenBrainz+] ✗ No MBIDs found (fallback)');
                    debugStore.addLog('✗ No MBIDs found (fallback)', 'info');
                  }
                } else {
                  console.log('[ListenBrainz+] ✓ Cache hit (fallback):', mbids);
                  debugStore.addLog(`💾 MBIDs from cache (${mbids.source})`, 'info');
                }
              }
              }
            } catch (err) {
              console.error('[ListenBrainz+] MBID lookup failed:', err);
              debugStore.addLog(`✗ MBID lookup error: ${err instanceof Error ? err.message : String(err)}`, 'error');
            }
            
            const { getScrobbleQueue } = await import("./lib/scrobbleQueue");
            const queue = getScrobbleQueue();
            
            // Build additional_info with MBIDs if available
            const additional_info: any = {
              music_service: "Apple Music",
            };
            
            if (mbids?.recording_mbid) {
              additional_info.recording_mbid = mbids.recording_mbid;
            }
            if (mbids?.artist_mbids && mbids.artist_mbids.length > 0) {
              additional_info.artist_mbids = mbids.artist_mbids;
            }
            if (mbids?.release_mbid) {
              additional_info.release_mbid = mbids.release_mbid;
            }
            if (mbids?.release_group_mbid) {
              additional_info.release_group_mbid = mbids.release_group_mbid;
            }
            if (trackNumber) {
              additional_info.tracknumber = trackNumber;
            }
            if (isrc) {
              additional_info.isrc = isrc;
            }
            
            const mbidInfo = mbids?.recording_mbid ? ' [+MBID]' : '';
            debugStore.addLog(`Added to queue: ${artist} - ${track}${mbidInfo} (${elapsedSec}s / ${durationSec.toFixed(0)}s)`, 'info');
            queue.add({
              listen_type: "single",
              payload: [
                {
                  listened_at: trackStartTime,
                  track_metadata: {
                    artist_name: artist,
                    track_name: track,
                    release_name: release,
                    additional_info,
                  },
                },
              ],
            });
            hasSubmittedCurrentTrack = true;
            debugStore.setScrobbleState('submitted', 1);
            console.log("Queued scrobble to ListenBrainz:", artist, track, mbidInfo);
          }
        } catch (err) {
          // Store not ready or other error, skip this cycle
          console.debug('[ListenBrainz+] Store access failed:', err);
        }
      }, 2000);

      // Expose a manual scrobble trigger used by the debug panel.
      (window as any).__lbpManualScrobble = async () => {
        if (!currentTrackData) return;
        const { useMainStore } = await import("./stores/main");
        const mainStore = useMainStore();
        if (!mainStore.listenbrainzToken || !mainStore.scrobblingEnabled) return;

        const artist = currentTrackData?.artistName ?? "";
        const track = currentTrackData?.name ?? "";
        const release = currentTrackData?.albumName ?? undefined;
        const isrc = currentTrackData?.isrc;
        const trackNumber = currentTrackData?.trackNumber;
        const { getScrobbleQueue } = await import("./lib/scrobbleQueue");
        const { useDebugStore } = await import("./stores/debug");
        const debugStore = useDebugStore();
        const queue = getScrobbleQueue();

        // Look up MBIDs (only if enrichment enabled)
        let mbids: any = null;
        try {
          const { getCachedMBIDs, cacheMBIDs } = await import("./lib/mbidCache");
          const { lookupMBIDs } = await import("./lib/musicbrainz");
          const { useMainStore } = await import('./stores/main');
          const mainStore = useMainStore();
          if (!mainStore.mbidEnrichmentEnabled) {
            debugStore.addLog('MBID enrichment disabled; skipping lookup', 'info');
          } else {
          
          mbids = getCachedMBIDs(artist, track, release, isrc);
          
          if (!mbids) {
            debugStore.addLog(`Looking up MBIDs for: ${track}`, 'info');
            const lookupResult = await lookupMBIDs(artist, track, release, isrc);
            
            if (lookupResult) {
              cacheMBIDs(artist, track, lookupResult, isrc ? 'isrc' : 'text-search', release, isrc);
              mbids = lookupResult;
              debugStore.addLog(`✓ Found MBIDs (${isrc ? 'via ISRC' : 'via text search'})`, 'success');
            } else {
              cacheMBIDs(artist, track, null, 'none', release, isrc);
              debugStore.addLog('✗ No MBIDs found', 'info');
            }
          } else {
            debugStore.addLog(`MBIDs from cache (${mbids.source})`, 'info');
          }
          }
        } catch (err) {
          console.error('[ListenBrainz+] MBID lookup failed:', err);
          debugStore.addLog('✗ MBID lookup error', 'error');
        }

        const additional_info: any = {
          music_service: "Apple Music",
        };
        
        if (mbids?.recording_mbid) {
          additional_info.recording_mbid = mbids.recording_mbid;
        }
        if (mbids?.artist_mbids && mbids.artist_mbids.length > 0) {
          additional_info.artist_mbids = mbids.artist_mbids;
        }
        if (mbids?.release_mbid) {
          additional_info.release_mbid = mbids.release_mbid;
        }
        if (mbids?.release_group_mbid) {
          additional_info.release_group_mbid = mbids.release_group_mbid;
        }
        if (trackNumber) {
          additional_info.tracknumber = trackNumber;
        }
        if (isrc) {
          additional_info.isrc = isrc;
        }

        const mbidInfo = mbids?.recording_mbid ? ' [+MBID]' : '';
        debugStore.addLog(`Added to queue (manual): ${artist} - ${track}${mbidInfo}`, 'info');
        queue.add({
          listen_type: "single",
          payload: [
            {
              listened_at: trackStartTime || Math.floor(Date.now() / 1000),
              track_metadata: {
                artist_name: artist,
                track_name: track,
                release_name: release,
                additional_info,
              },
            },
          ],
        });
        hasSubmittedCurrentTrack = true;
        debugStore.setScrobbleState('submitted', 1);
      };
    },
  });

// Exporting the plugin and helpers used by Cider
export { setupConfig, customElementName, goToPage, useCPlugin };
export default plugin;
