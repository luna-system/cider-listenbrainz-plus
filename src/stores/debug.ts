import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useDebugStore = defineStore('debug-store', () => {
  const logs = ref<Array<{ time: string; message: string; type: 'info' | 'success' | 'error' }>>([]);
  const maxLogs = 50;

  const isPlaying = ref<boolean>(false);
  const nowPlaying = ref<{ artist?: string; track?: string; album?: string } | null>(null);
  const lastNowPlayingPayload = ref<any>(null);
  const lastPlaybackPayload = ref<any>(null);
  const scrobbleState = ref<'idle' | 'waiting' | 'submitted'>('idle');
  const scrobbleProgress = ref<number>(0);
  const scrobbleSeekDetected = ref<boolean>(false);
  const currentMBIDs = ref<{ recording_mbid?: string; artist_mbids?: string[]; release_mbid?: string; release_group_mbid?: string; source?: string } | null>(null);

  function addLog(message: string, type: 'info' | 'success' | 'error' = 'info') {
    const time = new Date().toLocaleTimeString();
    logs.value.unshift({ time, message, type });
    if (logs.value.length > maxLogs) {
      logs.value.pop();
    }
  }

  function clearLogs() {
    logs.value = [];
  }

  function setPlaybackState(playing: boolean) {
    isPlaying.value = playing;
  }

  function setNowPlaying(payload: { artist?: string; track?: string; album?: string } | null) {
    nowPlaying.value = payload;
  }

  function setLastNowPlayingPayload(payload: any) {
    lastNowPlayingPayload.value = payload;
  }

  function setLastPlaybackPayload(payload: any) {
    lastPlaybackPayload.value = payload;
  }

  function setScrobbleState(state: 'idle' | 'waiting' | 'submitted', progress?: number, seekDetected?: boolean) {
    scrobbleState.value = state;
    if (typeof progress === 'number') {
      scrobbleProgress.value = Math.max(0, Math.min(progress, 1));
    }
    if (typeof seekDetected === 'boolean') {
      scrobbleSeekDetected.value = seekDetected;
    }
  }

  function setCurrentMBIDs(mbids: { recording_mbid?: string; artist_mbids?: string[]; release_mbid?: string; release_group_mbid?: string; source?: string } | null) {
    currentMBIDs.value = mbids;
  }

  return {
    logs,
    addLog,
    clearLogs,
    isPlaying,
    nowPlaying,
    setPlaybackState,
    setNowPlaying,
    lastNowPlayingPayload,
    lastPlaybackPayload,
    setLastNowPlayingPayload,
    setLastPlaybackPayload,
    setScrobbleState,
    scrobbleState,
    scrobbleProgress,
    scrobbleSeekDetected,
    currentMBIDs,
    setCurrentMBIDs,
  };
});
