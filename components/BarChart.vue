<script setup lang="ts">
// Biểu đồ cột bo tròn, cột mọc dần lên khi dữ liệu đổi
const props = defineProps<{ data: { label: string; value: number }[]; goal?: number; unit?: string }>()
const max = computed(() => Math.max(props.goal || 0, ...props.data.map((d) => d.value), 1) * 1.15)
const COLORS = ['var(--peach)', 'var(--sage)', 'var(--butter)', 'var(--slate)', 'var(--rose)']
const hover = ref<number | null>(null)
const ready = ref(false)
onMounted(() => requestAnimationFrame(() => (ready.value = true)))
const pct = (v: number) => (ready.value ? Math.max(1.5, (v / max.value) * 100) : 0)
</script>

<template>
  <div class="chart">
    <div class="plot">
      <div v-if="goal" class="goal" :style="{ bottom: (goal / max) * 100 + '%' }">
        <span>mục tiêu {{ goal }}{{ unit }}</span>
      </div>
      <div v-for="(d, i) in data" :key="i" class="slot" @mouseenter="hover = i" @mouseleave="hover = null">
        <div
          class="b"
          :style="{
            height: pct(d.value) + '%',
            background: i === data.length - 1 ? 'var(--accent)' : COLORS[i % COLORS.length],
            transitionDelay: i * 35 + 'ms',
          }"
        />
        <Transition name="tip">
          <div v-if="hover === i" class="tip" :style="{ bottom: `calc(${pct(d.value)}% + 6px)` }">
            {{ Math.round(d.value) }}{{ unit }}
          </div>
        </Transition>
      </div>
    </div>
    <div class="labels">
      <span v-for="(d, i) in data" :key="i">{{ d.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.plot {
  position: relative;
  height: 160px;
  display: flex;
  gap: 8px;
}
.slot {
  position: relative;
  flex: 1;
  display: flex;
  align-items: flex-end;
  cursor: default;
}
.b {
  width: 100%;
  border-radius: 10px 10px 6px 6px;
  transform-origin: bottom;
  transition:
    height 0.8s var(--ease),
    filter 0.2s,
    transform 0.25s var(--ease);
}
.slot:hover .b {
  filter: brightness(0.96) saturate(1.25);
  transform: scaleX(1.06);
}
.labels {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.labels span {
  flex: 1;
  text-align: center;
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
}
.goal {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1.5px dashed var(--text-3);
  opacity: 0.55;
  pointer-events: none;
  z-index: 1;
}
.goal span {
  position: absolute;
  right: 0;
  top: -18px;
  font-size: 10.5px;
  color: var(--text-2);
}
.tip {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  background: var(--text);
  color: var(--bg);
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 8px;
  white-space: nowrap;
  z-index: 2;
  pointer-events: none;
}
.tip-enter-active,
.tip-leave-active {
  transition: all 0.18s var(--ease);
}
.tip-enter-from,
.tip-leave-to {
  opacity: 0;
  transform: translate(-50%, 4px);
}
</style>
