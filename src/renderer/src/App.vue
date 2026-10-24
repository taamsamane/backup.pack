<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { AppSettings } from '../../shared/settings'
import { getBackupHubApi } from './api'
import AppLayout from './components/AppLayout.vue'
import SplashScreen from './components/SplashScreen.vue'
import SshHostKeyDialog from './components/SshHostKeyDialog.vue'
import { applyDocumentLocale, useI18n } from './i18n'
import DashboardScreen from './screens/DashboardScreen.vue'
import DriversScreen from './screens/DriversScreen.vue'
import HistoryScreen from './screens/HistoryScreen.vue'
import ProfilesScreen from './screens/ProfilesScreen.vue'
import RestoreScreen from './screens/RestoreScreen.vue'
import SettingsScreen from './screens/SettingsScreen.vue'
import TasksScreen from './screens/TasksScreen.vue'
import type { ScreenId } from './types'

const { t } = useI18n()
const screen = ref<ScreenId>('dashboard')
const settings = ref<AppSettings | null>(null)
const error = ref<string | null>(null)
const splashReady = ref(false)
const showSplash = ref(true)

function applyTheme(theme: AppSettings['theme']): void {
  const root = document.documentElement
  if (theme === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', theme)
  }
}

function applyLocale(language: string): void {
  applyDocumentLocale(language)
}

onMounted(() => {
  void (async () => {
    try {
      const loaded = await getBackupHubApi().getAllSettings()
      settings.value = loaded
      applyTheme(loaded.theme)
      applyLocale(loaded.language)
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      splashReady.value = true
    }
  })()
})

async function handleSettingsChange(next: AppSettings): Promise<void> {
  settings.value = next
  applyTheme(next.theme)
  applyLocale(next.language)
}
</script>

<template>
  <SplashScreen v-if="showSplash" :ready="splashReady" @done="showSplash = false" />
  <AppLayout :screen="screen" @navigate="screen = $event">
    <SshHostKeyDialog />
    <div v-if="error" class="error-banner">{{ error }}</div>
    <DashboardScreen v-if="screen === 'dashboard'" />
    <ProfilesScreen v-else-if="screen === 'profiles'" />
    <TasksScreen v-else-if="screen === 'tasks'" />
    <HistoryScreen v-else-if="screen === 'history'" />
    <RestoreScreen v-else-if="screen === 'restore'" />
    <DriversScreen v-else-if="screen === 'drivers'" />
    <SettingsScreen
      v-else-if="screen === 'settings' && settings"
      :settings="settings"
      @change="handleSettingsChange"
    />
    <p v-else-if="screen === 'settings' && !settings && !error" class="muted">
      {{ t('app.loadingSettings') }}
    </p>
  </AppLayout>
</template>
