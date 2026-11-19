<script setup lang="ts">
const p = usePlayer()
const stats = useStats()
const preview = ref<number | null>(null)

const t = computed(() => p.current.value)
const shownTime = computed(() => preview.value ?? p.time.value)
const loved = computed(() => !!t.value && stats.lovedSet.value.has(t.value.id))
</script>

<template>
  <div class="bar" :class="{ empty: !t }">
    <div class="now">
      <Transition name="swap-cover" mode="out-in">
        <Cover :key="t?.id || 'none'" :src="coverUrl(t)" :seed="t?.title || ''" :size="52" :radius="12" />
      </Transition>
      <div class="meta">
        <Transition name="swap-text" mode="out-in">
          <div :key="t?.id || 'none'">
            <b class="title">{{ t?.title || 'Chưa phát bài nào' }}</b>
            <small>{{ t?.artist || 'Chọn một bài để bắt đầu' }}</small>
          </div>
        </Transition>
      </div>
      <button v-if="t" class="love" :class="{ on: loved }" title="Yêu thích" @click="stats.toggleLove(t.id)">
        <Icon name="heart" :size="17" :fill="loved" />
      </button>
    </div>

    <div class="center">
      <div class="ctrls">
        <button class="ic sm" :class="{ on: p.shuffle.value }" title="Trộn bài" @click="p.toggleShuffle()">
          <Icon name="shuffle" :size="16" />
        </button>
        <button class="ic" title="Bài trước (Shift+←)" @click="p.prev()"><Icon name="prev" :size="18" fill /></button>
        <button class="playbtn" :class="{ loading: p.buffering.value && p.playing.value }" title="Phát/Dừng (Space)" @click="p.toggle()">
          <Transition name="pp" mode="out-in">
            <Icon :key="String(p.playing.value)" :name="p.playing.value ? 'pause' : 'play'" :size="18" fill />
          </Transition>
        </button>
        <button class="ic" title="Bài tiếp (Shift+→)" @click="p.next()"><Icon name="next" :size="18" fill /></button>
        <button class="ic sm rep" :class="{ on: p.repeat.value !== 'off' }" :title="`Lặp: ${p.repeat.value}`" @click="p.cycleRepeat()">
          <Icon name="repeat" :size="16" />
          <i v-if="p.repeat.value === 'one'">1</i>
        </button>
      </div>
      <div class="seek">
        <span>{{ fmtTime(shownTime) }}</span>
        <Slider :value="p.time.value" :max="p.duration.value" @preview="preview = $event" @change="p.seek($event)" />
        <span>{{ fmtTime(p.duration.value) }}</span>
      </div>
    </div>

    <div class="right">
      <div class="eq" :class="{ on: p.playing.value }"><i /><i /><i /><i /></div>
      <button class="ic sm" :title="p.muted.value ? 'Bật tiếng' : 'Tắt tiếng'" @click="p.muted.value = !p.muted.value">
        <Icon :name="p.muted.value || p.volume.value === 0 ? 'mute' : 'volume'" :size="17" />
      </button>
      <Slider class="vol" :value="p.muted.value ? 0 : p.volume.value" :max="1" live @change="(v) => { p.volume.value = v; p.muted.value = false }" />
    </div>
  </div>
</template>

<style scoped>
.bar {
  position: fixed;
  left: calc(var(--sidebar-w) + 36px);
  right: 24px;
  bottom: 18px;
  height: var(--player-h);
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 1.5fr) minmax(0, 1fr);
  align-items: center;
  gap: 20px;
  padding: 0 18px 0 16px;
  border-radius: 24px;
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  backdrop-filter: blur(18px) saturate(1.3);
  -webkit-backdrop-filter: blur(18px) saturate(1.3);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--line) 70%, transparent),
    0 20px 40px -20px rgba(60, 30, 10, 0.35);
  z-index: 50;
  transition:
    transform 0.5s var(--ease),
    background 0.4s;
}
.now {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.meta {
  min-width: 0;
}
.title,
.meta small {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.title {
  font-size: 14px;
}
.meta small {
  color: var(--text-2);
  font-size: 12px;
  margin-top: 2px;
}
.love {
  color: var(--text-3);
  padding: 6px;
  transition:
    color 0.2s,
    transform 0.35s var(--ease-spring);
}
.love.on {
  color: var(--rose-deep);
  animation: pop 0.4s var(--ease-spring);
}
@keyframes pop {
  50% {
    transform: scale(1.35);
  }
}
.center {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ctrls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}
.ic {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--text-2);
  transition:
    color 0.2s,
    background 0.2s,
    transform 0.25s var(--ease-spring);
}
.ic:hover {
  color: var(--text);
  background: var(--surface-2);
}
.ic:active {
  transform: scale(0.88);
}
.ic.on {
  color: var(--accent);
}
.ic.on::after {
  content: '';
  position: absolute;
  bottom: 2px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}
.rep i {
  position: absolute;
  font: 800 8px/1 inherit;
  font-style: normal;
  top: 13px;
}
.playbtn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--accent);
  color: var(--accent-ink);
  box-shadow: 0 8px 18px -8px var(--accent);
  transition: transform 0.3s var(--ease-spring);
}
.playbtn:hover {
  transform: scale(1.07);
}
.playbtn:active {
  transform: scale(0.92);
}
.playbtn.loading {
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse {
  50% {
    box-shadow: 0 0 0 8px color-mix(in srgb, var(--accent) 20%, transparent);
  }
}
.seek {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}
.seek .slider {
  flex: 1;
}
.right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}
.vol {
  width: 100px;
}
/* Mini equalizer nhảy theo nhạc */
.eq {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 14px;
  margin-right: 8px;
}
.eq i {
  width: 3px;
  height: 3px;
  border-radius: 2px;
  background: var(--accent);
  transition: height 0.3s;
}
.eq.on i {
  animation: eq 0.9s ease-in-out infinite alternate;
}
.eq.on i:nth-child(2) {
  animation-delay: -0.3s;
}
.eq.on i:nth-child(3) {
  animation-delay: -0.6s;
}
.eq.on i:nth-child(4) {
  animation-delay: -0.15s;
}
@keyframes eq {
  0% {
    height: 3px;
  }
  100% {
    height: 14px;
  }
}

/* Chuyển bài: bìa trượt + mờ, chữ lướt lên */
.swap-cover-enter-active,
.swap-cover-leave-active {
  transition: all 0.35s var(--ease);
}
.swap-cover-enter-from {
  opacity: 0;
  transform: translateX(10px) scale(0.9);
}
.swap-cover-leave-to {
  opacity: 0;
  transform: translateX(-10px) scale(0.9);
}
.swap-text-enter-active,
.swap-text-leave-active {
  transition: all 0.3s var(--ease);
}
.swap-text-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.swap-text-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.pp-enter-active,
.pp-leave-active {
  transition: all 0.18s var(--ease);
}
.pp-enter-from,
.pp-leave-to {
  opacity: 0;
  transform: scale(0.5);
}

@media (max-width: 860px) {
  .bar {
    left: 8px;
    right: 8px;
    bottom: 8px;
    grid-template-columns: 1fr auto;
    height: auto;
    padding: 10px 12px;
    gap: 8px 12px;
  }
  .center {
    display: contents;
  }
  .ctrls {
    grid-column: 2;
    grid-row: 1;
  }
  .ctrls .sm {
    display: none;
  }
  .seek {
    grid-column: 1 / -1;
  }
  .right {
    display: none;
  }
}
</style>
