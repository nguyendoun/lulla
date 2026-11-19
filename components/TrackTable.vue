<script setup lang="ts">
import type { Track } from '~/composables/useLibrary'

const props = withDefaults(defineProps<{ tracks: Track[]; showAlbum?: boolean; limit?: number }>(), {
  showAlbum: true,
  limit: 0,
})
const p = usePlayer()
const stats = useStats()

// Hiện dần theo trang để danh sách dài vẫn cuộn mượt
const shown = ref(80)
const visible = computed(() => props.tracks.slice(0, props.limit || shown.value))
const sentinel = ref<HTMLElement | null>(null)
let io: IntersectionObserver | null = null
onMounted(() => {
  io = new IntersectionObserver((e) => {
    if (e[0].isIntersecting && shown.value < props.tracks.length) shown.value += 80
  })
  if (sentinel.value) io.observe(sentinel.value)
})
onBeforeUnmount(() => io?.disconnect())
watch(
  () => props.tracks,
  () => (shown.value = 80),
)

const ids = computed(() => props.tracks.map((t) => t.id))
const isCurrent = (t: Track) => p.current.value?.id === t.id
</script>

<template>
  <div class="tt card">
    <div class="row head" :class="{ noalbum: !showAlbum }">
      <span>#</span>
      <span>Tên bài</span>
      <span v-if="showAlbum" class="hide-sm">Album</span>
      <span class="r hide-sm">Lượt nghe</span>
      <span />
      <span class="r"><Icon name="clock" :size="14" /></span>
    </div>
    <TransitionGroup name="list" tag="div">
      <div
        v-for="(t, i) in visible"
        :key="t.id"
        class="row"
        :class="{ cur: isCurrent(t), noalbum: !showAlbum }"
        :style="{ animationDelay: Math.min(i, 14) * 22 + 'ms' }"
        @dblclick="p.playTrack(t.id, ids)"
      >
        <span class="num">
          <span v-if="isCurrent(t) && p.playing.value" class="bars"><i /><i /><i /></span>
          <span v-else class="n">{{ i + 1 }}</span>
          <button class="play" :title="`Phát ${t.title}`" @click="isCurrent(t) ? p.toggle() : p.playTrack(t.id, ids)">
            <Icon :name="isCurrent(t) && p.playing.value ? 'pause' : 'play'" :size="14" fill />
          </button>
        </span>
        <span class="main">
          <Cover :src="coverUrl(t)" :seed="t.title" :size="40" :radius="9" />
          <span class="txt">
            <b>{{ t.title }}</b>
            <small>{{ t.artist }}</small>
          </span>
        </span>
        <span v-if="showAlbum" class="muted hide-sm ell">{{ t.album }}</span>
        <span class="r muted hide-sm">{{ stats.playCount.value.get(t.id) || 0 }}</span>
        <button class="love" :class="{ on: stats.lovedSet.value.has(t.id) }" @click="stats.toggleLove(t.id)">
          <Icon name="heart" :size="15" :fill="stats.lovedSet.value.has(t.id)" />
        </button>
        <span class="r muted tab">{{ fmtTime(t.duration) }}</span>
      </div>
    </TransitionGroup>
    <div ref="sentinel" style="height: 1px" />
    <p v-if="!tracks.length" class="empty">Không có bài nào ở đây.</p>
  </div>
</template>

<style scoped>
.tt {
  padding: 8px;
}
.row {
  display: grid;
  grid-template-columns: 44px minmax(0, 2fr) minmax(0, 1.3fr) 80px 36px 60px;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  border-radius: 14px;
  transition: background 0.2s;
  animation: rise 0.5s var(--ease) both;
}
.row.noalbum {
  grid-template-columns: 44px minmax(0, 2fr) 80px 36px 60px;
}
.row.head {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  padding-bottom: 10px;
  margin-bottom: 4px;
  animation: none;
}
.row:not(.head):hover {
  background: var(--surface-2);
}
.row.cur {
  background: color-mix(in srgb, var(--peach) 55%, transparent);
}
.row.cur b {
  color: var(--peach-deep);
}
.num {
  position: relative;
  display: grid;
  place-items: center;
  height: 32px;
  color: var(--text-3);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}
.play {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--text);
  opacity: 0;
  transform: scale(0.7);
  transition: all 0.2s var(--ease-spring);
}
.row:hover .play {
  opacity: 1;
  transform: none;
}
.row:hover .n,
.row:hover .bars {
  opacity: 0;
}
.bars {
  display: flex;
  gap: 2px;
  align-items: flex-end;
  height: 12px;
}
.bars i {
  width: 3px;
  background: var(--accent);
  border-radius: 2px;
  animation: eq 0.8s ease-in-out infinite alternate;
}
.bars i:nth-child(2) {
  animation-delay: -0.4s;
}
.bars i:nth-child(3) {
  animation-delay: -0.2s;
}
@keyframes eq {
  from {
    height: 3px;
  }
  to {
    height: 12px;
  }
}
.main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.txt {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.txt b,
.txt small,
.ell {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.txt b {
  font-weight: 600;
  font-size: 13.5px;
  transition: color 0.2s;
}
.txt small {
  font-size: 12px;
  color: var(--text-2);
}
.muted {
  color: var(--text-2);
  font-size: 12.5px;
}
.r {
  text-align: right;
  justify-self: end;
}
.tab {
  font-variant-numeric: tabular-nums;
}
.love {
  color: var(--text-3);
  display: grid;
  place-items: center;
  transition:
    color 0.2s,
    transform 0.3s var(--ease-spring);
}
.love:hover {
  transform: scale(1.15);
}
.love.on {
  color: var(--rose-deep);
}
.empty {
  text-align: center;
  color: var(--text-3);
  padding: 40px 0;
}
.list-leave-active {
  transition: all 0.25s var(--ease);
  position: absolute;
  opacity: 0;
}
.list-move {
  transition: transform 0.4s var(--ease);
}
@media (max-width: 860px) {
  .row,
  .row.noalbum {
    grid-template-columns: 32px minmax(0, 1fr) 30px 44px;
  }
  .hide-sm {
    display: none;
  }
}
</style>
