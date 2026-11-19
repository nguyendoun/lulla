<script setup lang="ts">
import type { Album } from '~/composables/useLibrary'
const props = defineProps<{ album: Album }>()
const p = usePlayer()
const ids = computed(() => props.album.tracks.map((t) => t.id))
const isPlaying = computed(() => p.playing.value && !!p.current.value && ids.value.includes(p.current.value.id))
function play() {
  if (isPlaying.value) p.pause()
  else p.playList(ids.value, 0)
}
</script>

<template>
  <div class="album" @dblclick="play">
    <div class="art">
      <Cover :src="album.cover" :seed="album.name" size="100%" :radius="18" />
      <button class="fab" :class="{ on: isPlaying }" :title="`Phát album ${album.name}`" @click.stop="play">
        <Icon :name="isPlaying ? 'pause' : 'play'" :size="16" fill />
      </button>
    </div>
    <b>{{ album.name }}</b>
    <small>{{ album.artist }}<template v-if="album.year"> · {{ album.year }}</template> · {{ album.tracks.length }} bài</small>
  </div>
</template>

<style scoped>
.album {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  cursor: pointer;
}
.art {
  position: relative;
  border-radius: 18px;
  margin-bottom: 8px;
  box-shadow: var(--shadow);
  transition:
    transform 0.45s var(--ease),
    box-shadow 0.45s var(--ease);
}
.album:hover .art {
  transform: translateY(-4px) rotate(-0.6deg);
  box-shadow: 0 18px 30px -16px rgba(60, 30, 10, 0.45);
}
.art :deep(img) {
  transition:
    opacity 0.45s var(--ease),
    transform 0.8s var(--ease);
}
.album:hover .art :deep(img) {
  transform: scale(1.05);
}
.fab {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--accent);
  color: var(--accent-ink);
  box-shadow: 0 8px 18px -6px rgba(0, 0, 0, 0.4);
  opacity: 0;
  transform: translateY(8px) scale(0.85);
  transition: all 0.35s var(--ease-spring);
}
.album:hover .fab,
.fab.on,
.fab:focus-visible {
  opacity: 1;
  transform: none;
}
b {
  font-size: 13.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
small {
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
