<script setup lang="ts">
// Thanh trượt tự vẽ: kéo mượt bằng pointer events, chỉ "commit" khi thả tay
const props = withDefaults(defineProps<{ value: number; max: number; live?: boolean }>(), { live: false })
const emit = defineEmits<{ change: [number]; preview: [number | null] }>()

const el = ref<HTMLElement | null>(null)
const dragging = ref(false)
const dragVal = ref(0)

const shown = computed(() => (dragging.value ? dragVal.value : props.value))
const pct = computed(() => (props.max > 0 ? Math.min(100, (shown.value / props.max) * 100) : 0))

function valAt(e: PointerEvent) {
  const r = el.value!.getBoundingClientRect()
  return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * props.max
}
function down(e: PointerEvent) {
  if (!props.max) return
  dragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  move(e)
}
function move(e: PointerEvent) {
  if (!dragging.value) return
  dragVal.value = valAt(e)
  emit('preview', dragVal.value)
  if (props.live) emit('change', dragVal.value)
}
function up() {
  if (!dragging.value) return
  dragging.value = false
  emit('preview', null)
  emit('change', dragVal.value)
}
function key(e: KeyboardEvent) {
  const step = props.max / 20
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') emit('change', Math.min(props.max, props.value + step))
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') emit('change', Math.max(0, props.value - step))
  e.stopPropagation()
}
</script>

<template>
  <div
    ref="el"
    class="slider"
    :class="{ dragging }"
    role="slider"
    tabindex="0"
    :aria-valuemin="0"
    :aria-valuemax="max"
    :aria-valuenow="Math.round(shown)"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="up"
    @pointercancel="up"
    @keydown="key"
  >
    <div class="track">
      <div class="fill" :style="{ width: pct + '%' }" />
    </div>
    <div class="thumb" :style="{ left: pct + '%' }" />
  </div>
</template>

<style scoped>
.slider {
  position: relative;
  height: 16px;
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: none;
}
.track {
  width: 100%;
  height: 4px;
  border-radius: 4px;
  background: var(--line);
  overflow: hidden;
  transition: height 0.2s var(--ease);
}
.fill {
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
}
.thumb {
  position: absolute;
  top: 50%;
  width: 13px;
  height: 13px;
  margin: -6.5px 0 0 -6.5px;
  border-radius: 50%;
  background: var(--surface);
  box-shadow:
    0 0 0 3px var(--accent),
    0 2px 6px rgba(0, 0, 0, 0.2);
  transform: scale(0);
  transition: transform 0.25s var(--ease-spring);
}
.slider:hover .track,
.slider.dragging .track {
  height: 6px;
}
.slider:hover .thumb,
.slider.dragging .thumb,
.slider:focus-visible .thumb {
  transform: scale(1);
}
</style>
