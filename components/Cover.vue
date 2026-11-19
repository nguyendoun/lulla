<script setup lang="ts">
// Ảnh bìa: hiện mờ dần khi tải xong; không có bìa thì tạo nền gradient từ tên bài
const props = withDefaults(
  defineProps<{ src?: string | null; seed?: string; size?: number | string; radius?: number }>(),
  { src: null, seed: '', size: 44, radius: 10 },
)
const ok = ref(false)
const failed = ref(false)
watch(
  () => props.src,
  () => {
    ok.value = false
    failed.value = false
  },
)

const PAIRS = [
  ['#f6c6ad', '#e8825c'],
  ['#b9c9b0', '#6f8c66'],
  ['#f6dfa5', '#d9a441'],
  ['#cdd6df', '#5d6e80'],
  ['#f2b8b0', '#c8574d'],
  ['#e3d0f0', '#8b6aa8'],
]
const bg = computed(() => {
  let h = 0
  for (const c of props.seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const [a, b] = PAIRS[h % PAIRS.length]
  return `radial-gradient(circle at 30% 25%, ${a}, ${b})`
})
const dim = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
</script>

<template>
  <div class="cover" :style="{ width: dim, height: dim, borderRadius: `${radius}px`, background: bg }">
    <Icon v-if="!src || failed" name="music" :size="Math.max(14, Number(size) / 3 || 24)" class="ph" />
    <img
      v-if="src && !failed"
      :src="src"
      alt=""
      loading="lazy"
      decoding="async"
      :class="{ ok }"
      @load="ok = true"
      @error="failed = true"
    />
  </div>
</template>

<style scoped>
.cover {
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
  display: grid;
  place-items: center;
  aspect-ratio: 1;
}
.ph {
  color: rgba(255, 255, 255, 0.75);
}
img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transform: scale(1.04);
  transition:
    opacity 0.45s var(--ease),
    transform 0.6s var(--ease);
}
img.ok {
  opacity: 1;
  transform: none;
}
</style>
