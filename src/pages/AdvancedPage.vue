<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMainStore } from '../stores/main';
import { useDebugStore } from '../stores/debug';
import { submitListens } from '../lib/listenbrainz';

const mainStore = useMainStore();
const debugStore = useDebugStore();
const logsExpanded = ref<boolean>(false);
const eventPayloadsExpanded = ref<boolean>(false);
const activePayloadTab = ref<'nowPlaying' | 'playback'>('nowPlaying');
const queueSize = ref<number>(0);
const mbidCacheStats = ref<{ entryCount: number; oldestEntry: number | null; newestEntry: number | null } | null>(null);
const enrichmentEnabled = computed(() => mainStore.mbidEnrichmentEnabled);

// Poll queue size
import { onMounted, onUnmounted } from 'vue';
let queuePollInterval: number | undefined;

onMounted(async () => {
  const { getScrobbleQueue } = await import('../lib/scrobbleQueue');
  const queue = getScrobbleQueue();
  queueSize.value = queue.getQueueSize();
  
  const { getMBIDCacheStats } = await import('../lib/mbidCache');
  mbidCacheStats.value = getMBIDCacheStats();
  
  queuePollInterval = window.setInterval(() => {
    queueSize.value = queue.getQueueSize();
    mbidCacheStats.value = getMBIDCacheStats();
  }, 2000);
});

onUnmounted(() => {
  if (queuePollInterval) {
    clearInterval(queuePollInterval);
  }
});

const tokenMasked = computed(() => {
  if (!mainStore.listenbrainzToken) return '(not set)';
  const t = mainStore.listenbrainzToken;
  return t.length > 8 ? t.slice(0, 4) + '...' + t.slice(-4) : '****';
});

const isPlaying = computed(() => debugStore.isPlaying);
const scrobbleState = computed(() => debugStore.scrobbleState);
const scrobbleProgress = computed(() => Math.round((debugStore.scrobbleProgress || 0) * 100));
const scrobbleSeekDetected = computed(() => debugStore.scrobbleSeekDetected);
const scrobbleThresholdText = computed(() => 
  scrobbleSeekDetected.value 
    ? 'Time-based only' 
    : `${useMainStore().scrobblePercent}% target`
);
const scrobbleStateLabel = computed(() => {
  switch (scrobbleState.value) {
    case 'waiting':
      return 'Waiting for song threshold';
    case 'submitted':
      return 'Submitted';
    default:
      return 'Idle';
  }
});

const currentTrack = computed(() => {
  if (!debugStore.nowPlaying) return null;
  return {
    artist: debugStore.nowPlaying.artist || '',
    track: debugStore.nowPlaying.track || '',
    album: debugStore.nowPlaying.album || '',
    duration: '',
    current: '',
  };
});

const currentMBIDs = computed(() => debugStore.currentMBIDs);

async function testScrobble() {
  if (!mainStore.listenbrainzToken) {
    debugStore.addLog('No token set!', 'error');
    return;
  }
  if (!currentTrack.value) {
    debugStore.addLog('No track playing', 'error');
    return;
  }
  try {
    debugStore.addLog(`Manual scrobble triggered: ${currentTrack.value.artist} - ${currentTrack.value.track}`, 'info');
    if (typeof (window as any).__lbpManualScrobble === 'function') {
      await (window as any).__lbpManualScrobble();
    } else {
      await submitListens(mainStore.listenbrainzToken, {
        listen_type: 'single',
        payload: [
          {
            listened_at: Math.floor(Date.now() / 1000),
            track_metadata: {
              artist_name: currentTrack.value.artist,
              track_name: currentTrack.value.track,
              release_name: currentTrack.value.album,
              additional_info: { music_service: 'Apple Music' },
            },
          },
        ],
      });
      debugStore.addLog(`✓ Scrobble sent for: ${currentTrack.value.track}`, 'success');
    }
  } catch (err) {
    debugStore.addLog(`✗ Scrobble failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}

async function clearMBIDCache() {
  try {
    const { clearMBIDCache } = await import('../lib/mbidCache');
    clearMBIDCache();
    const { getMBIDCacheStats } = await import('../lib/mbidCache');
    mbidCacheStats.value = getMBIDCacheStats();
    debugStore.addLog('✓ MBID cache cleared', 'success');
  } catch (err) {
    debugStore.addLog(`✗ Failed to clear cache: ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}

function formatCacheAge(): string {
  if (!mbidCacheStats.value || mbidCacheStats.value.entryCount === 0) return 'N/A';
  const oldestMs = mbidCacheStats.value.oldestEntry;
  if (!oldestMs) return 'N/A';
  const ageMs = Date.now() - oldestMs;
  const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;
  const hours = Math.floor(ageMs / (60 * 60 * 1000));
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  const minutes = Math.floor(ageMs / (60 * 1000));
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}
</script>

<template>
  <div class="advanced-page-container plugin-base">
    <div class="advanced-page-content">
      <h1 class="apple-heading">ListenBrainz Plus Advanced</h1>

    <div class="debug-section">
      <h2 style="font-size: 14px; margin: 0 0 8px 0; color: #999">Status</h2>
      <div class="debug-row">
        <span>Token:</span>
        <span>{{ tokenMasked }}</span>
      </div>
      <div class="debug-row">
        <span>Scrobbling:</span>
        <span>{{ mainStore.scrobblingEnabled ? '✓ Enabled' : '✗ Disabled' }}</span>
      </div>
      <div class="debug-row">
        <span>MBID Enrichment:</span>
        <span>
          <span :class="enrichmentEnabled ? 'badge badge--on' : 'badge badge--off'">{{ enrichmentEnabled ? 'Enabled' : 'Disabled' }}</span>
        </span>
      </div>
      <div class="debug-row">
        <span>Playing:</span>
        <span>{{ isPlaying ? '▶ Yes' : '⏸ No' }}</span>
      </div>
      <div class="debug-row">
        <span>Queue:</span>
        <span>{{ queueSize }} pending</span>
      </div>
    </div>

    <div class="debug-section" v-if="currentTrack">
      <h2 style="font-size: 14px; margin: 0 0 8px 0; color: #999">Now Playing</h2>
      <div class="debug-row">
        <span>Artist:</span>
        <span>{{ currentTrack.artist }}</span>
      </div>
      <div class="debug-row">
        <span>Track:</span>
        <span>{{ currentTrack.track }}</span>
      </div>
      <div class="debug-row">
        <span>Album:</span>
        <span>{{ currentTrack.album }}</span>
      </div>
    </div>

    <div class="debug-section" v-if="currentTrack" :class="{ 'section-disabled': !enrichmentEnabled }">
      <div style="display:flex; align-items:center; gap:8px; margin: 0 0 8px 0">
        <h2 style="font-size: 14px; margin: 0; color: #999">Current Track MBIDs</h2>
        <span :class="enrichmentEnabled ? 'badge badge--on' : 'badge badge--off'">{{ enrichmentEnabled ? 'Enrichment On' : 'Enrichment Off' }}</span>
      </div>
      <div v-if="!enrichmentEnabled" style="font-size: 12px; color: #999; margin-bottom: 6px">
        MBID enrichment is disabled. Turn it on in Settings to populate identifiers.
      </div>
      <div v-if="currentMBIDs && enrichmentEnabled" style="font-size: 12px; color: #ccc">
        <div class="debug-row">
          <span>Source:</span>
          <span>{{ currentMBIDs.source || 'n/a' }}</span>
        </div>
        <div class="debug-row">
          <span>Recording:</span>
          <span>{{ currentMBIDs.recording_mbid || '(not found)' }}</span>
        </div>
        <div class="debug-row">
          <span>Artist(s):</span>
          <span>{{ currentMBIDs.artist_mbids && currentMBIDs.artist_mbids.length ? currentMBIDs.artist_mbids.join(', ') : '(not found)' }}</span>
        </div>
        <div class="debug-row">
          <span>Release:</span>
          <span>{{ currentMBIDs.release_mbid || '(not found)' }}</span>
        </div>
        <div class="debug-row">
          <span>Release Group:</span>
          <span>{{ currentMBIDs.release_group_mbid || '(not found)' }}</span>
        </div>
      </div>
      <div v-else-if="enrichmentEnabled" style="font-size: 12px; color: #999">(no MBIDs loaded yet)</div>
    </div>

    <div class="debug-section" v-if="currentTrack">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
        <h2 style="font-size: 14px; margin: 0; color: #999">Scrobble Status</h2>
        <button class="c-button" @click="testScrobble" style="font-size: 12px; padding: 4px 8px">Scrobble Now</button>
      </div>
      <div class="scrobble-row">
        <div class="scrobble-dot" :class="[`scrobble-dot--${scrobbleState}`]"></div>
        <div class="scrobble-label">{{ scrobbleStateLabel }}</div>
        <div class="scrobble-progress" :class="{ 'scrobble-progress--seek': scrobbleSeekDetected }">
          <div class="scrobble-progress__bar" :style="{ width: (scrobbleSeekDetected ? 100 : scrobbleProgress) + '%' }"></div>
        </div>
        <div class="scrobble-text">Progress toward {{ scrobbleThresholdText }}</div>
      </div>
    </div>

    <div class="debug-section" v-if="mbidCacheStats">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
        <h2 style="font-size: 14px; margin: 0; color: #999">MusicBrainz ID Cache</h2>
        <button class="c-button" @click="clearMBIDCache" style="font-size: 12px; padding: 4px 8px">Clear Cache</button>
      </div>
      <div class="debug-row">
        <span>Cached tracks:</span>
        <span>{{ mbidCacheStats.entryCount }}</span>
      </div>
      <div class="debug-row" v-if="mbidCacheStats.entryCount > 0">
        <span>Cache age:</span>
        <span>{{ formatCacheAge() }}</span>
      </div>
      <div style="margin-top: 8px; font-size: 12px; color: #999">
        MBIDs are looked up from MusicBrainz to enrich scrobbles with accurate metadata. Disable enrichment in Settings to skip lookups.
      </div>
    </div>

    <div class="debug-section">
      <div 
        style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none"
        @click="logsExpanded = !logsExpanded"
      >
        <h2 style="font-size: 14px; margin: 0; color: #999">
          {{ logsExpanded ? '▼' : '▶' }} Logs
        </h2>
        <button 
          v-if="logsExpanded"
          class="c-button" 
          @click.stop="debugStore.clearLogs" 
          style="font-size: 11px; padding: 2px 6px"
        >
          Clear
        </button>
      </div>
      <div v-if="logsExpanded" class="debug-logs" style="margin-top: 8px">
        <div
          v-for="(log, idx) in debugStore.logs"
          :key="idx"
          :class="['debug-log', `debug-log--${log.type}`]"
        >
          <span class="debug-time">{{ log.time }}</span>
          <span class="debug-msg">{{ log.message }}</span>
        </div>
        <div v-if="debugStore.logs.length === 0" class="debug-log debug-log--info">
          (no logs yet)
        </div>
      </div>
    </div>

    <div class="debug-section">
      <div 
        style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none"
        @click="eventPayloadsExpanded = !eventPayloadsExpanded"
      >
        <h2 style="font-size: 14px; margin: 0; color: #999">
          {{ eventPayloadsExpanded ? '▼' : '▶' }} Last Event Payloads
        </h2>
      </div>
      <div v-if="eventPayloadsExpanded" style="margin-top: 8px">
        <div v-if="!debugStore.lastNowPlayingPayload && !debugStore.lastPlaybackPayload" class="debug-log debug-log--info">
          No event payloads captured yet
        </div>
        <div v-else>
          <div class="payload-tabs">
            <button 
              class="payload-tab" 
              :class="{ 'payload-tab--active': activePayloadTab === 'nowPlaying' }"
              @click="activePayloadTab = 'nowPlaying'"
              :disabled="!debugStore.lastNowPlayingPayload"
            >
              nowPlayingItemDidChange
            </button>
            <button 
              class="payload-tab" 
              :class="{ 'payload-tab--active': activePayloadTab === 'playback' }"
              @click="activePayloadTab = 'playback'"
              :disabled="!debugStore.lastPlaybackPayload"
            >
              playbackStateDidChange
            </button>
          </div>
          <div class="debug-context" v-if="activePayloadTab === 'nowPlaying' && debugStore.lastNowPlayingPayload" style="margin-top: 8px">
            {{ JSON.stringify(debugStore.lastNowPlayingPayload, null, 2) }}
          </div>
          <div class="debug-context" v-if="activePayloadTab === 'playback' && debugStore.lastPlaybackPayload" style="margin-top: 8px">
            {{ JSON.stringify(debugStore.lastPlaybackPayload, null, 2) }}
          </div>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.advanced-page-container {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 1.5rem;
}

.advanced-page-content {
  width: 100%;
  max-width: 800px;
}

.debug-section {
  margin: 16px 0;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.debug-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  line-height: 1.6;
  font-family: monospace;
}

.debug-row span:first-child {
  color: #999;
  flex: 0 0 auto;
  margin-right: 16px;
}

.debug-row span:last-child {
  color: #eee;
  text-align: right;
  flex: 1;
  word-break: break-all;
}

.debug-logs {
  max-height: 300px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 8px;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.4;
  user-select: text;
  cursor: text;
}

.debug-log {
  margin: 4px 0;
  padding: 4px 6px;
  border-radius: 2px;
  user-select: text;
}

.debug-log--info {
  color: #aaa;
}

.debug-log--success {
  color: #6c9;
  background: rgba(102, 204, 153, 0.1);
}

.debug-log--error {
  color: #f66;
  background: rgba(255, 102, 102, 0.1);
}

.debug-time {
  color: #666;
  margin-right: 8px;
}

.debug-context {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 8px;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.4;
  max-height: 400px;
  overflow-y: auto;
  color: #ccc;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
  cursor: text;
  margin-top: 8px;
}

.c-button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.c-button:hover {
  background: rgba(255, 255, 255, 0.15);
}

.badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 1.6;
  border: 1px solid rgba(255,255,255,0.2);
}
.badge--on {
  color: #6c9;
  background: rgba(102, 204, 153, 0.12);
}
.badge--off {
  color: #f66;
  background: rgba(255, 102, 102, 0.12);
}

.scrobble-row {
  display: grid;
  grid-template-columns: auto 1fr 3fr 2fr;
  gap: 10px;
  align-items: center;
}

.scrobble-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #666;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.scrobble-dot--idle {
  background: #777;
}

.scrobble-dot--waiting {
  background: #cc6;
}

.scrobble-dot--submitted {
  background: #6c9;
}

.scrobble-progress {
  position: relative;
  height: 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.scrobble-progress__bar {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 0%;
  background: linear-gradient(90deg, #6cf, #6c9);
  transition: width 0.3s ease;
}

@keyframes candycane {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 40px 0;
  }
}

.scrobble-progress--seek {
  opacity: 0.4;
}

.scrobble-progress--seek .scrobble-progress__bar {
  background: repeating-linear-gradient(
    45deg,
    #555,
    #555 10px,
    #666 10px,
    #666 20px
  );
  background-size: 40px 40px;
  animation: candycane 1s linear infinite 0.2s;
}

.scrobble-label {
  color: #ccc;
  font-size: 12px;
}

.scrobble-text {
  color: #aaa;
  font-size: 12px;
  text-align: right;
  white-space: nowrap;
}

.payload-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.payload-tab {
  background: transparent;
  border: none;
  color: #999;
  padding: 8px 12px;
  font-size: 12px;
  font-family: monospace;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.payload-tab:hover:not(:disabled) {
  color: #ccc;
  background: rgba(255, 255, 255, 0.05);
}

.payload-tab--active {
  color: #6cf;
  border-bottom-color: #6cf;
}

.payload-tab:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.section-disabled {
  opacity: 0.6;
}
</style>
