<script setup lang="ts">
import { useMainStore } from "../stores/main";

const main = useMainStore();
const store = useMainStore();
</script>

<template>
  <div class="settings-container plugin-base">
    <h1 class="apple-heading">ListenBrainz Plus Settings</h1>

    <div class="settings-grid">
      <!-- Credentials -->
      <section class="settings-card">
        <h2 class="section-title">Credentials</h2>
        <div class="form-row">
          <label class="label">ListenBrainz Token</label>
          <input
            class="input"
            :value="store.listenbrainzToken"
            @input="store.setListenbrainzToken(($event.target as HTMLInputElement).value)"
            placeholder="Enter your user token"
          />
          <div class="hint">Find it in your ListenBrainz account settings.</div>
        </div>
      </section>

      <!-- Scrobbling -->
      <section class="settings-card">
        <h2 class="section-title">Scrobbling</h2>
        <div class="form-row inline spaced-row">
          <label class="label">Enable Scrobbling</label>
          <label class="switch">
            <input type="checkbox" :checked="store.scrobblingEnabled" @change="store.setScrobblingEnabled(($event.target as HTMLInputElement).checked)" />
            <span class="slider"></span>
          </label>
        </div>
        <div class="form-row two-col">
          <div class="col">
            <label class="label">Percent played</label>
            <input
              type="number"
              min="1"
              max="100"
              class="input"
              :value="store.scrobblePercent"
              @input="store.setScrobblePercent(Number(($event.target as HTMLInputElement).value))"
            />
            <div class="hint">Default 50%. Scrobble when this or the time rule is met.</div>
          </div>
          <div class="col">
            <label class="label">Min seconds</label>
            <input
              type="number"
              min="10"
              class="input"
              :value="store.scrobbleMinSeconds"
              @input="store.setScrobbleMinSeconds(Number(($event.target as HTMLInputElement).value))"
            />
            <div class="hint">Default 60s. Scrobble when percent or seconds is met.</div>
          </div>
        </div>
      </section>

      <!-- Enrichment -->
      <section class="settings-card">
        <h2 class="section-title">Enrichment</h2>
        <div class="form-row inline">
          <label class="label">Enable MBID enrichment</label>
          <label class="switch">
            <input type="checkbox" v-model="main.mbidEnrichmentEnabled" @change="main.setMbidEnrichmentEnabled(main.mbidEnrichmentEnabled)" />
            <span class="slider"></span>
          </label>
        </div>
        <div class="hint">Controls all MBID lookups and attachments to scrobbles. Disabling enrichment may reduce ListenBrainz match accuracy.</div>
        <div class="form-row inline">
          <label class="label">Preload MBIDs on track start</label>
          <label class="switch">
            <input type="checkbox" :disabled="!main.mbidEnrichmentEnabled" v-model="main.mbidPreloadEnabled" @change="main.setMbidPreloadEnabled(main.mbidPreloadEnabled)" />
            <span class="slider"></span>
          </label>
        </div>
        <div class="hint">Preloading finds MBIDs earlier for current track; slight extra network usage.</div>
      </section>

      <!-- Debug -->
      <section class="settings-card">
        <h2 class="section-title">Debug</h2>
        <div class="form-row inline">
          <label class="label">Enable logging to Electron console</label>
          <label class="switch">
            <input type="checkbox" v-model="main.debugLoggingEnabled" @change="main.setDebugLoggingEnabled(main.debugLoggingEnabled)" />
            <span class="slider"></span>
          </label>
        </div>
        <div class="hint">Useful for troubleshooting; reduces noise when off.</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 16px;
}
.settings-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
.settings-card {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 16px;
}
.section-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #ddd;
}
.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-row.inline {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
.spaced-row { margin-bottom: 10px; }
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.col { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 13px; color: #bbb; }
.input {
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  padding: 8px 10px;
  color: #fff;
}
.hint { font-size: 12px; color: #999; }

/* Toggle switch */
.switch { position: relative; display: inline-block; width: 44px; height: 24px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255,255,255,0.2); transition: .2s; border-radius: 24px;
}
.slider:before {
  position: absolute; content: ""; height: 18px; width: 18px; left: 3px; top: 3px;
  background: #fff; transition: .2s; border-radius: 50%;
}
.switch input:checked + .slider { background: #3bc47c; }
.switch input:checked + .slider:before { transform: translateX(20px); }

@media (max-width: 700px) {
  .two-col { grid-template-columns: 1fr; }
}
</style>
