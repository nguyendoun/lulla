<script setup lang="ts">
// Đĩa than quay: tăng/giảm tốc dần như mâm đĩa thật thay vì dừng khựng
const props = withDefaults(defineProps<{ cover?: string | null; seed?: string; spinning: boolean; size?: number }>(), {
  cover: null,
  seed: '',
  size: 230,
})

const disc = ref<HTMLElement | null>(null)
let anim: Animation | null = null
let raf = 0

function ramp(to: number, ms: number) {
  if (!anim) return
  cancelAnimationFrame(raf)
  const from = anim.playbackRate
  const t0 = performance.now()
  if (to > 0 && anim.playState !== 'running') anim.play()
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / ms)
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
    anim!.updatePlaybackRate(from + (to - from) * e)
    if (k < 1) raf = requestAnimationFrame(step)
    else if (to === 0) anim!.pause()
  }
  raf = requestAnimationFrame(step)
}

onMounted(() => {
  if (!disc.value) return
  anim = disc.value.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
    duration: 1800, // ~33 vòng/phút
    iterations: Infinity,
  })
  anim.playbackRate = props.spinning ? 1 : 0
  if (!props.spinning) anim.pause()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  anim?.cancel()
})
watch(
  () => props.spinning,
  (on) => ramp(on ? 1 : 0, on ? 700 : 1100),
)
</script>

<template>
  <div class="vinyl" :style="{ width: `${size}px`, height: `${size}px` }">
    <div ref="disc" class="disc">
      <div class="shine" />
      <div class="label">
        <Cover :src="cover" :seed="seed" size="100%" :radius="999" />
        <span class="hole" />
      </div>
    </div>
    <div class="arm" :class="{ on: spinning }">
      <span class="pivot" />
      <span class="rod" />
      <span class="head" />
    </div>
  </div>
</template>

<style scoped>
.vinyl {
  position: relative;
  flex-shrink: 0;
}
.disc {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    repeating-radial-gradient(circle, #1c1714 0 1.5px, #2a221d 1.5px 3px),
    #221b17;
  box-shadow:
    0 20px 40px -16px rgba(40, 20, 10, 0.55),
    inset 0 0 0 6px #18130f;
  will-change: transform;
}
.shine {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    from 30deg,
    transparent 0 40deg,
    rgba(255, 255, 255, 0.08) 60deg,
    transparent 90deg 210deg,
    rgba(255, 255, 255, 0.06) 235deg,
    transparent 260deg
  );
}
.label {
  position: absolute;
  inset: 32%;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 0 0 3px #3a2e27;
}
.hole {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 9px;
  height: 9px;
  margin: -4.5px;
  border-radius: 50%;
  background: var(--surface-2);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
}
/* Cần đọc đĩa */
.arm {
  position: absolute;
  right: -4%;
  top: -4%;
  width: 46%;
  height: 74%;
  transform-origin: 82% 10%;
  transform: rotate(-24deg);
  transition: transform 0.9s var(--ease-spring);
  pointer-events: none;
}
.arm.on {
  transform: rotate(0deg);
}
.pivot {
  position: absolute;
  right: 6%;
  top: 2%;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff, #d8cdc2);
  box-shadow: 0 4px 10px -4px rgba(0, 0, 0, 0.4);
}
.rod {
  position: absolute;
  right: calc(6% + 11px);
  top: calc(2% + 13px);
  width: 4px;
  height: 78%;
  border-radius: 4px;
  background: linear-gradient(#f4ede6, #cbbfb3);
  transform-origin: top center;
  transform: rotate(18deg);
}
.head {
  position: absolute;
  left: 18%;
  bottom: 4%;
  width: 16px;
  height: 22px;
  border-radius: 4px;
  background: var(--accent);
  transform: rotate(18deg);
  box-shadow: 0 4px 8px -3px rgba(0, 0, 0, 0.4);
}
</style>
