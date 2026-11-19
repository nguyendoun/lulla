<script setup lang="ts">
const lib = useLibrary()
const stats = useStats()
const p = usePlayer()

const tab = ref<'overview' | 'top'>('overview')

const weeks = computed(() =>
  stats.weeklyMinutes(9).map((w) => ({ label: `${w.date.getDate()}/${w.date.getMonth() + 1}`, value: w.min })),
)
const artistsHeard = computed(() => {
  const s = new Set<string>()
  for (const id of stats.playCount.value.keys()) {
    const t = lib.byId.value.get(id)
    if (t) s.add(t.artist)
  }
  return s.size
})
const avgDay = computed(() => {
  const d = stats.dailyMinutes(30)
  const active = d.filter((x) => x.min > 0).length || 1
  return d.reduce((s, x) => s + x.min, 0) / active
})

const topTracks = computed(() =>
  [...stats.playCount.value.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, n]) => ({ t: lib.byId.value.get(id), n }))
    .filter((x) => x.t),
)
const topArtists = computed(() => {
  const m = new Map<string, number>()
  for (const [id, n] of stats.playCount.value) {
    const t = lib.byId.value.get(id)
    if (t) m.set(t.artist, (m.get(t.artist) || 0) + n)
  }
  const arr = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const max = arr[0]?.[1] || 1
  return arr.map(([name, n]) => ({ name, n, pct: (n / max) * 100, cover: lib.tracks.value.find((t) => t.artist === name && t.hasCover) }))
})

const kpis = computed(() => [
  { label: 'Tổng lượt nghe', value: stats.playsTotal.value, bg: 'var(--sage)' },
  { label: 'Tổng giờ nghe', value: stats.hoursTotal.value.toFixed(1), bg: 'var(--peach)' },
  { label: 'Nghệ sĩ đã nghe', value: artistsHeard.value, bg: 'var(--butter)' },
  { label: 'TB mỗi ngày có nghe', value: fmtLong(avgDay.value * 60), bg: 'var(--slate)', small: true },
])
</script>

<template>
  <div class="stats">
    <header class="rise">
      <h1 class="h1">Thống kê</h1>
      <p class="sub">Từ {{ stats.sessions.value.length }} phiên nghe được lưu trên máy này</p>
    </header>

    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'overview' }" @click="tab = 'overview'">Tổng quan</button>
      <button class="tab" :class="{ active: tab === 'top' }" @click="tab = 'top'">Bảng xếp hạng</button>
    </div>

    <Transition name="tabfade" mode="out-in">
      <div v-if="tab === 'overview'" key="o" class="grid">
        <div class="kpis">
          <div v-for="(k, i) in kpis" :key="k.label" class="kpi rise" :style="{ background: k.bg, animationDelay: i * 60 + 'ms' }">
            <small>{{ k.label }}</small>
            <b :class="{ sm: k.small }">{{ k.value }}</b>
          </div>
        </div>

        <div class="card wide rise" style="animation-delay: 200ms">
          <div class="card-head">
            <div>
              <h3>9 tuần gần đây</h3>
              <small>Số phút nghe mỗi tuần</small>
            </div>
          </div>
          <AreaChart :data="weeks" unit=" phút" />
        </div>

        <div class="card rise" style="animation-delay: 260ms">
          <div class="card-head">
            <div>
              <h3>Bạn hay nghe lúc nào</h3>
              <small>Theo giờ trong ngày</small>
            </div>
          </div>
          <RadialHours :hours="stats.byHour.value" />
        </div>
      </div>

      <div v-else key="t" class="grid2">
        <div class="card rise">
          <h3>Top bài hát</h3>
          <ol class="top">
            <li v-for="(x, i) in topTracks" :key="x.t!.id" @click="p.playTrack(x.t!.id, topTracks.map((y) => y.t!.id))">
              <span class="rank" :class="'r' + i">{{ i + 1 }}</span>
              <Cover :src="coverUrl(x.t)" :seed="x.t!.title" :size="42" :radius="10" />
              <span class="txt"><b>{{ x.t!.title }}</b><small>{{ x.t!.artist }}</small></span>
              <span class="n">{{ x.n }} lượt</span>
            </li>
          </ol>
          <p v-if="!topTracks.length" class="empty">Nghe thêm vài bài để có bảng xếp hạng nhé.</p>
        </div>
        <div class="card rise" style="animation-delay: 80ms">
          <h3>Top nghệ sĩ</h3>
          <ul class="arts">
            <li v-for="a in topArtists" :key="a.name">
              <Cover :src="coverUrl(a.cover)" :seed="a.name" :size="36" :radius="999" />
              <div class="ab">
                <div class="row"><b>{{ a.name }}</b><small>{{ a.n }} lượt</small></div>
                <div class="bar"><i :style="{ width: a.pct + '%' }" /></div>
              </div>
            </li>
          </ul>
          <p v-if="!topArtists.length" class="empty">Chưa có dữ liệu.</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.stats {
  max-width: 1280px;
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr);
  gap: 16px;
}
.kpis {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.kpi {
  padding: 16px 18px;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: transform 0.35s var(--ease);
}
.kpi:hover {
  transform: translateY(-3px);
}
.kpi small {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.kpi b {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.03em;
}
.kpi b.sm {
  font-size: 22px;
}
.card-head {
  margin-bottom: 14px;
}
h3 {
  margin: 0 0 4px;
  font-size: 15px;
}
.card-head small {
  color: var(--text-3);
  font-size: 12px;
}
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.top {
  list-style: none;
  padding: 0;
  margin: 14px 0 0;
}
.top li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 14px;
  cursor: pointer;
  transition:
    background 0.2s,
    transform 0.3s var(--ease);
}
.top li:hover {
  background: var(--surface-2);
  transform: translateX(3px);
}
.rank {
  width: 22px;
  text-align: center;
  font-weight: 800;
  color: var(--text-3);
}
.rank.r0 {
  color: var(--peach-deep);
}
.rank.r1 {
  color: var(--butter-deep);
}
.rank.r2 {
  color: var(--sage-deep);
}
.txt {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.txt b,
.txt small {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.txt small,
.n {
  font-size: 12px;
  color: var(--text-2);
}
.arts {
  list-style: none;
  padding: 0;
  margin: 14px 0 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.arts li {
  display: flex;
  gap: 12px;
  align-items: center;
}
.ab {
  flex: 1;
  min-width: 0;
}
.ab .row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
}
.ab small {
  color: var(--text-2);
}
.bar {
  height: 6px;
  background: var(--surface-2);
  border-radius: 6px;
  overflow: hidden;
}
.bar i {
  display: block;
  height: 100%;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--peach-deep), var(--butter-deep));
  animation: growx 1s var(--ease) both;
  transform-origin: left;
}
@keyframes growx {
  from {
    transform: scaleX(0);
  }
}
.empty {
  color: var(--text-3);
  text-align: center;
  padding: 30px 0;
}
.tabfade-enter-active,
.tabfade-leave-active {
  transition: all 0.25s var(--ease);
}
.tabfade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.tabfade-leave-to {
  opacity: 0;
}
@media (max-width: 1000px) {
  .grid,
  .grid2 {
    grid-template-columns: 1fr;
  }
  .kpis {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
