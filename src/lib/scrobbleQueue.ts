import { submitListens } from './listenbrainz';

const log = (...args: any[]) => {
  import('../stores/main')
    .then(({ useMainStore }) => {
      try {
        if (useMainStore().debugLoggingEnabled) console.log(...args);
      } catch {}
    })
    .catch(() => {});
};

const warn = (...args: any[]) => {
  import('../stores/main')
    .then(({ useMainStore }) => {
      try {
        if (useMainStore().debugLoggingEnabled) console.warn(...args);
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

export interface QueuedScrobble {
  id: string;
  payload: {
    listen_type: 'single';
    payload: Array<{
      listened_at: number;
      track_metadata: {
        artist_name: string;
        track_name: string;
        release_name?: string;
        additional_info?: Record<string, any>;
      };
    }>;
  };
  timestamp: number;
  retries: number;
  lastAttempt?: number;
}

export class ScrobbleQueue {
  private queue: QueuedScrobble[] = [];
  private processing = false;
  private readonly STORAGE_KEY = 'de.airsi.listenbrainz-plus/queue/v1';
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAYS = [5000, 15000, 60000, 300000, 900000]; // 5s, 15s, 1m, 5m, 15m
  private readonly MAX_QUEUE_SIZE = 100;
  private processingTimer?: number;

  constructor() {
    log('[ScrobbleQueue] Initializing queue...');
    try {
      this.loadQueue();
      log('[ScrobbleQueue] Queue loaded successfully');
    } catch (err) {
      error('[ScrobbleQueue] Failed to initialize:', err);
    }
  }

  private loadQueue() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(this.STORAGE_KEY) : null;
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.queue = parsed;
        log(`[ScrobbleQueue] Loaded ${this.queue.length} queued scrobbles`);
      }
    } catch (err) {
      warn('[ScrobbleQueue] Failed to load queue', err);
    }
  }

  private saveQueue() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (err) {
      warn('[ScrobbleQueue] Failed to save queue', err);
    }
  }

  add(payload: QueuedScrobble['payload']): string {
    // Trim queue if too large
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      warn('[ScrobbleQueue] Queue full, removing oldest item');
      this.queue.shift();
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const item: QueuedScrobble = {
      id,
      payload,
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(item);
    this.saveQueue();
    log(`[ScrobbleQueue] Added scrobble to queue (${this.queue.length} total)`);

    // Start processing if not already running
    this.startProcessing();

    return id;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getQueue(): QueuedScrobble[] {
    return [...this.queue];
  }

  clearQueue() {
    this.queue = [];
    this.saveQueue();
    log('[ScrobbleQueue] Queue cleared');
  }

  private startProcessing() {
    if (this.processing) return;
    this.processing = true;
    this.processQueue();
  }

  private async processQueue() {
    while (this.queue.length > 0 && this.processing) {
      const item = this.queue[0];

      // Check if we should retry yet
      if (item.lastAttempt) {
        const retryDelay = this.RETRY_DELAYS[Math.min(item.retries - 1, this.RETRY_DELAYS.length - 1)];
        const timeSinceLastAttempt = Date.now() - item.lastAttempt;
        if (timeSinceLastAttempt < retryDelay) {
          // Schedule next check
          const nextCheck = retryDelay - timeSinceLastAttempt;
          log(`[ScrobbleQueue] Waiting ${Math.round(nextCheck / 1000)}s before retry`);
          this.processingTimer = window.setTimeout(() => this.processQueue(), Math.min(nextCheck, 30000));
          return;
        }
      }

      try {
        // Get token from store dynamically
        const { useMainStore } = await import('../stores/main');
        const mainStore = useMainStore();
        
        if (!mainStore.listenbrainzToken) {
          log('[ScrobbleQueue] No token available, pausing processing');
          this.processing = false;
          return;
        }

        log(`[ScrobbleQueue] Submitting scrobble (attempt ${item.retries + 1}/${this.MAX_RETRIES + 1})`);
        item.lastAttempt = Date.now();
        item.retries++;

        await submitListens(mainStore.listenbrainzToken, item.payload);

        // Success! Remove from queue
        this.queue.shift();
        this.saveQueue();
        log(`[ScrobbleQueue] ✓ Scrobble submitted (${this.queue.length} remaining)`);

        // Log to debug store
        try {
          const { useDebugStore } = await import('../stores/debug');
          const debugStore = useDebugStore();
          const track = item.payload.payload[0].track_metadata;
          debugStore.addLog(`✓ Scrobbled to ListenBrainz: ${track.artist_name} - ${track.track_name}`, 'success');
        } catch {}

      } catch (err) {
        error('[ScrobbleQueue] Submit failed:', err);

        // Check if we should retry or give up
        if (item.retries >= this.MAX_RETRIES) {
          error('[ScrobbleQueue] Max retries reached, removing from queue');
          this.queue.shift();
          this.saveQueue();

          // Log failure
          try {
            const { useDebugStore } = await import('../stores/debug');
            const debugStore = useDebugStore();
            const track = item.payload.payload[0].track_metadata;
            debugStore.addLog(`✗ Failed to scrobble (gave up after ${this.MAX_RETRIES} retries): ${track.artist_name} - ${track.track_name}`, 'error');
          } catch {}
        } else {
          // Update item and save
          this.saveQueue();
          const nextDelay = this.RETRY_DELAYS[Math.min(item.retries - 1, this.RETRY_DELAYS.length - 1)];
          log(`[ScrobbleQueue] Will retry in ${Math.round(nextDelay / 1000)}s`);
          
          // Schedule retry
          this.processingTimer = window.setTimeout(() => this.processQueue(), Math.min(nextDelay, 30000));
          return;
        }
      }

      // Small delay between successful submissions
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.processing = false;
    log('[ScrobbleQueue] Processing complete');
  }

  stopProcessing() {
    this.processing = false;
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = undefined;
    }
  }

  // Resume processing (e.g., when coming back online or token added)
  resume() {
    if (this.queue.length > 0 && !this.processing) {
      log('[ScrobbleQueue] Resuming queue processing');
      this.startProcessing();
    }
  }
}

// Singleton instance
let queueInstance: ScrobbleQueue | null = null;

export function getScrobbleQueue(): ScrobbleQueue {
  if (!queueInstance) {
    queueInstance = new ScrobbleQueue();
  }
  return queueInstance;
}
