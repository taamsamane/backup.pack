<script setup lang="ts">
import { getBackupHubApi } from '../api'
import type { ScreenId } from '../types'

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
  { id: 'drivers', label: 'Drivers' },
  { id: 'settings', label: 'Settings' }
]

function hideToTray(): void {
  void getBackupHubApi().hideToTray()
}
</script>

<template>
  <div class="app-shell">
    <nav class="nav" aria-label="Primary">
      <div class="brand">
        <span class="brand-name">BackupHub</span>
        <span class="brand-tag">Scheduled backups</span>
      </div>
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
      <div class="nav-spacer" />
      <button type="button" class="nav-button" @click="hideToTray">Hide to tray</button>
    </nav>
    <main class="content">
      <slot />
    </main>
  </div>
</template>
