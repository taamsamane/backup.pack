<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type {
  CycleRestoreDto,
  RestoreBrowseResult,
  RestoreVerifyResult
} from '../../../shared/restore'
import { getBackupHubApi } from '../api'

type RestoreTaskOption = {
  id: string
  name: string
  targetFolder: string
  profileName: string | null
}

const tasks = ref<RestoreTaskOption[]>([])
const cycles = ref<CycleRestoreDto[]>([])
const browse = ref<RestoreBrowseResult | null>(null)
const selectedTaskId = ref('')
const selectedCycleId = ref('')
const asOfStamp = ref('')
const loading = ref(true)
const busy = ref(false)
const error = ref<string | null>(null)
const statusMsg = ref<string | null>(null)
const verifyResult = ref<RestoreVerifyResult | null>(null)

const selectedCycle = computed(
  () => cycles.value.find((c) => c.id === selectedCycleId.value) ?? null
)

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function formatBytes(n: number | null): string {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

async function loadTasks(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    tasks.value = await getBackupHubApi().listRestoreTasks()
    if (!selectedTaskId.value && tasks.value[0]) {
      selectedTaskId.value = tasks.value[0].id
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function loadCycles(): Promise<void> {
  cycles.value = []
  browse.value = null
  selectedCycleId.value = ''
  verifyResult.value = null
  if (!selectedTaskId.value) return
  busy.value = true
  error.value = null
  try {
    cycles.value = await getBackupHubApi().listRestoreCycles(selectedTaskId.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

async function loadBrowse(): Promise<void> {
  browse.value = null
  if (!selectedCycleId.value) return
  busy.value = true
  error.value = null
  statusMsg.value = null
  try {
    browse.value = await getBackupHubApi().browseRestoreCycle(
      selectedCycleId.value,
      asOfStamp.value || undefined
    )
    if (browse.value.materializedFromArchive) {
      statusMsg.value = 'Cycle was unzipped from archive for browsing.'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

async function onRestore(): Promise<void> {
  if (!selectedCycleId.value) return
  statusMsg.value = null
  error.value = null
  const picked = await getBackupHubApi().pickDirectory()
  if (!picked.path) return
  busy.value = true
  try {
    const result = await getBackupHubApi().restoreCycleFiles({
      cycleId: selectedCycleId.value,
      destPath: picked.path,
      asOfStamp: asOfStamp.value || undefined
    })
    statusMsg.value = `Restored ${result.fileCount} file(s) (${formatBytes(result.bytesTotal)}) to ${result.destPath}`
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

async function onVerify(): Promise<void> {
  if (!selectedCycleId.value) return
  verifyResult.value = null
  error.value = null
  busy.value = true
  try {
    verifyResult.value = await getBackupHubApi().verifyRestoreArchive(selectedCycleId.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

watch(selectedTaskId, () => {
  void loadCycles()
})

watch(selectedCycleId, () => {
  asOfStamp.value = ''
  verifyResult.value = null
  if (selectedCycleId.value) {
    void loadBrowse()
  } else {
    browse.value = null
  }
})

watch(asOfStamp, () => {
  if (selectedCycleId.value) {
    void loadBrowse()
  }
})

onMounted(() => {
  void loadTasks()
})
</script>

<template>
  <div>
    <header class="page-header">
      <h1>Restore</h1>
      <p>
        Browse cycles, restore files to a folder at a point in time, and verify archive zips.
        Database dumps are restored as files (import into a live server is not automated yet).
      </p>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>
    <div v-if="statusMsg" class="ok-banner">{{ statusMsg }}</div>

    <section class="panel">
      <div class="form-grid">
        <label class="field">
          <span>Task</span>
          <select v-model="selectedTaskId" :disabled="loading || tasks.length === 0">
            <option disabled value="">Select a task…</option>
            <option v-for="t in tasks" :key="t.id" :value="t.id">
              {{ t.name }}{{ t.profileName ? ` (${t.profileName})` : '' }}
            </option>
          </select>
        </label>

        <label class="field">
          <span>Cycle</span>
          <select v-model="selectedCycleId" :disabled="busy || cycles.length === 0">
            <option disabled value="">Select a cycle…</option>
            <option v-for="c in cycles" :key="c.id" :value="c.id">
              {{ c.folderName }} · {{ c.status }} · {{ formatWhen(c.startedAt) }}
            </option>
          </select>
        </label>

        <label class="field">
          <span>Point in time (change stamp)</span>
          <select v-model="asOfStamp" :disabled="!browse">
            <option value="">Latest (baseline + all changes)</option>
            <option v-for="stamp in browse?.changeStamps ?? []" :key="stamp" :value="stamp">
              {{ stamp }}
            </option>
          </select>
        </label>
      </div>

      <div v-if="selectedCycle" class="cycle-meta muted">
        <span>Status: {{ selectedCycle.status }}</span>
        <span v-if="selectedCycle.hasUnzippedCycle"> · on disk</span>
        <span v-if="selectedCycle.hasArchive"> · archive available</span>
        <span v-else> · no archive</span>
      </div>

      <div class="btn-row" style="margin-top: 1rem">
        <button
          type="button"
          class="btn primary"
          :disabled="!selectedCycleId || busy"
          @click="onRestore"
        >
          Restore to folder…
        </button>
        <button
          type="button"
          class="btn"
          :disabled="!selectedCycleId || busy || !selectedCycle?.hasArchive"
          @click="onVerify"
        >
          Verify archive
        </button>
        <button type="button" class="btn" :disabled="busy" @click="loadBrowse">
          Refresh browse
        </button>
      </div>

      <div v-if="verifyResult" class="verify-box" :class="verifyResult.ok ? 'ok' : 'err'">
        <strong>{{ verifyResult.ok ? 'Archive OK' : 'Archive check failed' }}</strong>
        <div class="muted">
          {{ verifyResult.archivePath ?? '—' }} ·
          {{ formatBytes(verifyResult.bytes) }} ·
          {{ verifyResult.entryCount ?? '—' }} entries
        </div>
        <ul v-if="verifyResult.errors.length">
          <li v-for="(e, i) in verifyResult.errors" :key="i">{{ e }}</li>
        </ul>
      </div>
    </section>

    <section v-if="browse" class="panel" style="margin-top: 1rem">
      <h2 class="section-title">
        Files at {{ asOfStamp || 'latest' }}
        <span class="muted">({{ browse.entries.length }})</span>
      </h2>
      <p v-if="browse.deletedPaths.length" class="muted" style="margin-top: 0">
        Deleted since baseline ({{ browse.deletedPaths.length }}):
        {{ browse.deletedPaths.slice(0, 8).join(', ')
        }}{{ browse.deletedPaths.length > 8 ? '…' : '' }}
      </p>
      <p v-if="browse.entries.length === 0" class="muted">No files at this point in time.</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Path</th>
            <th>Size</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in browse.entries" :key="entry.path">
            <td class="mono">{{ entry.path }}</td>
            <td>{{ formatBytes(entry.size) }}</td>
            <td>
              <span v-if="entry.source === 'baseline'">baseline</span>
              <span v-else>changes/{{ entry.changeStamp }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <p v-else-if="!loading && tasks.length === 0" class="muted panel">
      Create a backup task and run it first — restore needs cycles on disk or in archives.
    </p>
  </div>
</template>

<style scoped>
.form-grid {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
}

.field span {
  color: var(--text-muted);
  font-weight: 600;
}

.cycle-meta {
  margin-top: 0.75rem;
  font-size: 0.9rem;
}

.section-title {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.data-table th,
.data-table td {
  text-align: left;
  padding: 0.55rem 0.4rem;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

.data-table th {
  color: var(--text-muted);
}

.mono {
  font-family: var(--mono);
  font-size: 0.85em;
  word-break: break-all;
}

.verify-box {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
}

.verify-box.ok {
  border-color: color-mix(in srgb, var(--ok) 45%, var(--border));
  background: color-mix(in srgb, var(--ok) 12%, transparent);
}

.verify-box.err {
  border-color: color-mix(in srgb, var(--danger) 45%, var(--border));
  background: color-mix(in srgb, var(--danger) 12%, transparent);
}

.verify-box ul {
  margin: 0.5rem 0 0;
  padding-left: 1.2rem;
}
</style>
