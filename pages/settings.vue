<script setup lang="ts">
const profile = useProfile()
const stats = useStats()
const lib = useLibrary()
const theme = useTheme()
const { staticMode } = useRuntimeConfig().public

const name = ref(profile.name.value)
const goal = ref(stats.goalMin.value)
watch(name, (v) => profile.setName(v))
watch(goal, (v) => stats.setGoal(Math.max(5, Number(v) || 45)))

function exportData() {
  const blob = new Blob(
    [JSON.stringify({ sessions: stats.sessions.value, loved: stats.loved.value, goal: stats.goalMin.value }, null, 2)],
    { type: 'application/json' },
  )
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'lulla-stats.json'
  a.click()
  URL.revokeObjectURL(a.href)
}
function clearStats() {
  if (!confirm('Xoá toàn bộ lịch sử nghe? (Bài yêu thích vẫn giữ nguyên)')) return
  stats.sessions.value = []
  localStorage.removeItem('lulla:sessions')
}
</script>

<template>
  <div class="settings">
    <header class="rise">
      <h1 class="h1">Cài đặt</h1>
      <p class="sub">Mọi dữ liệu nghe nhạc chỉ nằm trên trình duyệt của bạn.</p>
    </header>

    <div class="card group rise" style="animation-delay: 60ms">
      <label>
        <span>Tên hiển thị</span>
        <input v-model="name" maxlength="40" />
      </label>
      <label>
        <span>Mục tiêu nghe mỗi ngày (phút)</span>
        <input v-model.number="goal" type="number" min="5" step="5" />
      </label>
      <label class="inline">
        <span>Giao diện tối</span>
        <button class="switch" :class="{ on: theme.dark.value }" @click="theme.toggle($event)"><i /></button>
      </label>
    </div>

    <div class="card group rise" style="animation-delay: 120ms">
      <h3>Thư viện nhạc</h3>
      <p class="muted">
        {{ lib.tracks.value.length }} bài · {{ lib.albums.value.length }} album · {{ fmtLong(lib.totalDuration.value) }}.
        Thư mục nhạc được đặt bằng biến môi trường <code>MUSIC_DIR</code> (mặc định <code>./music</code>).
      </p>
      <button class="btn btn-soft" @click="lib.load(true)"><Icon name="refresh" :size="15" /> Quét lại thư mục</button>
    </div>

    <div class="card group rise" style="animation-delay: 180ms">
      <h3>Dữ liệu thống kê</h3>
      <p class="muted">{{ stats.sessions.value.length }} phiên nghe · {{ stats.loved.value.length }} bài yêu thích</p>
      <div class="row">
        <button class="btn btn-soft" @click="exportData">Xuất JSON</button>
        <button class="btn btn-soft danger" @click="clearStats">Xoá lịch sử nghe</button>
      </div>
    </div>

    <div v-if="staticMode" class="card group rise" style="animation-delay: 210ms">
      <h3>Tài khoản</h3>
      <p class="muted">Đăng nhập được giữ 30 ngày trên thiết bị này.</p>
      <a class="btn btn-soft danger" href="/logout">Đăng xuất</a>
    </div>

    <div class="card group rise" style="animation-delay: 240ms">
      <h3>Phím tắt</h3>
      <ul class="keys">
        <li><kbd>Space</kbd> Phát / tạm dừng</li>
        <li><kbd>←</kbd> <kbd>→</kbd> Tua 5 giây</li>
        <li><kbd>Shift</kbd> + <kbd>←</kbd> <kbd>→</kbd> Bài trước / tiếp</li>
        <li><kbd>Ctrl/⌘</kbd> + <kbd>K</kbd> Tìm kiếm</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.settings {
  max-width: 720px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.group {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
h3 {
  margin: 0;
  font-size: 15px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
label.inline {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}
input {
  height: 40px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--bg);
  outline: 0;
  font-weight: 500;
  transition:
    border 0.2s,
    box-shadow 0.2s;
}
input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}
.switch {
  width: 46px;
  height: 26px;
  border-radius: 999px;
  background: var(--line);
  position: relative;
  transition: background 0.3s;
}
.switch i {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: transform 0.35s var(--ease-spring);
}
.switch.on {
  background: var(--accent);
}
.switch.on i {
  transform: translateX(20px);
}
.muted {
  margin: 0;
  color: var(--text-2);
  line-height: 1.6;
}
code {
  background: var(--surface-2);
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 12px;
}
.row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.danger {
  color: var(--rose-deep);
}
.keys {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
  color: var(--text-2);
}
kbd {
  font: 600 11.5px inherit;
  padding: 3px 8px;
  border-radius: 7px;
  background: var(--surface-2);
  color: var(--text);
  box-shadow: inset 0 -1px 0 var(--line);
}
</style>
