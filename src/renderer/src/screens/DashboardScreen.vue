<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { AppInfo, AppPaths, DbHealth } from '../../../shared/ipc/schemas'
import type { DashboardScheduleItem } from '../../../shared/tasks'
import { getBackupHubApi } from '../api'

const info = ref<AppInfo | null>(null)
const paths = ref<AppPaths | null>(null)
const health = ref<DbHealth | null>(null)
const upcoming = ref<DashboardScheduleItem[]>([])
const error = ref<string | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

async function load(): Promise<void> {
  try {
    const api = getBackupHubApi()
    const [appInfo, appPaths, dbHealth, upcomingRuns] = await Promise.all([
      api.getAppInfo(),
      api.getAppPaths(),
      api.getDbHealth(),
      api.listUpcomingRuns(15)
    ])
    info.value = appInfo
    paths.value = appPaths
    health.value = dbHealth
    upcoming.value = upcomingRuns
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

onMounted(() => {
  void load()
  timer = setInterval(() => {
    void load()
  }, 30_000)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<template>
  <div>
    <header class="page-header">
      <h1>Dashboard</h1>
      <p>Local app status, database health, and upcoming runs.</p>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <section class="panel">
      <h2>Application</h2>
      <div v-if="info" class="grid-2">
        <div class="kv">
          <span class="kv-label">Version</span>
          <span class="kv-value">{{ info.version }}</span>
        </div>
        <div class="kv">
          <span class="kv-label">Platform</span>
          <span class="kv-value">{{ info.platform }}/{{ info.arch }}</span>
        </div>
        <div class="kv">
          <span class="kv-label">Electron</span>
          <span class="kv-value">{{ info.electron }}</span>
        </div>
        <div class="kv">
          <span class="kv-label">Node</span>
          <span class="kv-value">{{ info.node }}</span>
        </div>
      </div>
      <p v-else class="muted">Loading…</p>
    </section>

    <section class="panel">
      <h2>SQLite</h2>
      <template v-if="health">
        <p>
          <span class="status-pill" :class="health.ok ? 'ok' : 'err'">
            {{ health.ok ? 'Healthy' : 'Unhealthy' }}
          </span>
        </p>
        <div class="grid-2" style="margin-top: 0.85rem">
          <div class="kv">
            <span class="kv-label">Schema</span>
            <span class="kv-value">{{ health.schemaVersion ?? 'none' }}</span>
          </div>
          <div class="kv">
            <span class="kv-label">Migrations</span>
            <span class="kv-value">{{ health.migrationCount }}</span>
          </div>
          <div class="kv">
            <span class="kv-label">Profiles</span>
            <span class="kv-value">{{ health.tableCounts.profiles ?? 0 }}</span>
          </div>
          <div class="kv">
            <span class="kv-label">Tasks</span>
            <span class="kv-value">{{ health.tableCounts.tasks ?? 0 }}</span>
          </div>
        </div>
      </template>
      <p v-else class="muted">Loading…</p>
    </section>

    <section class="panel">
      <h2>Paths</h2>
      <div v-if="paths" class="grid-2">
        <div class="kv">
          <span class="kv-label">User data</span>
          <span class="kv-value">{{ paths.userData }}</span>
        </div>
        <div class="kv">
          <span class="kv-label">Database</span>
          <span class="kv-value">{{ paths.database }}</span>
        </div>
        <div class="kv">
          <span class="kv-label">Logs</span>
          <span class="kv-value">{{ paths.logs }}</span>
        </div>
        <div class="kv">
          <span class="kv-label">Drivers</span>
          <span class="kv-value">{{ paths.drivers }}</span>
        </div>
      </div>
      <p v-else class="muted">Loading…</p>
    </section>

    <section class="panel">
      <h2>Next scheduled runs</h2>
      <p v-if="upcoming.length === 0" class="muted">
        No enabled tasks scheduled. Create a task to see upcoming runs.
      </p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Next run</th>
            <th>Last status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in upcoming" :key="item.taskId">
            <td>
              <strong>{{ item.taskName }}</strong>
            </td>
            <td>{{ formatWhen(item.nextRunAt) }}</td>
            <td>{{ item.lastStatus ?? '—' }}</td>
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
}

.data-table th {
  color: var(--text-muted);
  font-weight: 600;
}
</style>
