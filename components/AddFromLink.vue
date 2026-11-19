<script setup lang="ts">
// Thêm nhạc bằng link (chỉ bản online): gửi link cho Worker → GitHub Actions tải về → tự deploy
interface Job {
  id: number
  title: string
  status: 'queued' | 'in_progress' | 'completed' | string
  conclusion: string | null
  createdAt: string
  url: string
}

const lib = useLibrary()
const open = ref(false)
const links = ref('')
const code = ref('')
const sending = ref(false)
const error = ref('')
const notice = ref('')
const jobs = ref<Job[]>([])
const area = ref<HTMLTextAreaElement | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null
let seenDone = new Set<number>()

const CODE_KEY = 'lulla:add-code'
const linkCount = computed(() => links.value.split(/[\s,]+/).filter((s) => /^https?:\/\//.test(s)).length)
const busy = computed(() => jobs.value.some((j) => j.status !== 'completed'))

onMounted(() => {
  code.value = localStorage.getItem(CODE_KEY) || ''
})
onBeforeUnmount(stopPoll)

function show() {
  open.value = true
  error.value = ''
  notice.value = ''
  if (code.value) refreshJobs(true)
  nextTick(() => area.value?.focus())
}
function hide() {
  open.value = false
}

async function submit() {
  error.value = ''
  notice.value = ''
  if (!code.value.trim()) return (error.value = 'Nhập mã thêm nhạc')
  if (!linkCount.value) return (error.value = 'Dán ít nhất 1 link (bắt đầu bằng https://)')
  sending.value = true
  try {
    const res = await $fetch<{ count: number }>('/api/add', {
      method: 'POST',
      body: { code: code.value.trim(), links: links.value },
    })
    localStorage.setItem(CODE_KEY, code.value.trim())
    notice.value = `Đã gửi ${res.count} link. Tải + deploy mất khoảng 2–4 phút, bài mới sẽ tự hiện.`
    links.value = ''
    // GitHub cần vài giây mới hiện lần chạy mới
    setTimeout(() => refreshJobs(true), 4000)
  } catch (e: any) {
    error.value = e?.data?.error || 'Gửi không được, thử lại sau'
    if (e?.status === 401) localStorage.removeItem(CODE_KEY)
  } finally {
    sending.value = false
  }
}

async function refreshJobs(first = false) {
  stopPoll()
  try {
    const list = await $fetch<Job[]>('/api/jobs', { headers: { 'x-add-code': code.value.trim() } })
    if (first) seenDone = new Set(list.filter((j) => j.status === 'completed').map((j) => j.id))
    // Lần chạy vừa xong thành công → nạp lại thư viện
    const fresh = list.filter((j) => j.status === 'completed' && !seenDone.has(j.id))
    fresh.forEach((j) => seenDone.add(j.id))
    if (fresh.some((j) => j.conclusion === 'success')) {
      // đợi Cloudflare nhận bản deploy mới
      setTimeout(() => lib.load(true), 5000)
      notice.value = 'Xong! Bài mới đã vào thư viện.'
    } else if (fresh.length) {
      error.value = 'Có lần thêm nhạc bị lỗi, bấm vào dòng đó để xem chi tiết.'
    }
    jobs.value = list
  } catch (e: any) {
    if (e?.status === 401) error.value = 'Sai mã thêm nhạc'
  }
  // Vẫn theo dõi khi đã đóng hộp, để bài mới tự hiện lúc xong
  if (jobs.value.some((j) => j.status !== 'completed')) timer = setTimeout(refreshJobs, 8000)
}
function stopPoll() {
  if (timer) clearTimeout(timer)
  timer = null
}

function label(j: Job) {
  if (j.status === 'queued') return 'Đang chờ'
  if (j.status !== 'completed') return 'Đang tải…'
  return j.conclusion === 'success' ? 'Xong' : j.conclusion === 'cancelled' ? 'Đã huỷ' : 'Lỗi'
}
function tone(j: Job) {
  if (j.status !== 'completed') return 'run'
  return j.conclusion === 'success' ? 'ok' : 'bad'
}
function shortTitle(t: string) {
  return t.replace(/^Thêm nhạc:\s*/, '').replace(/https?:\/\/(www\.)?/g, '')
}
function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'vừa xong'
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`
  return `${Math.floor(s / 86400)} ngày trước`
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') hide()
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
}
</script>

<template>
  <button class="ic" title="Thêm nhạc từ link" @click="show">
    <Icon name="plus" :size="18" />
    <span v-if="busy" class="dot" />
  </button>

  <Teleport to="body">
    <Transition name="pop">
      <div v-if="open" class="backdrop" @click.self="hide" @keydown="onKey">
        <div class="sheet card" role="dialog" aria-label="Thêm nhạc từ link">
          <header>
            <div class="badge"><Icon name="link" :size="18" /></div>
            <div>
              <h3>Thêm nhạc từ link</h3>
              <p>YouTube, TikTok, SoundCloud… mỗi dòng một link, tối đa 20.</p>
            </div>
            <button class="x" title="Đóng" @click="hide"><Icon name="close" :size="16" /></button>
          </header>

          <textarea
            v-model="links"
            ref="area"
            rows="5"
            placeholder="https://www.youtube.com/watch?v=…&#10;https://www.tiktok.com/@…/video/…"
          />

          <div class="row">
            <input v-model="code" type="password" placeholder="Mã thêm nhạc" autocomplete="current-password" />
            <button class="btn btn-primary" :disabled="sending" @click="submit">
              <Icon name="plus" :size="15" />
              {{ sending ? 'Đang gửi…' : linkCount > 1 ? `Thêm ${linkCount} bài` : 'Thêm' }}
            </button>
          </div>

          <p v-if="error" class="msg bad">{{ error }}</p>
          <p v-else-if="notice" class="msg ok">{{ notice }}</p>

          <section v-if="jobs.length" class="jobs">
            <div class="jobs-head">
              <span>Gần đây</span>
              <button class="link" @click="refreshJobs()"><Icon name="refresh" :size="13" /> Làm mới</button>
            </div>
            <a v-for="j in jobs" :key="j.id" :href="j.url" target="_blank" rel="noopener" class="job">
              <span class="pill" :class="tone(j)">{{ label(j) }}</span>
              <span class="t">{{ shortTitle(j.title) }}</span>
              <span class="when">{{ ago(j.createdAt) }}</span>
            </a>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ic {
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--text-2);
  transition:
    background 0.2s,
    color 0.2s,
    transform 0.3s var(--ease-spring);
}
.ic:hover {
  background: var(--surface);
  color: var(--text);
}
.ic:active {
  transform: scale(0.9);
}
.dot {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse {
  50% {
    transform: scale(0.6);
    opacity: 0.5;
  }
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: start center;
  padding: 12vh 16px 16px;
  background: color-mix(in srgb, var(--text) 28%, transparent);
  backdrop-filter: blur(3px);
}
.sheet {
  width: min(520px, 100%);
  padding: 20px;
  display: grid;
  gap: 14px;
}
header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.badge {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--peach);
  color: var(--peach-deep);
}
h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}
header p {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--text-3);
}
.x {
  margin-left: auto;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--text-3);
}
.x:hover {
  background: var(--surface-2);
  color: var(--text);
}
textarea,
input {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 13.5px;
  padding: 10px 12px;
  outline: 0;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
textarea {
  resize: vertical;
  min-height: 110px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  line-height: 1.6;
}
textarea:focus,
input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}
.row {
  display: flex;
  gap: 10px;
}
.row input {
  flex: 1;
  min-width: 0;
}
.row .btn {
  flex: none;
}
.btn:disabled {
  opacity: 0.6;
  pointer-events: none;
}
.msg {
  margin: 0;
  font-size: 13px;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
}
.msg.ok {
  background: var(--sage);
  color: var(--text);
}
.msg.bad {
  background: var(--rose);
  color: var(--text);
}
.jobs {
  display: grid;
  gap: 4px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
}
.jobs-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
}
.link {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
  color: var(--text-2);
}
.link:hover {
  color: var(--accent);
}
.job {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 10px;
  font-size: 12.5px;
  color: var(--text-2);
  text-decoration: none;
}
.job:hover {
  background: var(--surface-2);
}
.job .t {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.when {
  flex: none;
  color: var(--text-3);
  font-size: 11.5px;
}
.pill {
  flex: none;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
}
.pill.ok {
  background: var(--sage);
  color: var(--sage-deep);
}
.pill.bad {
  background: var(--rose);
  color: var(--rose-deep);
}
.pill.run {
  background: var(--butter);
  color: var(--butter-deep);
}

.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.25s var(--ease);
}
.pop-enter-active .sheet,
.pop-leave-active .sheet {
  transition: transform 0.35s var(--ease-spring);
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
}
.pop-enter-from .sheet,
.pop-leave-to .sheet {
  transform: translateY(12px) scale(0.97);
}
@media (prefers-reduced-motion: reduce) {
  .pop-enter-active .sheet,
  .pop-leave-active .sheet,
  .dot {
    transition: none;
    animation: none;
  }
}
</style>
