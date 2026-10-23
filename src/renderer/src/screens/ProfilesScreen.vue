<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  DEFAULT_PORTS,
  type AuthMethod,
  type ConnectionTestResult,
  type ProfileCreateInput,
  type ProfileDto,
  type ProfileType
} from '../../../shared/profiles'
import { getBackupHubApi } from '../api'

const profiles = ref<ProfileDto[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const editingId = ref<string | null>(null)
const showForm = ref(false)
const saving = ref(false)
const testing = ref(false)
const testResult = ref<ConnectionTestResult | null>(null)

const form = reactive({
  name: '',
  type: 'sftp' as ProfileType,
  host: '',
  port: '' as string | number,
  username: '',
  authMethod: 'password' as AuthMethod,
  password: '',
  privateKey: '',
  passphrase: '',
  accessKeyId: '',
  secretAccessKey: '',
  sessionToken: '',
  filePath: '',
  region: 'us-east-1',
  endpoint: '',
  forcePathStyle: false,
  awsProfile: 'default',
  bucket: '',
  secure: false,
  remotePath: '.',
  database: '',
  authSource: '',
  encrypt: true,
  trustServerCertificate: true,
  /** MySQL/MariaDB TLS — off by default (common for tunnel/local servers). */
  ssl: false,
  clearCredentials: false,
  useSshTunnel: false,
  sshTunnelProfileId: ''
})

const typeOptions: Array<{ value: ProfileType; label: string }> = [
  { value: 'sftp', label: 'SFTP' },
  { value: 'ftp', label: 'FTP / FTPS' },
  { value: 'ssh', label: 'SSH' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mariadb', label: 'MariaDB' },
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'mssql', label: 'Microsoft SQL Server' },
  { value: 'mongodb', label: 'MongoDB' },
  { value: 'sqlite', label: 'SQLite (file)' },
  { value: 'aws-s3', label: 'AWS S3 / compatible' }
]

const isSqlite = computed(() => form.type === 'sqlite')
const isAws = computed(() => form.type === 'aws-s3')
const isFtp = computed(() => form.type === 'ftp')
const isSshFamily = computed(() => form.type === 'sftp' || form.type === 'ssh')
const isFileSource = computed(() => form.type === 'sftp' || form.type === 'ftp' || form.type === 'ssh')
const isMysqlFamily = computed(() => form.type === 'mysql' || form.type === 'mariadb')
const isDb = computed(() =>
  ['mysql', 'mariadb', 'postgres', 'mssql', 'mongodb'].includes(form.type)
)

const sshJumpProfiles = computed(() =>
  profiles.value.filter((p) => (p.type === 'ssh' || p.type === 'sftp') && p.id !== editingId.value)
)

const authOptions = computed((): Array<{ value: AuthMethod; label: string }> => {
  if (isAws.value) {
    return [
      { value: 'aws-keys', label: 'Access key / secret' },
      { value: 'aws-profile', label: 'Named AWS profile' }
    ]
  }
  if (isSqlite.value) {
    return [{ value: 'none', label: 'None (local file)' }]
  }
  if (isSshFamily.value) {
    return [
      { value: 'password', label: 'Password' },
      { value: 'key', label: 'Private key' }
    ]
  }
  return [{ value: 'password', label: 'Password' }]
})

/** Custom S3 endpoints need path-style (Arvan / MinIO). */
watch(
  () => [form.type, form.endpoint] as const,
  ([type, endpoint]) => {
    if (type === 'aws-s3' && String(endpoint).trim()) {
      form.forcePathStyle = true
    }
  }
)

function resetForm(): void {
  editingId.value = null
  testResult.value = null
  form.name = ''
  form.type = 'sftp'
  form.host = ''
  form.port = DEFAULT_PORTS.sftp
  form.username = ''
  form.authMethod = 'password'
  form.password = ''
  form.privateKey = ''
  form.passphrase = ''
  form.accessKeyId = ''
  form.secretAccessKey = ''
  form.sessionToken = ''
  form.filePath = ''
  form.region = 'us-east-1'
  form.endpoint = ''
  form.forcePathStyle = false
  form.awsProfile = 'default'
  form.bucket = ''
  form.secure = false
  form.remotePath = '.'
  form.database = ''
  form.authSource = ''
  form.encrypt = true
  form.trustServerCertificate = true
  form.ssl = false
  form.clearCredentials = false
  form.useSshTunnel = false
  form.sshTunnelProfileId = ''
}

function onTypeChange(): void {
  if (form.type === 'sqlite') {
    form.authMethod = 'none'
    form.port = ''
    return
  }
  if (form.type === 'aws-s3') {
    form.authMethod = 'aws-keys'
    form.port = ''
    return
  }
  form.port = DEFAULT_PORTS[form.type]
  form.authMethod = 'password'
}

function openCreate(): void {
  resetForm()
  showForm.value = true
}

function openEdit(profile: ProfileDto): void {
  resetForm()
  editingId.value = profile.id
  form.name = profile.name
  form.type = profile.type
  form.host = profile.host ?? ''
  form.port = profile.port ?? ''
  form.username = profile.username ?? ''
  form.authMethod = profile.authMethod
  form.filePath = profile.options.filePath ?? ''
  form.region = profile.options.region ?? 'us-east-1'
  form.endpoint = profile.options.endpoint ?? ''
  form.forcePathStyle = profile.options.forcePathStyle ?? false
  form.awsProfile = profile.options.awsProfile ?? 'default'
  form.bucket = profile.options.bucket ?? ''
  form.secure = profile.options.secure ?? false
  form.remotePath = profile.options.remotePath ?? '.'
  form.database = profile.options.database ?? ''
  form.authSource = profile.options.authSource ?? ''
  form.encrypt = profile.options.encrypt ?? true
  form.trustServerCertificate = profile.options.trustServerCertificate ?? true
  form.ssl = profile.options.ssl ?? false
  form.useSshTunnel = Boolean(profile.options.sshTunnelProfileId)
  form.sshTunnelProfileId = profile.options.sshTunnelProfileId ?? ''
  showForm.value = true
}

function buildOptions(): ProfileCreateInput['options'] {
  if (isSqlite.value) {
    return { filePath: form.filePath }
  }
  if (isAws.value) {
    const endpoint = form.endpoint.trim() || undefined
    return {
      region: form.region || undefined,
      endpoint,
      // Custom endpoints (Arvan/MinIO) need path-style unless the user turns it off.
      forcePathStyle: endpoint ? form.forcePathStyle : form.forcePathStyle || undefined,
      awsProfile: form.authMethod === 'aws-profile' ? form.awsProfile : undefined,
      bucket: form.bucket || undefined,
      remotePath:
        form.remotePath.trim() && form.remotePath.trim() !== '.'
          ? form.remotePath.trim()
          : undefined
    }
  }
  const options: NonNullable<ProfileCreateInput['options']> = {}
  if (isFtp.value) {
    options.secure = form.secure
  }
  if (isFileSource.value && form.remotePath.trim()) {
    options.remotePath = form.remotePath.trim()
  }
  if (isDb.value) {
    if (form.database) options.database = form.database
    if (form.type === 'mongodb' && form.authSource) options.authSource = form.authSource
    if (form.type === 'mssql') {
      options.encrypt = form.encrypt
      options.trustServerCertificate = form.trustServerCertificate
    }
    if (isMysqlFamily.value) {
      options.ssl = form.ssl
    }
    if (form.useSshTunnel && form.sshTunnelProfileId) {
      options.sshTunnelProfileId = form.sshTunnelProfileId
    }
  }
  return Object.keys(options).length ? options : undefined
}

function buildCredentials(): ProfileCreateInput['credentials'] | undefined {
  if (form.authMethod === 'password' && form.password) {
    return { password: form.password }
  }
  if (form.authMethod === 'key' && form.privateKey) {
    return {
      privateKey: form.privateKey,
      passphrase: form.passphrase || undefined
    }
  }
  if (form.authMethod === 'aws-keys') {
    return {
      accessKeyId: form.accessKeyId || undefined,
      secretAccessKey: form.secretAccessKey || undefined,
      sessionToken: form.sessionToken || undefined
    }
  }
  return undefined
}

function buildCreatePayload(): ProfileCreateInput {
  return {
    name: form.name.trim(),
    type: form.type,
    host: isSqlite.value || isAws.value ? null : form.host.trim() || null,
    port:
      isSqlite.value || isAws.value
        ? null
        : form.port === ''
          ? null
          : Number(form.port),
    username: isSqlite.value ? null : form.username.trim() || null,
    authMethod: form.authMethod,
    credentials: buildCredentials(),
    options: buildOptions()
  }
}

async function refresh(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    profiles.value = await getBackupHubApi().listProfiles()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  saving.value = true
  error.value = null
  testResult.value = null
  try {
    if (isDb.value && form.useSshTunnel && !form.sshTunnelProfileId) {
      throw new Error('Select an SSH/SFTP jump-host profile, or disable SSH tunnel.')
    }
    if (editingId.value) {
      await getBackupHubApi().updateProfile({
        id: editingId.value,
        name: form.name.trim(),
        host: isSqlite.value || isAws.value ? null : form.host.trim() || null,
        port:
          isSqlite.value || isAws.value
            ? null
            : form.port === ''
              ? null
              : Number(form.port),
        username: isSqlite.value ? null : form.username.trim() || null,
        authMethod: form.authMethod,
        credentials: buildCredentials(),
        clearCredentials: form.clearCredentials || undefined,
        options: buildOptions()
      })
    } else {
      await getBackupHubApi().createProfile(buildCreatePayload())
    }
    showForm.value = false
    resetForm()
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}

async function remove(profile: ProfileDto): Promise<void> {
  if (!confirm(`Delete profile "${profile.name}"?`)) {
    return
  }
  error.value = null
  try {
    await getBackupHubApi().deleteProfile(profile.id)
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
}

async function runTest(): Promise<void> {
  testing.value = true
  testResult.value = null
  error.value = null
  try {
    if (isDb.value && form.useSshTunnel && !form.sshTunnelProfileId) {
      throw new Error('Select an SSH/SFTP jump-host profile before testing.')
    }
    if (editingId.value && !form.password && !form.privateKey && !form.accessKeyId) {
      testResult.value = await getBackupHubApi().testProfile({ id: editingId.value })
    } else {
      testResult.value = await getBackupHubApi().testProfile(buildCreatePayload())
    }
  } catch (err) {
    testResult.value = {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      latencyMs: 0
    }
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div>
    <header class="page-header">
      <h1>Connection Profiles</h1>
      <p>Reusable sources with secrets encrypted via Electron safeStorage.</p>
    </header>

    <div v-if="error" class="error-banner">{{ error }}</div>

    <div class="btn-row" style="margin-top: 0">
      <button type="button" class="btn btn-primary" @click="openCreate">New profile</button>
      <button type="button" class="btn" :disabled="loading" @click="refresh">Refresh</button>
    </div>

    <section class="panel" style="margin-top: 1rem">
      <h2>Saved profiles</h2>
      <p v-if="loading" class="muted">Loading…</p>
      <p v-else-if="profiles.length === 0" class="muted">No profiles yet.</p>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Endpoint</th>
            <th>Auth</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="profile in profiles" :key="profile.id">
            <td>{{ profile.name }}</td>
            <td>{{ profile.type }}</td>
            <td class="mono">
              <template v-if="profile.type === 'sqlite'">{{ profile.options.filePath }}</template>
              <template v-else-if="profile.type === 'aws-s3'">
                {{ profile.options.region }}{{ profile.options.bucket ? ` / ${profile.options.bucket}` : '' }}
              </template>
              <template v-else>
                {{ profile.host }}{{ profile.port ? `:${profile.port}` : '' }}
                <span v-if="profile.options.sshTunnelProfileId" class="muted"> (via SSH)</span>
              </template>
            </td>
            <td>{{ profile.authMethod }}</td>
            <td class="row-actions">
              <button type="button" class="btn" @click="openEdit(profile)">Edit</button>
              <button type="button" class="btn" @click="remove(profile)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="showForm" class="panel">
      <h2>{{ editingId ? 'Edit profile' : 'New profile' }}</h2>

      <div class="form-grid">
        <label class="field">
          <span>Name</span>
          <input v-model="form.name" type="text" required maxlength="120" />
        </label>

        <label class="field">
          <span>Type</span>
          <select v-model="form.type" :disabled="Boolean(editingId)" @change="onTypeChange">
            <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>

        <label v-if="!isSqlite && !isAws" class="field">
          <span>{{
            isDb && form.useSshTunnel
              ? 'DB host (as seen from SSH server)'
              : 'Host'
          }}</span>
          <input v-model="form.host" type="text" :placeholder="isDb && form.useSshTunnel ? '127.0.0.1' : ''" />
        </label>

        <label v-if="!isSqlite && !isAws" class="field">
          <span>{{ isDb && form.useSshTunnel ? 'DB port (on SSH server side)' : 'Port' }}</span>
          <input v-model="form.port" type="number" min="1" max="65535" />
        </label>

        <template v-if="isDb">
          <label class="field checkbox field-wide">
            <input v-model="form.useSshTunnel" type="checkbox" />
            <span>Connect via SSH tunnel (jump host)</span>
          </label>
          <label v-if="form.useSshTunnel" class="field field-wide">
            <span>SSH / SFTP profile</span>
            <select v-model="form.sshTunnelProfileId">
              <option value="" disabled>Select jump host profile…</option>
              <option v-for="jump in sshJumpProfiles" :key="jump.id" :value="jump.id">
                {{ jump.name }} ({{ jump.type }} — {{ jump.host }}{{ jump.port ? `:${jump.port}` : '' }})
              </option>
            </select>
            <span v-if="sshJumpProfiles.length === 0" class="hint">
              Create an SSH or SFTP profile first, then select it here.
            </span>
          </label>
          <p v-if="form.useSshTunnel" class="phase-note field-wide">
            Flow: app → SSH profile → then MySQL/Postgres/etc. at the host/port above (often
            <code>127.0.0.1</code> if the database listens on the jump host itself).
          </p>
        </template>

        <label v-if="!isSqlite" class="field">
          <span>{{ isDb ? 'Database username' : 'Username' }}</span>
          <input v-model="form.username" type="text" autocomplete="off" />
        </label>

        <label class="field">
          <span>Auth method</span>
          <select v-model="form.authMethod">
            <option v-for="opt in authOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>

        <label v-if="form.authMethod === 'password'" class="field field-wide">
          <span>Password {{ editingId ? '(leave blank to keep)' : '' }}</span>
          <input v-model="form.password" type="password" autocomplete="new-password" />
        </label>

        <label v-if="form.authMethod === 'key'" class="field field-wide">
          <span>Private key PEM {{ editingId ? '(leave blank to keep)' : '' }}</span>
          <textarea v-model="form.privateKey" rows="5" spellcheck="false" />
        </label>

        <label v-if="form.authMethod === 'key'" class="field">
          <span>Key passphrase (optional)</span>
          <input v-model="form.passphrase" type="password" autocomplete="new-password" />
        </label>

        <template v-if="form.authMethod === 'aws-keys'">
          <label class="field">
            <span>Access key ID</span>
            <input v-model="form.accessKeyId" type="text" autocomplete="off" />
          </label>
          <label class="field">
            <span>Secret access key</span>
            <input v-model="form.secretAccessKey" type="password" autocomplete="new-password" />
          </label>
          <label class="field field-wide">
            <span>Session token (optional)</span>
            <input v-model="form.sessionToken" type="password" autocomplete="new-password" />
          </label>
        </template>

        <label v-if="form.authMethod === 'aws-profile'" class="field">
          <span>AWS profile name</span>
          <input v-model="form.awsProfile" type="text" />
        </label>

        <label v-if="isSqlite" class="field field-wide">
          <span>SQLite file path</span>
          <input v-model="form.filePath" type="text" />
        </label>

        <template v-if="isAws">
          <label class="field">
            <span>Region</span>
            <input v-model="form.region" type="text" />
          </label>
          <label class="field">
            <span>Bucket (required for backups)</span>
            <input v-model="form.bucket" type="text" />
          </label>
          <label class="field field-wide">
            <span>Object prefix (optional)</span>
            <input
              v-model="form.remotePath"
              type="text"
              placeholder="backups/prod or leave empty for whole bucket"
            />
            <span class="hint">Only objects under this key prefix are backed up.</span>
          </label>
          <label class="field field-wide">
            <span>Custom endpoint (MinIO / Arvan / S3-compatible)</span>
            <input
              v-model="form.endpoint"
              type="text"
              placeholder="https://s3.ir-thr-at1.arvanstorage.ir"
            />
            <span class="hint">
              Use the regional endpoint only (e.g.
              <code>https://s3.ir-thr-at1.arvanstorage.ir</code>), not
              <code>https://&lt;bucket&gt;.s3.…</code>. Put the bucket name in the Bucket field.
            </span>
          </label>
          <label class="field checkbox">
            <input v-model="form.forcePathStyle" type="checkbox" />
            <span>Force path-style addressing (recommended for Arvan / MinIO)</span>
          </label>
        </template>

        <label v-if="isFtp" class="field checkbox">
          <input v-model="form.secure" type="checkbox" />
          <span>FTPS (explicit TLS)</span>
        </label>

        <label v-if="isFileSource" class="field field-wide">
          <span>Remote path to back up</span>
          <input
            v-model="form.remotePath"
            type="text"
            placeholder=". or /var/www/html"
          />
          <span class="hint">
            Used by backup tasks. Relative paths are from the login home; use an absolute path when needed.
          </span>
        </label>

        <label v-if="isDb" class="field">
          <span>Database (optional)</span>
          <input v-model="form.database" type="text" />
        </label>

        <label v-if="form.type === 'mongodb'" class="field">
          <span>Auth source</span>
          <input v-model="form.authSource" type="text" />
        </label>

        <template v-if="form.type === 'mssql'">
          <label class="field checkbox">
            <input v-model="form.encrypt" type="checkbox" />
            <span>Encrypt connection</span>
          </label>
          <label class="field checkbox">
            <input v-model="form.trustServerCertificate" type="checkbox" />
            <span>Trust server certificate</span>
          </label>
        </template>

        <label v-if="isMysqlFamily" class="field checkbox field-wide">
          <input v-model="form.ssl" type="checkbox" />
          <span>Require SSL/TLS (leave off for local servers / SSH tunnels without TLS)</span>
        </label>

        <label v-if="editingId" class="field checkbox field-wide">
          <input v-model="form.clearCredentials" type="checkbox" />
          <span>Clear stored credentials</span>
        </label>
      </div>

      <div v-if="testResult" class="test-result" :class="testResult.ok ? 'ok' : 'err'">
        <strong>{{ testResult.ok ? 'Success' : 'Failed' }}</strong>
        — {{ testResult.message }}
        <span v-if="testResult.latencyMs"> ({{ testResult.latencyMs }} ms)</span>
      </div>

      <p v-if="testing" class="phase-note">
        Testing… If this is a new SSH host, a “Trust SSH host key?” dialog will appear — click
        <strong>Trust and continue</strong> (you have about 2 minutes).
      </p>

      <div class="btn-row">
        <button type="button" class="btn" :disabled="saving || testing" @click="runTest">
          {{ testing ? 'Testing…' : 'Test connection' }}
        </button>
        <button type="button" class="btn btn-primary" :disabled="saving || testing" @click="save">
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
        <button
          type="button"
          class="btn"
          :disabled="saving || testing"
          @click="
            showForm = false;
            resetForm()
          "
        >
          Cancel
        </button>
      </div>
    </section>
  </div>
</template>
