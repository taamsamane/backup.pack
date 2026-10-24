<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { RunProgress, TaskRunDto } from '../../../shared/runs'
import { getBackupHubApi } from '../api'
import { useI18n } from '../i18n'

const { t } = useI18n()

const runs = ref<TaskRunDto[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const selectedId = ref<string | null>(null)
const selected = ref<TaskRunDto | null>(null)
const logText = ref('')
const progress = ref<RunProgress | null>(null)
const logEl = ref<HTMLPreElement | null>(null)

let timer: ReturnType<typeof setInterval> | null = null
let unsubProgress: (() => void) | null = null
let unsubLog: (() => void) | null = null

const isLive = computed(() => {
  const s = selected.value?.status
  return s === 'pending' || s === 'running'
})

const progressPercent = computed(() => {
  if (progress.value && progress.value.runId === selectedId.value) {
    return progress.value.percent
  }
  const s = selected.value?.status
  if (s === 'success' || s === 'dry_run' || s === 'failed' || s === 'cancelled') {
    return 100
  }
  if (s === 'running') return 40
  if (s === 'pending') return 5
  return 0
})

const progressPhase = computed(() => {
  if (progress.value && progress.value.runId === selectedId.value) {
    return `${progress.value.phase}: ${progress.value.message}`
  }
  return selected.value?.errorMessage || selected.value?.status || ''
})

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

function formatBytes(n: number | null): string {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function statusClass(status: string): string {
  if (status === 'success' || status === 'dry_run') return 'ok'
  if (status === 'failed' || status === 'cancelled') return 'err'
  return 'warn'
}

async function scrollLogToBottom(): Promise<void> {
  await nextTick()
  if (logEl.value) {
    logEl.value.scrollTop = logEl.value.scrollHeight
  }
}

async function refresh(): Promise<void> {
  loading.value = true
  try {
    runs.value = await getBackupHubApi().listTaskRuns(150)
    error.value = null
    if (selectedId.value) {
      const still = runs.value.find((r) => r.id === selectedId.value)
      if (still) {
        selected.value = still
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function openRun(run: TaskRunDto): Promise<void> {
  selectedId.value = run.id
  selected.value = run
  progress.value = null
  logText.value = 'Loading log…'
  try {
    const api = getBackupHubApi()
    const [detail, log] = await Promise.all([api.getTaskRun(run.id), api.getTaskRunLog(run.id)])
    selected.value = detail
    logText.value = log.content || '(no log output yet)'
    if (detail.latestProgress) {
      progress.value = detail.latestProgress
    }
    await scrollLogToBottom()
  } catch (err) {
    logText.value = err instanceof Error ? err.message : String(err)
  }
}

function closeDetail(): void {
  selectedId.value = null
  selected.value = null
  logText.value = ''
  progress.value = null
}

watch(logText, () => {
  void scrollLogToBottom()
})

onMounted(() => {
  const api = getBackupHubApi()
  unsubProgress = api.onRunProgress((p) => {
    if (p.runId === selectedId.value) {
      progress.value = p
    }
    // Refresh list status when runs finish
    if (p.percent >= 100 || p.status === 'success' || p.status === 'failed' || p.status === 'dry_run') {
      void refresh()
    }
  })
  unsubLog = api.onRunLogLine((ev) => {
    if (ev.runId !== selectedId.value) {
      return
    }
    if (logText.value === 'Loading log…' || logText.value === '(no log output yet)') {
      logText.value = `${ev.line}\n`
    } else {
      logText.value += `${ev.line}\n`
    }
  })
  void refresh()
  timer = setInterval(() => {
    void refresh()
  }, 4000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  unsubProgress?.()
  unsubLog?.()
})
</script>

<template>
  <div>
    <header class="page-header">
      <h1>{{ t('history.title') }}</h1>
      <p>{{ t('history.subtitle') }}</p>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="btn-row" style="margin-bottom: 1rem">
      <button type="button" class="btn" :disabled="loading" @click="refresh">
        {{ t('common.refresh') }}
      </button>
      <button v-if="selectedId" type="button" class="btn" @click="closeDetail">
        {{ t('history.closeDetail') }}
      </button>
    </div>

    <div class="history-layout" :class="{ 'has-detail': Boolean(selectedId) }">
      <section class="panel list-panel">
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
              <th>Size</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="run in runs"
              :key="run.id"
              class="click-row"
              :class="{ selected: run.id === selectedId }"
              @click="openRun(run)"
            >
              <td>{{ formatWhen(run.startedAt ?? run.createdAt) }}</td>
              <td>
                <strong>{{ run.taskName ?? run.taskId }}</strong>
                <div v-if="run.dryRun" class="muted" style="font-size: 0.85em">dry-run</div>
              </td>
              <td>
                <span class="status-pill" :class="statusClass(run.status)">{{ run.status }}</span>
              </td>
              <td>{{ formatDuration(run.durationMs) }}</td>
              <td>{{ formatBytes(run.bytesTotal) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="selected" class="panel detail-panel">
        <div class="detail-header">
          <div>
            <h2>{{ selected.taskName ?? selected.taskId }}</h2>
            <p class="muted">
              {{ formatWhen(selected.startedAt ?? selected.createdAt) }}
              ·
              <span class="status-pill" :class="statusClass(selected.status)">{{
                selected.status
              }}</span>
              <span v-if="isLive" class="live-dot"> live</span>
            </p>
          </div>
        </div>

        <div class="kv-grid">
          <div class="kv">
            <span class="kv-label">Duration</span>
            <span class="kv-value">{{ formatDuration(selected.durationMs) }}</span>
          </div>
          <div class="kv">
            <span class="kv-label">Files</span>
            <span class="kv-value">{{ selected.fileCount ?? '—' }}</span>
          </div>
          <div class="kv">
            <span class="kv-label">Bytes</span>
            <span class="kv-value">{{ formatBytes(selected.bytesTotal) }}</span>
          </div>
          <div class="kv">
            <span class="kv-label">Cycle</span>
            <span class="kv-value mono">{{ selected.cycleId ?? '—' }}</span>
          </div>
        </div>

        <div class="progress-block">
          <div class="progress-meta">
            <span>{{ progressPhase }}</span>
            <span>{{ progressPercent }}%</span>
          </div>
          <div class="progress-track">
            <div
              class="progress-fill"
              :class="{ err: selected.status === 'failed', ok: selected.status === 'success' }"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
        </div>

        <p v-if="selected.errorMessage" class="error-banner">{{ selected.errorMessage }}</p>

        <h3 class="log-title">Log</h3>
        <pre ref="logEl" class="terminal">{{ logText }}</pre>
      </section>
    </div>
  </div>
</template>

<style scoped>
.history-layout {
  display: grid;
  gap: 1rem;
}

.history-layout.has-detail {
  grid-template-columns: minmax(0, 1fr) minmax(320px, 1.1fr);
}

@media (max-width: 1100px) {
  .history-layout.has-detail {
    grid-template-columns: 1fr;
  }
}

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

.click-row {
  cursor: pointer;
}

.click-row:hover {
  background: var(--bg-hover);
}

.click-row.selected {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
}

.detail-header h2 {
  margin: 0 0 0.25rem;
  font-size: 1.15rem;
}

.detail-header p {
  margin: 0;
}

.kv-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin: 1rem 0;
}

.mono {
  font-family: var(--mono);
  font-size: 0.85em;
  word-break: break-all;
}

.progress-block {
  margin: 0.75rem 0 1rem;
}

.progress-meta {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.35rem;
  color: var(--text-muted);
  font-size: 0.88rem;
}

.progress-track {
  height: 10px;
  border-radius: 999px;
  background: var(--bg-hover);
  overflow: hidden;
  border: 1px solid var(--border);
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.25s ease;
}

.progress-fill:not(.ok):not(.err) {
  background-image: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 70%, transparent),
    var(--accent),
    color-mix(in srgb, var(--accent) 70%, transparent)
  );
  background-size: 200% 100%;
  animation: progress-sheen 1.2s linear infinite;
}

@keyframes progress-sheen {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

.progress-fill.ok {
  background: var(--ok);
}

.progress-fill.err {
  background: var(--danger);
}

.live-dot {
  color: var(--warn);
  font-weight: 600;
}

.log-title {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}

.terminal {
  margin: 0;
  padding: 0.85rem 1rem;
  min-height: 220px;
  max-height: 52vh;
  overflow: auto;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: #0b0f14;
  color: #d7e2ec;
  font-family: var(--mono);
  font-size: 0.82rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
