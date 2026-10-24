<script setup lang="ts">
import { computed } from 'vue'
import { getBackupHubApi } from '../api'
import { useI18n } from '../i18n'
import type { ScreenId } from '../types'
import logoIcon from '../assets/logo-icon.png'

defineProps<{
  screen: ScreenId
}>()

const emit = defineEmits<{
  navigate: [screen: ScreenId]
}>()

const { t, locale } = useI18n()

const navItems = computed(() => {
  // locale dependency so labels refresh when language changes
  void locale.value
  return [
    { id: 'dashboard' as const, label: t('nav.dashboard') },
    { id: 'profiles' as const, label: t('nav.profiles') },
    { id: 'tasks' as const, label: t('nav.tasks') },
    { id: 'history' as const, label: t('nav.history') },
    { id: 'restore' as const, label: t('nav.restore') },
    { id: 'drivers' as const, label: t('nav.drivers') }
  ]
})

function hideToTray(): void {
  void getBackupHubApi().hideToTray()
}
</script>

<template>
  <div class="app-shell">
    <nav class="nav" :aria-label="t('nav.primary')">
      <div class="brand">
        <img class="brand-logo" :src="logoIcon" alt="backup.pack" width="128" height="128" />
      </div>
      <div class="nav-main">
        <button
          v-for="item in navItems"
          :key="item.id"
          type="button"
          class="nav-button"
          :class="{ active: screen === item.id }"
          @click="emit('navigate', item.id)"
        >
          {{ item.label }}
        </button>
      </div>
      <div class="nav-footer">
        <button
          type="button"
          class="nav-button"
          :class="{ active: screen === 'settings' }"
          @click="emit('navigate', 'settings')"
        >
          {{ t('nav.settings') }}
        </button>
        <button type="button" class="nav-button" @click="hideToTray">
          {{ t('nav.hideToTray') }}
        </button>
      </div>
    </nav>
    <main class="content">
      <slot />
    </main>
  </div>
</template>
