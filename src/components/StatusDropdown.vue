<script setup lang="ts">
import { computed } from 'vue';
import { useMainStore } from '../stores/main';
import { useDebugStore } from '../stores/debug';

const mainStore = useMainStore();
const debugStore = useDebugStore();

const statusText = computed(() => {
  if (!mainStore.scrobblingEnabled) {
    return 'Scrobbling disabled in settings';
  }
  if (!mainStore.listenbrainzToken) {
    return 'Missing user token';
  }
  return 'Ready to scrobble';
});

const statusClass = computed(() => {
  if (!mainStore.scrobblingEnabled) {
    return 'status-error';
  }
  if (!mainStore.listenbrainzToken) {
    return 'status-warning';
  }
  return 'status-ok';
});

const scrobbleStateLabel = computed(() => {
  switch (debugStore.scrobbleState) {
    case 'waiting':
      return 'Waiting for song threshold';
    case 'submitted':
      return 'Submitted';
    default:
      return 'Idle';
  }
});
</script>

<template>
  <div class="plugin-base listenbrainz-status">
    <div class="status-header">
      <h3>ListenBrainz</h3>
      <div class="status-indicator" :class="statusClass">
        {{ statusText }}
      </div>
    </div>
    <div class="status-details" v-if="debugStore.nowPlaying">
      <div class="now-playing">
        <strong>Now Playing:</strong>
        <div>{{ debugStore.nowPlaying.artist }} - {{ debugStore.nowPlaying.track }}</div>
      </div>
      <div class="scrobble-status" v-if="mainStore.scrobblingEnabled">
        State: {{ scrobbleStateLabel }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.listenbrainz-status {
  padding: 12px;
  min-width: 250px;
}

.status-header {
  margin-bottom: 12px;
}

.status-header h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #fff;
}

.status-indicator {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  display: inline-block;
}

.status-ok {
  background: rgba(102, 204, 153, 0.2);
  color: #6c9;
}

.status-warning {
  background: rgba(255, 204, 102, 0.2);
  color: #fc6;
}

.status-error {
  background: rgba(255, 102, 102, 0.2);
  color: #f66;
}

.status-details {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.now-playing {
  font-size: 13px;
  color: #ccc;
}

.now-playing strong {
  display: block;
  margin-bottom: 4px;
  color: #fff;
}

.scrobble-status {
  margin-top: 8px;
  font-size: 12px;
  color: #999;
}
</style>
