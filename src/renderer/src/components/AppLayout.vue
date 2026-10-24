<script setup lang="ts">
import { getBackupHubApi } from '../api'
import type { ScreenId } from '../types'
import logo from '../assets/logo.png'

defineProps<{
  screen: ScreenId
}>()

const emit = defineEmits<{
  navigate: [screen: ScreenId]
}>()

const navItems: Array<{ id: ScreenId; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'profiles', label: 'Connection Profiles' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'history', label: 'Run History' },
  { id: 'restore', label: 'Restore' },
  { id: 'drivers', label: 'Drivers' }
]

function hideToTray(): void {
  void getBackupHubApi().hideToTray()
}
</script>

<template>
  <div class="app-shell">
    <nav class="nav" aria-label="Primary">
      <div class="brand">
        <img class="brand-logo" :src="logo" alt="backup.pack" width="168" height="118" />
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
          Settings
        </button>
        <button type="button" class="nav-button" @click="hideToTray">Hide to tray</button>
      </div>
    </nav>
    <main class="content">
      <slot />
    </main>
  </div>
</template>
