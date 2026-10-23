<script setup lang="ts">
import { ref } from 'vue'
import type { AppSettings, LogLevel, Theme } from '../../../shared/settings'
import { getBackupHubApi } from '../api'

defineProps<{
  settings: AppSettings
}>()

const emit = defineEmits<{
  change: [settings: AppSettings]
}>()

const busy = ref(false)
const message = ref<string | null>(null)
const error = ref<string | null>(null)

async function update(patch: Partial<AppSettings>): Promise<void> {
  busy.value = true
  error.value = null
  message.value = null
  try {
    const next = await getBackupHubApi().setSettings(patch)
    emit('change', next)
    message.value = 'Settings saved.'
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

function onTheme(event: Event): void {
  void update({ theme: (event.target as HTMLSelectElement).value as Theme })
}

function onLanguage(event: Event): void {
  void update({ language: (event.target as HTMLSelectElement).value })
}

function onConcurrency(event: Event): void {
  void update({
    globalConcurrency: Number.parseInt((event.target as HTMLInputElement).value, 10) || 1
  })
}

function onLogLevel(event: Event): void {
  void update({ logLevel: (event.target as HTMLSelectElement).value as LogLevel })
}

function hideToTray(): void {
  void getBackupHubApi().hideToTray()
}

function quitApp(): void {
  void getBackupHubApi().quit()
}
</script>

<template>
  <div>
    <header class="page-header">
      <h1>Settings</h1>
      <p>Tray behavior, appearance, and runtime defaults.</p>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>
    <p v-if="message" class="muted">{{ message }}</p>

    <section class="panel">
      <h2>Appearance</h2>
      <div class="form-row">
        <label>
          <span>Theme</span>
          <span class="hint">Follow system or force light/dark</span>
        </label>
        <select :value="settings.theme" :disabled="busy" @change="onTheme">
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <div class="form-row">
        <label>
          <span>Language</span>
          <span class="hint">UI language code (more locales in later phases)</span>
        </label>
        <select :value="settings.language" :disabled="busy" @change="onLanguage">
          <option value="en">English</option>
        </select>
      </div>
    </section>

    <section class="panel">
      <h2>Window &amp; startup</h2>
      <div class="form-row">
        <label>
          <span>Close to tray</span>
          <span class="hint">Keep schedules running when the window is closed</span>
        </label>
        <input
          type="checkbox"
          :checked="settings.closeToTray"
          :disabled="busy"
          @change="update({ closeToTray: ($event.target as HTMLInputElement).checked })"
        />
      </div>
      <div class="form-row">
        <label>
          <span>Minimize to tray</span>
          <span class="hint">Prefer tray over taskbar when hiding</span>
        </label>
        <input
          type="checkbox"
          :checked="settings.minimizeToTray"
          :disabled="busy"
          @change="update({ minimizeToTray: ($event.target as HTMLInputElement).checked })"
        />
      </div>
      <div class="form-row">
        <label>
          <span>Launch on login</span>
          <span class="hint">Windows/macOS login item (Linux support later)</span>
        </label>
        <input
          type="checkbox"
          :checked="settings.launchOnLogin"
          :disabled="busy"
          @change="update({ launchOnLogin: ($event.target as HTMLInputElement).checked })"
        />
      </div>
    </section>

    <section class="panel">
      <h2>Runtime</h2>
      <div class="form-row">
        <label>
          <span>Global backup concurrency</span>
          <span class="hint">Max simultaneous backup runs (used from Phase 4)</span>
        </label>
        <input
          type="number"
          min="1"
          max="16"
          :value="settings.globalConcurrency"
          :disabled="busy"
          @change="onConcurrency"
        />
      </div>
      <div class="form-row">
        <label>
          <span>Log level</span>
          <span class="hint">Rotating logs under the app userData folder</span>
        </label>
        <select :value="settings.logLevel" :disabled="busy" @change="onLogLevel">
          <option value="fatal">fatal</option>
          <option value="error">error</option>
          <option value="warn">warn</option>
          <option value="info">info</option>
          <option value="debug">debug</option>
          <option value="trace">trace</option>
        </select>
      </div>
    </section>

    <div class="btn-row">
      <button type="button" class="btn" @click="hideToTray">Hide to tray</button>
      <button type="button" class="btn btn-primary" @click="quitApp">Quit BackupHub</button>
    </div>
  </div>
</template>
