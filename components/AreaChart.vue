<script setup lang="ts">
// Biểu đồ vùng đường cong mượt, tự vẽ dần khi hiện ra
const props = defineProps<{ data: { label: string; value: number }[]; unit?: string }>()
const box = ref<HTMLElement | null>(null)
const W = ref(600)
const H = 200
const PAD = { l: 8, r: 8, t: 20, b: 26 }
let ro: ResizeObserver | null = null
onMounted(() => {
  ro = new ResizeObserver((e) => (W.value = e[0].contentRect.width))
  if (box.value) ro.observe(box.value)
})
onBeforeUnmount(() => ro?.disconnect())

const max = computed(() => Math.max(1, ...props.data.map((d) => d.value)) * 1.2)
const pts = computed(() => {
  const n = props.data.length
  const iw = W.value - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  return props.data.map((d, i) => ({
    x: PAD.l + (n > 1 ? (i / (n - 1)) * iw : iw / 2),
    y: PAD.t + ih - (d.value / max.value) * ih,
    ...d,
  }))
})

// Catmull-Rom → Bézier: đường đi qua mọi điểm mà vẫn mềm
const line = computed(() => {
  const p = pts.value
  if (!p.length) return ''
  let d = `M${p[0].x},${p[0].y}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[i + 2] || p2
    const t = 0.2
    const c1x = p1.x + (p2.x - p0.x) * t
    const c1y = Math.min(H - PAD.b, p1.y + (p2.y - p0.y) * t)
    const c2x = p2.x - (p3.x - p1.x) * t
    const c2y = Math.min(H - PAD.b, p2.y - (p3.y - p1.y) * t)
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`
  }
  return d
})
const area = computed(() => {
  const p = pts.value
  if (!p.length) return ''
  return `${line.value} L${p[p.length - 1].x},${H - PAD.b} L${p[0].x},${H - PAD.b} Z`
})

const hover = ref<number | null>(null)
function onMove(e: PointerEvent) {
  const r = box.value!.getBoundingClientRect()
  const x = e.clientX - r.left
  let best = 0
  pts.value.forEach((p, i) => {
    if (Math.abs(p.x - x) < Math.abs(pts.value[best].x - x)) best = i
  })
  hover.value = best
}
const uid = useId()
</script>

<template>
  <div ref="box" class="area" @pointermove="onMove" @pointerleave="hover = null">
    <svg :width="W" :height="H" :viewBox="`0 0 ${W} ${H}`">
      <defs>
        <linearGradient :id="`g${uid}`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35" />
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <line v-for="k in 3" :key="k" :x1="PAD.l" :x2="W - PAD.r" :y1="PAD.t + ((H - PAD.t - PAD.b) * k) / 3" :y2="PAD.t + ((H - PAD.t - PAD.b) * k) / 3" class="grid" />
      <path :d="area" :fill="`url(#g${uid})`" class="fill" />
      <path :d="line" class="stroke" pathLength="1" />
      <g v-if="hover !== null">
        <line :x1="pts[hover].x" :x2="pts[hover].x" :y1="PAD.t" :y2="H - PAD.b" class="cursor" />
        <circle :cx="pts[hover].x" :cy="pts[hover].y" r="5" class="dot" />
      </g>
      <text v-for="(p, i) in pts" :key="i" :x="p.x" :y="H - 6" text-anchor="middle" class="lbl" :class="{ first: i === 0, last: i === pts.length - 1 }">
        {{ p.label }}
      </text>
    </svg>
    <div v-if="hover !== null" class="tip" :style="{ left: pts[hover].x + 'px', top: pts[hover].y - 40 + 'px' }">
      <b>{{ Math.round(pts[hover].value) }}{{ unit }}</b> <span>{{ pts[hover].label }}</span>
    </div>
  </div>
</template>

<style scoped>
.area {
  position: relative;
  width: 100%;
}
svg {
  display: block;
  overflow: visible;
}
.grid {
  stroke: var(--line);
  stroke-dasharray: 3 5;
}
.stroke {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw 1.4s var(--ease) 0.15s forwards;
}
.fill {
  opacity: 0;
  animation: show 1s var(--ease) 0.6s forwards;
}
@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}
@keyframes show {
  to {
    opacity: 1;
  }
}
.cursor {
  stroke: var(--text-3);
  stroke-dasharray: 3 3;
}
.dot {
  fill: var(--surface);
  stroke: var(--accent);
  stroke-width: 3;
}
.lbl {
  font-size: 10.5px;
  fill: var(--text-3);
}
.tip {
  position: absolute;
  transform: translateX(-50%);
  background: var(--text);
  color: var(--bg);
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 11.5px;
  white-space: nowrap;
  pointer-events: none;
  transition:
    left 0.15s var(--ease),
    top 0.15s var(--ease);
}
.tip span {
  opacity: 0.7;
  margin-left: 4px;
}
</style>
