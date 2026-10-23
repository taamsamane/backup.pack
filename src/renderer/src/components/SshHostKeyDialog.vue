<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { SshHostKeyPrompt } from '../../../shared/profiles'
import { getBackupHubApi } from '../api'

const prompt = ref<SshHostKeyPrompt | null>(null)
const busy = ref(false)

let unsubscribe: (() => void) | null = null

onMounted(() => {
  unsubscribe = getBackupHubApi().onSshHostKeyPrompt((next) => {
    prompt.value = next
  })
})

onUnmounted(() => {
  unsubscribe?.()
})

async function decide(trust: boolean): Promise<void> {
  if (!prompt.value) {
    return
  }
  busy.value = true
  try {
    await getBackupHubApi().decideSshHostKey({
      requestId: prompt.value.requestId,
      trust
    })
    prompt.value = null
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="prompt" class="modal-backdrop" role="dialog" aria-modal="true">
    <div class="modal-panel">
      <h2>{{ prompt.isNew ? 'Trust new SSH host key?' : 'SSH host key changed!' }}</h2>
      <p class="muted">
        {{
          prompt.isNew
            ? 'This host has not been seen before. Trust on first use stores the fingerprint for later verification.'
            : 'The fingerprint does not match the previously trusted key. Only continue if you expect this change.'
        }}
      </p>
      <div class="grid-2" style="margin-top: 0.85rem">
        <div class="kv">
          <span class="kv-label">Host</span>
          <span class="kv-value">{{ prompt.host }}:{{ prompt.port }}</span>
        </div>
        <div class="kv">
          <span class="kv-label">Algorithm</span>
          <span class="kv-value">{{ prompt.algorithm }}</span>
        </div>
        <div class="kv" style="grid-column: 1 / -1">
          <span class="kv-label">Fingerprint</span>
          <span class="kv-value">{{ prompt.fingerprint }}</span>
        </div>
        <div v-if="prompt.previousFingerprint" class="kv" style="grid-column: 1 / -1">
          <span class="kv-label">Previous fingerprint</span>
          <span class="kv-value">{{ prompt.previousFingerprint }}</span>
        </div>
      </div>
      <div class="btn-row">
        <button type="button" class="btn" :disabled="busy" @click="decide(false)">Reject</button>
        <button type="button" class="btn btn-primary" :disabled="busy" @click="decide(true)">
          Trust and continue
        </button>
      </div>
    </div>
  </div>
</template>
