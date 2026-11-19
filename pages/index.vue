<script setup lang="ts">
const lib = useLibrary()
const p = usePlayer()
const stats = useStats()
const profile = useProfile()

const hour = new Date().getHours()
const greet = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })

// Bài nổi bật: đang phát, hoặc bài nghe gần nhất, hoặc bài đầu thư viện
const hero = computed(
  () => p.current.value || lib.byId.value.get(stats.recentIds.value[0] || '') || lib.tracks.value[0] || null,
)
function playHero() {
  if (!hero.value) return
  if (p.current.value?.id === hero.value.id) p.toggle()
  else p.playTrack(hero.value.id)
}
function shuffleLoved() {
  const ids = stats.loved.value.filter((id) => lib.byId.value.has(id))
  const list = ids.length ? ids : lib.tracks.value.map((t) => t.id)
  if (!list.length) return
  if (!p.shuffle.value) p.toggleShuffle()
  p.playList(list, Math.floor(Math.random() * list.length))
}

const goalPct = computed(() => Math.min(100, Math.round((stats.todayMin.value / stats.goalMin.value) * 100)))

const range = ref<'7d' | '8w'>('7d')
const chart = computed(() =>
  range.value === '7d'
    ? stats.dailyMinutes(7).map((d) => ({ label: d.date.toLocaleDateString('vi-VN', { weekday: 'short' }), value: d.min }))
    : stats.weeklyMinutes(8).map((d) => ({ label: `${d.date.getDate()}/${d.date.getMonth() + 1}`, value: d.min })),
)
const avgDay = computed(() => {
  const d = stats.dailyMinutes(7)
  return d.reduce((s, x) => s + x.min, 0) / 7
})

// Tỉ lệ thể loại: theo lượt nghe nếu đã có, không thì theo thư viện
const genreMix = computed(() => {
  const counts = new Map<string, number>()
  const plays = stats.playCount.value
  if (plays.size) {
    for (const [id, n] of plays) {
      const t = lib.byId.value.get(id)
      if (t) counts.set(t.genre, (counts.get(t.genre) || 0) + n)
    }
  } else for (const g of lib.genres.value) counts.set(g.name, g.count)
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, n]) => ({ name, pct: Math.round((n / total) * 100), color: lib.genreColor(name) }))
})

const recent = computed(() => stats.recentIds.value.map((id) => lib.byId.value.get(id)).filter(Boolean).slice(0, 6) as any[])
const newest = computed(() => [...lib.albums.value].sort((a, b) => Math.max(...b.tracks.map((t) => t.addedAt)) - Math.max(...a.tracks.map((t) => t.addedAt))).slice(0, 6))

const kpis = computed(() => [
  { label: 'Lượt nghe', value: stats.plays30.value, delta: pctChange(stats.plays30.value, stats.playsPrev30.value), note: 'so với 30 ngày trước', icon: 'music', bg: 'var(--sage)', fg: 'var(--sage-deep)' },
  { label: 'Bài yêu thích', value: stats.loved.value.length, note: `trên ${lib.tracks.value.length} bài`, icon: 'heart', bg: 'var(--rose)', fg: 'var(--rose-deep)' },
  { label: 'Giờ đã nghe', value: stats.hours30.value.toFixed(1), delta: pctChange(stats.hours30.value, stats.hoursPrev30.value), note: '30 ngày qua', icon: 'clock', bg: 'var(--butter)', fg: 'var(--butter-deep)' },
  { label: 'Chuỗi hiện tại', value: stats.streak.value, note: `ngày liên tiếp · kỷ lục ${stats.bestStreak.value}`, icon: 'flame', bg: 'var(--slate)', fg: 'var(--slate-deep)' },
])
</script>

<template>
  <div class="home">
    <header class="rise">
      <h1 class="h1">{{ greet }}, {{ profile.name.value }}</h1>
      <p class="sub">{{ today }} · {{ stats.loved.value.length }} bài yêu thích · {{ lib.albums.value.length }} album</p>
    </header>

    <EmptyLibrary v-if="lib.loaded.value && !lib.tracks.value.length" />

    <template v-else>
      <section class="top">
        <div class="hero card rise" style="animation-delay: 60ms">
          <div class="hero-txt">
            <div class="pill"><span class="live" :class="{ on: p.playing.value }" />{{ p.current.value ? 'Đang phát' : 'Gợi ý cho bạn' }}</div>
            <Transition name="fade-up" mode="out-in">
              <div :key="hero?.id || 'x'">
                <h2>{{ hero?.title || '…' }}</h2>
                <p class="by">{{ hero?.artist }} · {{ hero?.album }}</p>
              </div>
            </Transition>
            <div class="btns">
              <button class="btn btn-primary" @click="playHero">
                <Icon :name="p.playing.value && p.current.value?.id === hero?.id ? 'pause' : 'play'" :size="15" fill />
                {{ p.playing.value && p.current.value?.id === hero?.id ? 'Tạm dừng' : 'Phát' }}
              </button>
              <button class="btn btn-soft" @click="shuffleLoved"><Icon name="shuffle" :size="15" /> Trộn bài yêu thích</button>
            </div>
            <div class="goal">
              <svg viewBox="0 0 36 36" class="ring">
                <circle cx="18" cy="18" r="15.5" />
                <circle cx="18" cy="18" r="15.5" class="fg" :style="{ strokeDashoffset: 97.4 - (97.4 * goalPct) / 100 }" />
              </svg>
              <span class="ring-num">{{ goalPct }}%</span>
              <div>
                <b>{{ Math.round(stats.todayMin.value) }} phút hôm nay</b>
                <small>Mục tiêu {{ stats.goalMin.value }} phút/ngày</small>
              </div>
            </div>
          </div>
          <Vinyl :cover="coverUrl(hero)" :seed="hero?.title" :spinning="p.playing.value" :size="230" class="vinyl" />
        </div>

        <div class="kpis">
          <div v-for="(k, i) in kpis" :key="k.label" class="kpi rise" :style="{ background: k.bg, animationDelay: 100 + i * 60 + 'ms' }">
            <div class="kpi-ic" :style="{ color: k.fg }"><Icon :name="k.icon" :size="18" /></div>
            <small>{{ k.label }}</small>
            <b>{{ k.value }}</b>
            <span class="note">
              <em v-if="k.delta !== undefined" :class="{ down: k.delta < 0 }">{{ k.delta >= 0 ? '+' : '' }}{{ k.delta }}%</em>
              {{ k.note }}
            </span>
          </div>
        </div>
      </section>

      <section class="row2">
        <div class="card rise" style="animation-delay: 200ms">
          <div class="card-head">
            <div>
              <h3>Thời gian nghe</h3>
              <small>TB {{ Math.round(avgDay) }} phút/ngày trong 7 ngày qua</small>
            </div>
            <div class="seg">
              <button :class="{ on: range === '7d' }" @click="range = '7d'">7 ngày</button>
              <button :class="{ on: range === '8w' }" @click="range = '8w'">8 tuần</button>
            </div>
          </div>
          <BarChart :key="range" :data="chart" :goal="range === '7d' ? stats.goalMin.value : undefined" unit="p" />
        </div>

        <div class="card rise" style="animation-delay: 260ms">
          <div class="card-head">
            <div>
              <h3>Gu nhạc của bạn</h3>
              <small>{{ stats.playCount.value.size ? 'theo lượt nghe' : 'theo thư viện' }}</small>
            </div>
            <NuxtLink to="/stats" class="link">Thống kê →</NuxtLink>
          </div>
          <div class="stack">
            <span v-for="g in genreMix" :key="g.name" :style="{ flex: g.pct, background: g.color }" />
          </div>
          <ul class="mix">
            <li v-for="g in genreMix" :key="g.name">
              <span class="dot" :style="{ background: g.color }" />
              <span class="gname">{{ g.name }}</span>
              <span class="gbar"><i :style="{ width: g.pct + '%', background: g.color }" /></span>
              <b>{{ g.pct }}%</b>
            </li>
          </ul>
        </div>
      </section>

      <section v-if="recent.length" class="rise" style="animation-delay: 300ms">
        <h3 class="sec">Nghe gần đây</h3>
        <TrackTable :tracks="recent" :limit="6" />
      </section>

      <section class="rise" style="animation-delay: 340ms">
        <h3 class="sec">Album mới thêm</h3>
        <div class="albums">
          <AlbumCard v-for="a in newest" :key="a.key" :album="a" />
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 1280px;
}
.top {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
  gap: 16px;
}
.hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 26px 28px;
  background: linear-gradient(135deg, var(--peach), color-mix(in srgb, var(--peach) 55%, var(--butter)));
  overflow: hidden;
  min-height: 300px;
}
.hero-txt {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  z-index: 1;
}
.pill {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 700;
  padding: 5px 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 70%, transparent);
}
.live {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-3);
}
.live.on {
  background: var(--peach-deep);
  animation: blink 1.4s ease-in-out infinite;
}
@keyframes blink {
  50% {
    opacity: 0.3;
  }
}
.hero h2 {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin: 0;
  line-height: 1.1;
}
.by {
  margin: 6px 0 0;
  color: var(--text-2);
}
.btns {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 6px;
}
.goal {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}
.goal b {
  display: block;
  font-size: 13px;
}
.goal small {
  color: var(--text-2);
  font-size: 11.5px;
}
.ring {
  width: 46px;
  height: 46px;
  transform: rotate(-90deg);
}
.ring circle {
  fill: none;
  stroke: color-mix(in srgb, var(--surface) 70%, transparent);
  stroke-width: 3.5;
}
.ring .fg {
  stroke: var(--peach-deep);
  stroke-linecap: round;
  stroke-dasharray: 97.4;
  transition: stroke-dashoffset 1s var(--ease);
}
.ring-num {
  position: absolute;
  left: 0;
  width: 46px;
  text-align: center;
  font-size: 10.5px;
  font-weight: 800;
}
.vinyl {
  margin-right: 10px;
}
.kpis {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.kpi {
  border-radius: var(--radius-lg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: transform 0.35s var(--ease);
}
.kpi:hover {
  transform: translateY(-3px);
}
.kpi-ic {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--surface) 65%, transparent);
  margin-bottom: 8px;
}
.kpi small {
  font-size: 12px;
  color: var(--text-2);
  font-weight: 600;
}
.kpi b {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
}
.note {
  font-size: 11px;
  color: var(--text-2);
}
.note em {
  font-style: normal;
  font-weight: 700;
  color: var(--sage-deep);
}
.note em.down {
  color: var(--rose-deep);
}
.row2 {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
  gap: 16px;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 18px;
  gap: 10px;
}
.card-head h3 {
  margin: 0;
  font-size: 15px;
}
.card-head small {
  color: var(--text-3);
  font-size: 12px;
}
.seg {
  display: flex;
  background: var(--surface-2);
  border-radius: 999px;
  padding: 3px;
}
.seg button {
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  transition: all 0.25s var(--ease);
}
.seg button.on {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
}
.link {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-2);
}
.link:hover {
  color: var(--accent);
}
.stack {
  display: flex;
  gap: 4px;
  height: 12px;
  margin-bottom: 18px;
}
.stack span {
  border-radius: 6px;
  transition: flex 0.8s var(--ease);
}
.mix {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mix li {
  display: grid;
  grid-template-columns: 10px 90px 1fr 38px;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.gname {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gbar {
  height: 6px;
  border-radius: 6px;
  background: var(--surface-2);
  overflow: hidden;
}
.gbar i {
  display: block;
  height: 100%;
  border-radius: 6px;
  opacity: 0.75;
  transition: width 1s var(--ease);
}
.mix b {
  text-align: right;
  font-size: 12.5px;
}
.sec {
  font-size: 16px;
  margin: 6px 0 12px;
}
.albums {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}
.fade-up-enter-active,
.fade-up-leave-active {
  transition: all 0.35s var(--ease);
}
.fade-up-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
@media (max-width: 1100px) {
  .top,
  .row2 {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .hero {
    flex-direction: column-reverse;
    align-items: flex-start;
  }
  .vinyl {
    width: 170px !important;
    height: 170px !important;
    align-self: center;
  }
}
</style>
