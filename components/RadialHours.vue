<script setup lang="ts">
// Đồng hồ 24h: mỗi tia là một giờ, tia càng dài = nghe càng nhiều giờ đó
const props = defineProps<{ hours: number[] }>()
const max = computed(() => Math.max(1, ...props.hours))
const peak = computed(() => props.hours.indexOf(Math.max(...props.hours)))
const COLORS = ['var(--slate-deep)', 'var(--sage-deep)', 'var(--butter-deep)', 'var(--peach-deep)', 'var(--rose-deep)']
const color = (h: number) => COLORS[Math.floor(h / 5) % COLORS.length]
const ready = ref(false)
onMounted(() => requestAnimationFrame(() => (ready.value = true)))

const R0 = 52
const RMAX = 108
function ray(h: number) {
  const a = (h / 24) * Math.PI * 2 - Math.PI / 2
  const len = 6 + (props.hours[h] / max.value) * (RMAX - R0)
  return {
    x1: 130 + Math.cos(a) * R0,
    y1: 130 + Math.sin(a) * R0,
    x2: 130 + Math.cos(a) * (R0 + len),
    y2: 130 + Math.sin(a) * (R0 + len),
  }
}
</script>

<template>
  <svg viewBox="0 0 260 260" class="radial">
    <circle cx="130" cy="130" :r="R0 - 8" class="face" />
    <line
      v-for="h in 24"
      :key="h"
      v-bind="ray(h - 1)"
      :stroke="color(h - 1)"
      :stroke-opacity="h - 1 === peak ? 1 : 0.55"
      stroke-width="8"
      stroke-linecap="round"
      class="ray"
      pathLength="1"
      :style="{ strokeDashoffset: ready ? 0 : 1, transitionDelay: (h - 1) * 25 + 'ms' }"
    >
      <title>{{ h - 1 }}h: {{ Math.round(hours[h - 1]) }} phút</title>
    </line>
    <text x="130" y="128" text-anchor="middle" class="big">{{ String(peak).padStart(2, '0') }}:00</text>
    <text x="130" y="146" text-anchor="middle" class="small">giờ nghe nhiều nhất</text>
    <text v-for="(l, i) in ['0h', '6h', '12h', '18h']" :key="l" :x="130 + [0, 122, 0, -122][i]" :y="130 + [-118, 4, 126, 4][i]" text-anchor="middle" class="tick">{{ l }}</text>
  </svg>
</template>

<style scoped>
.radial {
  width: 100%;
  max-width: 280px;
  display: block;
  margin: 0 auto;
}
.face {
  fill: var(--surface-2);
}
.ray {
  stroke-dasharray: 1;
  transition: stroke-dashoffset 0.9s var(--ease);
}
.big {
  font-size: 22px;
  font-weight: 800;
  fill: var(--text);
}
.small {
  font-size: 9px;
  fill: var(--text-3);
}
.tick {
  font-size: 9.5px;
  fill: var(--text-3);
  font-weight: 600;
}
</style>
