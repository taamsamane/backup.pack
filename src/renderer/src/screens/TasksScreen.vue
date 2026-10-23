<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { ProfileDto } from '../../../shared/profiles'
import type {
  ScheduleMode,
  SchedulePreview,
  TaskBackupSettings,
  TaskCreateInput,
  TaskDto,
  TaskSchedule
} from '../../../shared/tasks'
import { getBackupHubApi } from '../api'

const tasks = ref<TaskDto[]>([])
const profiles = ref<ProfileDto[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const showWizard = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const step = ref(1)
const preview = ref<SchedulePreview | null>(null)
const previewError = ref<string | null>(null)

const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' }
]

const form = reactive({
  name: '',
  profileId: '',
  targetFolder: '',
  enabled: true,
  catchUpMissed: false,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  mode: 'daily' as ScheduleMode,
  everyValue: 15,
  everyUnit: 'minute' as 'minute' | 'hour',
  hour: 2,
  minute: 0,
  daysOfWeek: [1, 2, 3, 4, 5] as number[],
  dayOfMonth: 1,
  cronExpression: '0 2 * * *',
  fullBackup: true,
  useFullPeriod: false,
  fullPeriodValue: 7,
  fullPeriodUnit: 'day' as 'day' | 'week' | 'month',
  compress: true,
  encryptArchive: false,
  archivePassword: '',
  clearArchivePassword: false,
  excludePatternsText: '',
  keepCycles: 4,
  useRetention: true
})

const hasArchivePassword = ref(false)

const scheduleModes: Array<{ value: ScheduleMode; label: string }> = [
  { value: 'every', label: 'Every N minutes/hours' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'cron', label: 'Custom cron' }
]

function buildSchedule(): TaskSchedule {
  const base: TaskSchedule = {
    timezone: form.timezone.trim() || 'UTC',
    mode: form.mode,
    cronExpression: form.cronExpression
  }
  if (form.mode === 'every') {
    return { ...base, everyValue: form.everyValue, everyUnit: form.everyUnit }
  }
  if (form.mode === 'daily') {
    return { ...base, hour: form.hour, minute: form.minute }
  }
  if (form.mode === 'weekly') {
    return {
      ...base,
      hour: form.hour,
      minute: form.minute,
      daysOfWeek: [...form.daysOfWeek].sort((a, b) => a - b)
    }
  }
  if (form.mode === 'monthly') {
    return {
      ...base,
      hour: form.hour,
      minute: form.minute,
      dayOfMonth: form.dayOfMonth
    }
  }
  return base
}

function buildSettings(): TaskBackupSettings {
  const settings: TaskBackupSettings = {
    fullBackup: form.fullBackup,
    compress: form.compress,
    encryptArchive: form.encryptArchive,
    excludePatterns: form.excludePatternsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }
  if (form.fullBackup && form.useFullPeriod) {
    settings.fullPeriod = {
      value: form.fullPeriodValue,
      unit: form.fullPeriodUnit
    }
  }
  if (form.useRetention) {
    settings.retention = { keepCycles: form.keepCycles }
  }
  return settings
}

function resetForm(): void {
  editingId.value = null
  step.value = 1
  preview.value = null
  previewError.value = null
  hasArchivePassword.value = false
  form.name = ''
  form.profileId = profiles.value[0]?.id ?? ''
  form.targetFolder = ''
  form.enabled = true
  form.catchUpMissed = false
  form.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  form.mode = 'daily'
  form.everyValue = 15
  form.everyUnit = 'minute'
  form.hour = 2
  form.minute = 0
  form.daysOfWeek = [1, 2, 3, 4, 5]
  form.dayOfMonth = 1
  form.cronExpression = '0 2 * * *'
  form.fullBackup = true
  form.useFullPeriod = false
  form.fullPeriodValue = 7
  form.fullPeriodUnit = 'day'
  form.compress = true
  form.encryptArchive = false
  form.archivePassword = ''
  form.clearArchivePassword = false
  form.excludePatternsText = ''
  form.keepCycles = 4
  form.useRetention = true
}

function loadTaskIntoForm(task: TaskDto): void {
  editingId.value = task.id
  step.value = 1
  hasArchivePassword.value = task.hasArchivePassword
  form.name = task.name
  form.profileId = task.profileId
  form.targetFolder = task.targetFolder
  form.enabled = task.enabled
  form.catchUpMissed = task.catchUpMissed
  form.timezone = task.schedule.timezone
  form.mode = task.schedule.mode
  form.everyValue = task.schedule.everyValue ?? 15
  form.everyUnit = task.schedule.everyUnit ?? 'minute'
  form.hour = task.schedule.hour ?? 2
  form.minute = task.schedule.minute ?? 0
  form.daysOfWeek = task.schedule.daysOfWeek ? [...task.schedule.daysOfWeek] : [1]
  form.dayOfMonth = task.schedule.dayOfMonth ?? 1
  form.cronExpression = task.schedule.cronExpression
  form.fullBackup = task.settings.fullBackup
  form.useFullPeriod = Boolean(task.settings.fullPeriod)
  form.fullPeriodValue = task.settings.fullPeriod?.value ?? 7
  form.fullPeriodUnit = task.settings.fullPeriod?.unit ?? 'day'
  form.compress = task.settings.compress
  form.encryptArchive = task.settings.encryptArchive
  form.archivePassword = ''
  form.clearArchivePassword = false
  form.excludePatternsText = (task.settings.excludePatterns ?? []).join('\n')
  form.useRetention = Boolean(task.settings.retention)
  form.keepCycles = task.settings.retention?.keepCycles ?? 4
}

async function refresh(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const api = getBackupHubApi()
    const [taskList, profileList] = await Promise.all([api.listTasks(), api.listProfiles()])
    tasks.value = taskList
    profiles.value = profileList
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void refresh()
})

watch(
  () => [
    form.mode,
    form.timezone,
    form.everyValue,
    form.everyUnit,
    form.hour,
    form.minute,
    form.daysOfWeek.join(','),
    form.dayOfMonth,
    form.cronExpression
  ],
  () => {
    if (showWizard.value && step.value >= 2) {
      void refreshPreview()
    }
  }
)

async function refreshPreview(): Promise<void> {
  previewError.value = null
  try {
    preview.value = await getBackupHubApi().previewSchedule(buildSchedule(), 5)
  } catch (err) {
    preview.value = null
    previewError.value = err instanceof Error ? err.message : String(err)
  }
}

async function pickFolder(): Promise<void> {
  const result = await getBackupHubApi().pickDirectory()
  if (result.path) {
    form.targetFolder = result.path
  }
}

function toggleWeekday(day: number): void {
  const idx = form.daysOfWeek.indexOf(day)
  if (idx >= 0) {
    if (form.daysOfWeek.length === 1) {
      return
    }
    form.daysOfWeek.splice(idx, 1)
  } else {
    form.daysOfWeek.push(day)
  }
}

function openCreate(): void {
  resetForm()
  showWizard.value = true
  void refreshPreview()
}

function openEdit(task: TaskDto): void {
  loadTaskIntoForm(task)
  showWizard.value = true
  void refreshPreview()
}

async function save(): Promise<void> {
  saving.value = true
  error.value = null
  try {
    const api = getBackupHubApi()
    const settings = buildSettings()
    const schedule = buildSchedule()

    if (editingId.value) {
      await api.updateTask({
        id: editingId.value,
        name: form.name.trim(),
        profileId: form.profileId,
        targetFolder: form.targetFolder.trim(),
        schedule,
        settings,
        enabled: form.enabled,
        catchUpMissed: form.catchUpMissed,
        archivePassword: form.archivePassword || undefined,
        clearArchivePassword: form.clearArchivePassword || undefined
      })
    } else {
      const input: TaskCreateInput = {
        name: form.name.trim(),
        profileId: form.profileId,
        targetFolder: form.targetFolder.trim(),
        schedule,
        settings,
        enabled: form.enabled,
        catchUpMissed: form.catchUpMissed,
        archivePassword: form.archivePassword || undefined
      }
      await api.createTask(input)
    }
    showWizard.value = false
    resetForm()
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}

async function removeTask(task: TaskDto): Promise<void> {
  if (!confirm(`Delete task “${task.name}”?`)) {
    return
  }
  try {
    await getBackupHubApi().deleteTask(task.id)
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

async function toggleEnabled(task: TaskDto): Promise<void> {
  try {
    await getBackupHubApi().updateTask({ id: task.id, enabled: !task.enabled })
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

/** Queue an immediate real backup (SFTP/FTP/SSH/S3). DB sources wait for Phase 7. */
async function runNow(task: TaskDto): Promise<void> {
  try {
    await getBackupHubApi().runTaskNow(task.id, { dryRun: false })
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

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

const canGoNext = computed(() => {
  if (step.value === 1) {
    return Boolean(form.name.trim() && form.profileId && form.targetFolder.trim())
  }
  if (step.value === 2) {
    return !previewError.value
  }
  return true
})
</script>

<template>
  <div>
    <header class="page-header">
      <h1>Tasks</h1>
      <p>Link a source profile, target folder, schedule, and backup settings.</p>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="btn-row" style="margin-bottom: 1rem">
      <button type="button" class="btn btn-primary" :disabled="profiles.length === 0" @click="openCreate">
        New task
      </button>
      <button type="button" class="btn" :disabled="loading" @click="refresh">Refresh</button>
    </div>

    <p v-if="profiles.length === 0" class="phase-note">
      Create a connection profile first, then add a backup task.
    </p>

    <section v-if="!showWizard" class="panel">
      <p v-if="loading" class="muted">Loading…</p>
      <p v-else-if="tasks.length === 0" class="muted">No tasks yet.</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Profile</th>
            <th>Schedule</th>
            <th>Next run</th>
            <th>Last</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in tasks" :key="task.id">
            <td>
              <strong>{{ task.name }}</strong>
              <div class="muted" style="font-size: 0.85em">
                <span class="status-pill" :class="task.enabled ? 'ok' : 'err'">
                  {{ task.enabled ? 'Enabled' : 'Paused' }}
                </span>
              </div>
            </td>
            <td>{{ task.profileName ?? '—' }} ({{ task.profileType }})</td>
            <td class="mono-cell">{{ task.schedule.cronExpression }}</td>
            <td>{{ formatWhen(task.nextRunAt) }}</td>
            <td>{{ task.lastRunStatus ?? '—' }}</td>
            <td>
              <div class="btn-row">
                <button type="button" class="btn" @click="openEdit(task)">Edit</button>
                <button type="button" class="btn" @click="toggleEnabled(task)">
                  {{ task.enabled ? 'Pause' : 'Enable' }}
                </button>
                <button
                  type="button"
                  class="btn"
                  title="Queue an immediate backup (SFTP, FTP, SSH, or S3)"
                  @click="runNow(task)"
                >
                  Run now
                </button>
                <button type="button" class="btn btn-danger" @click="removeTask(task)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-else class="panel">
      <h2>{{ editingId ? 'Edit task' : 'New task' }} — step {{ step }} of 3</h2>

      <div class="wizard-steps">
        <button type="button" class="step-chip" :class="{ active: step === 1 }" @click="step = 1">
          1. Source &amp; target
        </button>
        <button type="button" class="step-chip" :class="{ active: step === 2 }" @click="step = 2">
          2. Schedule
        </button>
        <button type="button" class="step-chip" :class="{ active: step === 3 }" @click="step = 3">
          3. Backup settings
        </button>
      </div>

      <div v-if="step === 1" class="form-grid">
        <label class="field">
          <span>Task name</span>
          <input v-model="form.name" type="text" maxlength="120" />
        </label>
        <label class="field">
          <span>Source profile</span>
          <select v-model="form.profileId">
            <option value="" disabled>Select profile…</option>
            <option v-for="p in profiles" :key="p.id" :value="p.id">
              {{ p.name }} ({{ p.type }})
            </option>
          </select>
        </label>
        <label class="field field-wide">
          <span>Target folder</span>
          <div class="input-with-btn">
            <input v-model="form.targetFolder" type="text" placeholder="/path/to/backups" />
            <button type="button" class="btn" @click="pickFolder">Browse…</button>
          </div>
        </label>
        <label class="field checkbox">
          <input v-model="form.enabled" type="checkbox" />
          <span>Enabled (scheduler will fire this task)</span>
        </label>
        <label class="field checkbox">
          <input v-model="form.catchUpMissed" type="checkbox" />
          <span>Catch up missed runs (applied in Phase 9)</span>
        </label>
      </div>

      <div v-else-if="step === 2" class="form-grid">
        <label class="field">
          <span>Timezone (IANA)</span>
          <input v-model="form.timezone" type="text" placeholder="Asia/Tehran" />
        </label>
        <label class="field">
          <span>Schedule mode</span>
          <select v-model="form.mode">
            <option v-for="m in scheduleModes" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </label>

        <template v-if="form.mode === 'every'">
          <label class="field">
            <span>Every</span>
            <input v-model.number="form.everyValue" type="number" min="1" max="10000" />
          </label>
          <label class="field">
            <span>Unit</span>
            <select v-model="form.everyUnit">
              <option value="minute">Minutes</option>
              <option value="hour">Hours</option>
            </select>
          </label>
        </template>

        <template v-if="form.mode === 'daily' || form.mode === 'weekly' || form.mode === 'monthly'">
          <label class="field">
            <span>Hour (0–23)</span>
            <input v-model.number="form.hour" type="number" min="0" max="23" />
          </label>
          <label class="field">
            <span>Minute (0–59)</span>
            <input v-model.number="form.minute" type="number" min="0" max="59" />
          </label>
        </template>

        <div v-if="form.mode === 'weekly'" class="field field-wide">
          <span>Days of week</span>
          <div class="weekday-row">
            <button
              v-for="d in WEEKDAYS"
              :key="d.value"
              type="button"
              class="btn"
              :class="{ 'btn-primary': form.daysOfWeek.includes(d.value) }"
              @click="toggleWeekday(d.value)"
            >
              {{ d.label }}
            </button>
          </div>
        </div>

        <label v-if="form.mode === 'monthly'" class="field">
          <span>Day of month</span>
          <input v-model.number="form.dayOfMonth" type="number" min="1" max="31" />
        </label>

        <label v-if="form.mode === 'cron'" class="field field-wide">
          <span>Cron expression (min hour dom month dow)</span>
          <input v-model="form.cronExpression" type="text" class="mono-input" />
        </label>

        <div class="field field-wide">
          <span>Next runs preview</span>
          <p v-if="previewError" class="error-banner">{{ previewError }}</p>
          <template v-else-if="preview">
            <p class="muted">{{ preview.human }}</p>
            <p class="mono-cell">{{ preview.cronExpression }}</p>
            <ul class="preview-list">
              <li v-for="run in preview.nextRuns" :key="run">{{ formatWhen(run) }}</li>
            </ul>
          </template>
          <p v-else class="muted">Loading preview…</p>
        </div>
      </div>

      <div v-else class="form-grid">
        <label class="field checkbox field-wide">
          <input v-model="form.fullBackup" type="checkbox" />
          <span>Full backup mode</span>
        </label>
        <label v-if="form.fullBackup" class="field checkbox field-wide">
          <input v-model="form.useFullPeriod" type="checkbox" />
          <span>Use full period (cycle baseline + changes, then rollover)</span>
        </label>
        <template v-if="form.fullBackup && form.useFullPeriod">
          <label class="field">
            <span>Period length</span>
            <input v-model.number="form.fullPeriodValue" type="number" min="1" />
          </label>
          <label class="field">
            <span>Period unit</span>
            <select v-model="form.fullPeriodUnit">
              <option value="day">Days</option>
              <option value="week">Weeks</option>
              <option value="month">Months</option>
            </select>
          </label>
        </template>

        <label class="field checkbox">
          <input v-model="form.compress" type="checkbox" />
          <span>Compress archives</span>
        </label>
        <label class="field checkbox">
          <input
            v-model="form.encryptArchive"
            type="checkbox"
            :disabled="!form.compress"
            @change="
              () => {
                if (!form.compress) form.encryptArchive = false
              }
            "
          />
          <span>Encrypt archive (requires compress)</span>
        </label>
        <label v-if="form.encryptArchive" class="field field-wide">
          <span>
            Archive password
            {{ editingId && hasArchivePassword ? '(leave blank to keep)' : '' }}
          </span>
          <input v-model="form.archivePassword" type="password" autocomplete="new-password" />
        </label>
        <label v-if="editingId && hasArchivePassword" class="field checkbox field-wide">
          <input v-model="form.clearArchivePassword" type="checkbox" />
          <span>Clear stored archive password</span>
        </label>

        <label class="field field-wide">
          <span>Exclude patterns (one per line)</span>
          <textarea v-model="form.excludePatternsText" rows="4" placeholder="*.tmp&#10;node_modules/**" />
        </label>

        <label class="field checkbox">
          <input v-model="form.useRetention" type="checkbox" />
          <span>Retention: keep N cycles</span>
        </label>
        <label v-if="form.useRetention" class="field">
          <span>Keep cycles</span>
          <input v-model.number="form.keepCycles" type="number" min="1" max="10000" />
        </label>
      </div>

      <div class="btn-row" style="margin-top: 1.25rem">
        <button
          v-if="step > 1"
          type="button"
          class="btn"
          :disabled="saving"
          @click="step -= 1"
        >
          Back
        </button>
        <button
          v-if="step < 3"
          type="button"
          class="btn btn-primary"
          :disabled="!canGoNext || saving"
          @click="
            step += 1;
            if (step === 2) void refreshPreview()
          "
        >
          Next
        </button>
        <button
          v-if="step === 3"
          type="button"
          class="btn btn-primary"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? 'Saving…' : 'Save task' }}
        </button>
        <button
          type="button"
          class="btn"
          :disabled="saving"
          @click="
            showWizard = false;
            resetForm()
          "
        >
          Cancel
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.wizard-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1rem 0 1.25rem;
}

.step-chip {
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-muted);
  border-radius: 999px;
  padding: 0.35rem 0.85rem;
  cursor: pointer;
}

.step-chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.weekday-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.input-with-btn {
  display: flex;
  gap: 0.5rem;
}

.input-with-btn input {
  flex: 1;
}

.preview-list {
  margin: 0.35rem 0 0;
  padding-left: 1.2rem;
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 0.9em;
}

.mono-cell,
.mono-input {
  font-family: var(--mono);
  font-size: 0.9em;
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
</style>
