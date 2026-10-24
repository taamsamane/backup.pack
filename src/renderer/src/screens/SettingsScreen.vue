<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { AppSettings, Language, LogLevel, Theme } from '../../../shared/settings'
import type { UpdateStatus } from '../../../shared/updates'
import { getBackupHubApi } from '../api'
import { useI18n } from '../i18n'

defineProps<{
  settings: AppSettings
}>()

const emit = defineEmits<{
  change: [settings: AppSettings]
}>()

const { t } = useI18n()
const busy = ref(false)
const message = ref<string | null>(null)
const error = ref<string | null>(null)
const updateStatus = ref<UpdateStatus | null>(null)
let unsubUpdate: (() => void) | null = null

async function update(patch: Partial<AppSettings>): Promise<void> {
  busy.value = true
  error.value = null
  message.value = null
  try {
    const next = await getBackupHubApi().setSettings(patch)
    emit('change', next)
    message.value = t('settings.saved')
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
  void update({ language: (event.target as HTMLSelectElement).value as Language })
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

async function checkUpdates(): Promise<void> {
  busy.value = true
  error.value = null
  try {
    updateStatus.value = await getBackupHubApi().checkForUpdates()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

async function downloadUpdate(): Promise<void> {
  busy.value = true
  try {
    updateStatus.value = await getBackupHubApi().downloadUpdate()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

async function quitAndInstall(): Promise<void> {
  await getBackupHubApi().quitAndInstallUpdate()
}

onMounted(() => {
  const api = getBackupHubApi()
  void api.getUpdateStatus().then((s) => {
    updateStatus.value = s
  })
  unsubUpdate = api.onUpdateStatus((s) => {
    updateStatus.value = s
  })
})

onUnmounted(() => {
  unsubUpdate?.()
})
</script>

<template>
  <div>
    <header class="page-header">
      <h1>{{ t('settings.title') }}</h1>
      <p>{{ t('settings.subtitle') }}</p>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>
    <p v-if="message" class="muted">{{ message }}</p>

    <section class="panel">
      <h2>{{ t('settings.appearance') }}</h2>
      <div class="form-row">
        <label>
          <span>{{ t('settings.theme') }}</span>
          <span class="hint">{{ t('settings.themeHint') }}</span>
        </label>
        <select :value="settings.theme" :disabled="busy" @change="onTheme">
          <option value="system">{{ t('settings.themeSystem') }}</option>
          <option value="light">{{ t('settings.themeLight') }}</option>
          <option value="dark">{{ t('settings.themeDark') }}</option>
        </select>
      </div>
      <div class="form-row">
        <label>
          <span>{{ t('settings.language') }}</span>
          <span class="hint">{{ t('settings.languageHint') }}</span>
        </label>
        <select :value="settings.language" :disabled="busy" @change="onLanguage">
          <option value="en">{{ t('settings.langEn') }}</option>
          <option value="fa">{{ t('settings.langFa') }}</option>
        </select>
      </div>
    </section>

    <section class="panel">
      <h2>{{ t('settings.windowStartup') }}</h2>
      <div class="form-row">
        <label>
          <span>{{ t('settings.closeToTray') }}</span>
          <span class="hint">{{ t('settings.closeToTrayHint') }}</span>
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
          <span>{{ t('settings.minimizeToTray') }}</span>
          <span class="hint">{{ t('settings.minimizeToTrayHint') }}</span>
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
          <span>{{ t('settings.launchOnLogin') }}</span>
          <span class="hint">{{ t('settings.launchOnLoginHint') }}</span>
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
      <h2>{{ t('settings.notifications') }}</h2>
      <div class="form-row">
        <label>
          <span>{{ t('settings.notifySuccess') }}</span>
          <span class="hint">{{ t('settings.notifySuccessHint') }}</span>
        </label>
        <input
          type="checkbox"
          :checked="settings.notifyOnSuccess"
          :disabled="busy"
          @change="update({ notifyOnSuccess: ($event.target as HTMLInputElement).checked })"
        />
      </div>
      <div class="form-row">
        <label>
          <span>{{ t('settings.notifyFailure') }}</span>
          <span class="hint">{{ t('settings.notifyFailureHint') }}</span>
        </label>
        <input
          type="checkbox"
          :checked="settings.notifyOnFailure"
          :disabled="busy"
          @change="update({ notifyOnFailure: ($event.target as HTMLInputElement).checked })"
        />
      </div>
    </section>

    <section class="panel">
      <h2>{{ t('settings.updates') }}</h2>
      <div class="form-row">
        <label>
          <span>{{ t('settings.checkOnStartup') }}</span>
          <span class="hint">{{ t('settings.checkOnStartupHint') }}</span>
        </label>
        <input
          type="checkbox"
          :checked="settings.checkUpdatesOnStartup"
          :disabled="busy"
          @change="update({ checkUpdatesOnStartup: ($event.target as HTMLInputElement).checked })"
        />
      </div>
      <p v-if="updateStatus" class="muted" style="margin: 0.5rem 0 0.75rem">
        {{ updateStatus.message || updateStatus.state }}
        <span v-if="updateStatus.progressPercent != null">
          ({{ updateStatus.progressPercent }}%)</span
        >
      </p>
      <div class="btn-row">
        <button type="button" class="btn" :disabled="busy" @click="checkUpdates">
          {{ t('settings.checkForUpdates') }}
        </button>
        <button
          type="button"
          class="btn"
          :disabled="busy || updateStatus?.state !== 'available'"
          @click="downloadUpdate"
        >
          {{ t('settings.downloadUpdate') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="updateStatus?.state !== 'downloaded'"
          @click="quitAndInstall"
        >
          {{ t('settings.restartInstall') }}
        </button>
      </div>
    </section>

    <section class="panel">
      <h2>{{ t('settings.runtime') }}</h2>
      <div class="form-row">
        <label>
          <span>{{ t('settings.concurrency') }}</span>
          <span class="hint">{{ t('settings.concurrencyHint') }}</span>
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
          <span>{{ t('settings.logLevel') }}</span>
          <span class="hint">{{ t('settings.logLevelHint') }}</span>
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
      <button type="button" class="btn" @click="hideToTray">{{ t('nav.hideToTray') }}</button>
      <button type="button" class="btn btn-primary" @click="quitApp">{{ t('settings.quit') }}</button>
    </div>
  </div>
</template>
