<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { DriverStatus, DriverToolId } from '../../../shared/drivers'
import type { DriverInstallProgress } from '../../../shared/ipc/api'
import { getBackupHubApi } from '../api'

const drivers = ref<DriverStatus[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const installing = ref<DriverToolId | null>(null)
const progress = ref<DriverInstallProgress | null>(null)
let unsubscribe: (() => void) | null = null

async function refresh(): Promise<void> {
  loading.value = true
  try {
    drivers.value = await getBackupHubApi().listDrivers()
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function install(toolId: DriverToolId): Promise<void> {
  installing.value = toolId
  progress.value = null
  error.value = null
  try {
    await getBackupHubApi().installDriver(toolId)
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    installing.value = null
    progress.value = null
  }
}

function formatBytes(n: number | null | undefined): string {
  if (n == null || n <= 0) {
    return '—'
  }
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function progressLabel(): string {
  const p = progress.value
  if (!p) return ''
  if (p.phase === 'extract') return 'Extracting…'
  if (p.phase === 'done') return 'Done'
  const total = p.totalBytes
  if (total && total > 0) {
    const pct = Math.min(100, Math.round((p.receivedBytes / total) * 100))
    return `Downloading ${pct}% (${formatBytes(p.receivedBytes)} / ${formatBytes(total)})`
  }
  return `Downloading ${formatBytes(p.receivedBytes)}…`
}

onMounted(() => {
  unsubscribe = getBackupHubApi().onDriverProgress((p) => {
    progress.value = p
  })
  void refresh()
})

onUnmounted(() => {
  unsubscribe?.()
})
</script>

<template>
  <div>
    <header class="page-header">
      <h1>Drivers</h1>
      <p>
        Download CLI tools from
        <code>drivers.taam.shop</code> into userData/drivers (SHA-256 recorded on install).
      </p>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="btn-row" style="margin-bottom: 1rem">
      <button type="button" class="btn" :disabled="loading || Boolean(installing)" @click="refresh">
        Refresh
      </button>
    </div>

    <p v-if="installing && progress" class="phase-note">{{ progressLabel() }}</p>

    <section class="panel">
      <p v-if="loading" class="muted">Loading…</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Tool</th>
            <th>Version</th>
            <th>Status</th>
            <th>Binaries</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in drivers" :key="d.toolId">
            <td>
              <strong>{{ d.name }}</strong>
              <div class="muted" style="font-size: 0.85em">{{ d.toolId }}</div>
            </td>
            <td>{{ d.version }}</td>
            <td>
              <span
                v-if="!d.availableForPlatform"
                class="status-pill err"
              >Unavailable on {{ d.platform }}</span>
              <span
                v-else
                class="status-pill"
                :class="d.installed ? 'ok' : 'warn'"
              >
                {{ d.installed ? 'Installed' : 'Not installed' }}
              </span>
            </td>
            <td class="mono-cell">
              <div v-for="b in d.binaries" :key="b.name">
                {{ b.found ? '✓' : '✗' }} {{ b.name }}
              </div>
              <span v-if="d.binaries.length === 0" class="muted">—</span>
            </td>
            <td>
              <button
                type="button"
                class="btn btn-primary"
                :disabled="!d.availableForPlatform || Boolean(installing)"
                @click="install(d.toolId)"
              >
                {{
                  installing === d.toolId
                    ? 'Installing…'
                    : d.installed
                      ? 'Reinstall'
                      : 'Install'
                }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
}

.data-table th,
.data-table td {
  text-align: left;
  padding: 0.65rem 0.5rem;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

.data-table th {
  color: var(--text-muted);
  font-weight: 600;
}

.mono-cell {
  font-family: var(--mono);
  font-size: 0.85em;
}
</style>
