<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import logoIcon from '../assets/logo-icon.png'
import { useI18n } from '../i18n'

const { t } = useI18n()

const props = defineProps<{
  ready: boolean
}>()

const emit = defineEmits<{
  done: []
}>()

const visible = ref(true)
const fading = ref(false)
const minElapsed = ref(false)
let minTimer: ReturnType<typeof setTimeout> | null = null
let fadeTimer: ReturnType<typeof setTimeout> | null = null

function tryFinish(): void {
  if (!props.ready || !minElapsed.value || fading.value || !visible.value) {
    return
  }
  fading.value = true
  fadeTimer = setTimeout(() => {
    visible.value = false
    emit('done')
  }, 420)
}

watch(
  () => props.ready,
  () => tryFinish()
)

onMounted(() => {
  minTimer = setTimeout(() => {
    minElapsed.value = true
    tryFinish()
  }, 1400)
})

onUnmounted(() => {
  if (minTimer) clearTimeout(minTimer)
  if (fadeTimer) clearTimeout(fadeTimer)
})
</script>

<template>
  <div
    v-if="visible"
    class="splash"
    :class="{ fading }"
    role="status"
    aria-live="polite"
    :aria-label="t('app.starting')"
  >
    <div class="splash-glow" />
    <div class="splash-mark">
      <img class="splash-logo" :src="logoIcon" alt="" width="160" height="160" />
      <span class="splash-ring" aria-hidden="true" />
    </div>
    <p class="splash-title">backup<span class="dot">.</span>pack</p>
    <p class="splash-sub">{{ t('app.starting') }}</p>
  </div>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  background: #070b10;
  transition: opacity 0.4s ease, visibility 0.4s ease;
}

.splash.fading {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.splash-glow {
  position: absolute;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(47, 158, 123, 0.28), transparent 70%);
  animation: splash-pulse 2s ease-in-out infinite;
  pointer-events: none;
}

.splash-mark {
  position: relative;
  width: 168px;
  height: 168px;
  display: grid;
  place-items: center;
}

.splash-logo {
  width: 140px;
  height: 140px;
  object-fit: contain;
  animation: splash-float 2.4s ease-in-out infinite;
  filter: drop-shadow(0 0 18px rgba(0, 120, 255, 0.35));
}

.splash-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: #2f9e7b;
  border-right-color: rgba(47, 158, 123, 0.35);
  animation: splash-spin 1.1s linear infinite;
}

.splash-title {
  margin: 0.35rem 0 0;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #e8eef4;
}

.splash-title .dot {
  color: #2f9e7b;
}

.splash-sub {
  margin: 0;
  color: #9aabbc;
  font-size: 0.9rem;
  animation: splash-blink 1.4s ease-in-out infinite;
}

@keyframes splash-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes splash-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

@keyframes splash-pulse {
  0%,
  100% {
    transform: scale(0.92);
    opacity: 0.65;
  }
  50% {
    transform: scale(1.08);
    opacity: 1;
  }
}

@keyframes splash-blink {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}
</style>
