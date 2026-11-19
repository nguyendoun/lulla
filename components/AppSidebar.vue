<script setup lang="ts">
const route = useRoute()
const stats = useStats()
const lib = useLibrary()
const profile = useProfile()

const nav = [
  { to: '/', label: 'Trang chủ', icon: 'home' },
  { to: '/library', label: 'Thư viện', icon: 'library', arrow: true },
  { to: '/loved', label: 'Yêu thích', icon: 'heart' },
  { to: '/stats', label: 'Thống kê', icon: 'stats', arrow: true },
  { to: '/settings', label: 'Cài đặt', icon: 'settings' },
]
const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))

const goalPct = computed(() => Math.min(100, Math.round((stats.todayMin.value / stats.goalMin.value) * 100)))
</script>

<template>
  <aside class="side">
    <div class="brand">
      <div class="logo"><Icon name="disc" :size="20" /></div>
      <div>
        <div class="name">Lulla</div>
        <div class="tag">Góc nghe nhạc của bạn</div>
      </div>
    </div>

    <div class="label">NGHE</div>
    <nav>
      <NuxtLink v-for="n in nav" :key="n.to" :to="n.to" class="item" :class="{ active: isActive(n.to) }">
        <Icon :name="n.icon" :size="17" />
        <span>{{ n.label }}</span>
        <span v-if="n.to === '/loved' && stats.loved.value.length" class="badge">{{ stats.loved.value.length }}</span>
        <Icon v-else-if="n.arrow" name="chevron" :size="14" class="arr" />
      </NuxtLink>
    </nav>

    <div class="spacer" />

    <div class="goal">
      <div class="goal-top">
        <Icon name="flame" :size="20" />
        <b>Mục tiêu hôm nay</b>
      </div>
      <div class="goal-num">
        {{ Math.round(stats.todayMin.value) }}<small> / {{ stats.goalMin.value }} phút</small>
      </div>
      <div class="bar"><span :style="{ width: goalPct + '%' }" /></div>
      <p>{{ goalPct >= 100 ? 'Xong rồi! Thưởng thêm một bài nữa nhé ☕' : 'Thêm vài bài cho một buổi chiều chill.' }}</p>
    </div>

    <NuxtLink to="/settings" class="me">
      <div class="avatar">{{ profile.initials.value }}</div>
      <div class="me-txt">
        <b>{{ profile.name.value }}</b>
        <small>{{ lib.tracks.value.length }} bài · {{ lib.albums.value.length }} album</small>
      </div>
    </NuxtLink>
  </aside>
</template>

<style scoped>
.side {
  background: var(--sage);
  border-radius: var(--radius-lg);
  padding: 18px 14px 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: background 0.4s var(--ease);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 6px 18px;
}
.logo {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--text);
  color: var(--sage);
}
.name {
  font-weight: 800;
  font-size: 17px;
  letter-spacing: -0.02em;
}
.tag {
  font-size: 11.5px;
  color: color-mix(in srgb, var(--text) 60%, transparent);
}
.label {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: color-mix(in srgb, var(--text) 50%, transparent);
  padding: 0 10px 8px;
}
nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  height: 40px;
  padding: 0 12px;
  border-radius: 12px;
  font-weight: 600;
  color: color-mix(in srgb, var(--text) 78%, transparent);
  transition:
    background 0.25s var(--ease),
    color 0.2s,
    transform 0.25s var(--ease);
}
.item:hover {
  background: color-mix(in srgb, var(--surface) 45%, transparent);
  transform: translateX(2px);
}
.item.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
}
.arr {
  margin-left: auto;
  opacity: 0.5;
}
.badge {
  margin-left: auto;
  font-size: 11px;
  background: var(--rose);
  color: var(--rose-deep);
  padding: 1px 8px;
  border-radius: 999px;
}
.spacer {
  flex: 1;
}
.goal {
  background: var(--peach);
  border-radius: var(--radius);
  padding: 14px;
  margin-bottom: 12px;
  color: var(--text);
}
.goal-top {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--peach-deep);
}
.goal-top b {
  color: var(--text);
  font-size: 13px;
}
.goal-num {
  font-size: 24px;
  font-weight: 800;
  margin: 8px 0 6px;
  letter-spacing: -0.02em;
}
.goal-num small {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.bar {
  height: 6px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface) 60%, transparent);
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
  border-radius: 6px;
  background: var(--peach-deep);
  transition: width 0.8s var(--ease);
}
.goal p {
  margin: 8px 0 0;
  font-size: 11.5px;
  color: var(--text-2);
  line-height: 1.4;
}
.me {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface) 55%, transparent);
  transition: background 0.2s;
}
.me:hover {
  background: var(--surface);
}
.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 12px;
  background: var(--butter);
  color: var(--butter-deep);
}
.me-txt {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.me-txt b {
  font-size: 13px;
}
.me-txt small {
  font-size: 11px;
  color: var(--text-2);
}
@media (max-width: 860px) {
  .side {
    display: none;
  }
}
</style>
