<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { getBackupHubApi } from '../api'

type RunRow = Awaited<ReturnType<ReturnType<typeof getBackupHubApi>['listTaskRuns']>>[number]

const runs = ref<RunRow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

function formatWhen(iso: string | null): string {
  if (!iso) {
    return '—'
  }
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function formatDuration(ms: number | null): string {
  if (ms == null) {
    return '—'
  }
  if (ms < 1000) {
    return `${ms} ms`
  }
  return `${(ms / 1000).toFixed(1)} s`
}

function statusClass(status: string): string {
  if (status === 'success' || status === 'dry_run') {
    return 'ok'
  }
  if (status === 'failed' || status === 'cancelled') {
    return 'err'
  }
  return 'warn'
}

async function refresh(): Promise<void> {
  loading.value = true
  try {
    runs.value = await getBackupHubApi().listTaskRuns(150)
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void refresh()
  timer = setInterval(() => {
    void refresh()
  }, 5000)
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
      <h1>Run History</h1>
      <p>Status, duration, size, file counts, and per-run logs.</p>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="btn-row" style="margin-bottom: 1rem">
      <button type="button" class="btn" :disabled="loading" @click="refresh">Refresh</button>
    </div>

    <section class="panel">
      <p v-if="loading && runs.length === 0" class="muted">Loading…</p>
      <p v-else-if="runs.length === 0" class="muted">
        No runs yet. Use <strong>Run now</strong> on a task to queue a backup.
      </p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Task</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Files</th>
            <th>Bytes</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="run in runs" :key="run.id">
            <td>{{ formatWhen(run.startedAt ?? run.createdAt) }}</td>
            <td>
              <strong>{{ run.taskName ?? run.taskId }}</strong>
              <div v-if="run.dryRun" class="muted" style="font-size: 0.85em">dry-run</div>
            </td>
            <td>
              <span class="status-pill" :class="statusClass(run.status)">{{ run.status }}</span>
            </td>
            <td>{{ formatDuration(run.durationMs) }}</td>
            <td>{{ run.fileCount ?? '—' }}</td>
            <td>{{ run.bytesTotal ?? '—' }}</td>
            <td class="msg-cell">{{ run.errorMessage ?? '—' }}</td>
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

.msg-cell {
  max-width: 28rem;
  color: var(--text-muted);
  font-size: 0.88em;
  word-break: break-word;
}
</style>
