<template>
  <span class="run-spinner" aria-hidden="true" />
</template>

<style scoped>
.run-spinner {
  display: inline-block;
  width: 0.85em;
  height: 0.85em;
  border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  vertical-align: -0.1em;
  animation: run-spin 0.7s linear infinite;
}

@keyframes run-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
