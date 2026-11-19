<script setup lang="ts">
// Bản local: dán link → máy tải mp3 bằng yt-dlp → tự đẩy lên doun.online
interface DlItem {
  link: string
  state: 'wait' | 'run' | 'done' | 'err'
  files: string[]
  msg: string
}
interface DlJob {
  id: string
  state: 'run' | 'push' | 'done' | 'err'
  items: DlItem[]
  msg: string
}

const lib = useLibrary()
const open = ref(false)
const links = ref('')
const error = ref('')
const job = ref<DlJob | null>(null)
const area = ref<HTMLTextAreaElement | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

const count = computed(() => links.value.split(/[\s,]+/).filter((s) => /^https?:\/\//.test(s)).length)
const busy = computed(() => !!job.value && (job.value.state === 'run' || job.value.state === 'push'))

onBeforeUnmount(() => timer && clearTimeout(timer))

function show() {
  open.value = true
  error.value = ''
  nextTick(() => area.value?.focus())
}
function hide() {
  open.value = false
}

async function submit() {
  error.value = ''
  if (!count.value) return (error.value = 'Dán ít nhất 1 link (bắt đầu bằng https://)')
  if (busy.value) return (error.value = 'Đang tải đợt trước, chờ chút nhé')
  try {
    job.value = await $fetch<DlJob>('/api/download', { method: 'POST', body: { links: links.value } })
    links.value = ''
    poll()
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || 'Không gửi được'
  }
}

async function poll() {
  if (timer) clearTimeout(timer)
  if (!job.value) return
  const prevDone = job.value.items.filter((i) => i.state === 'done').length
  try {
    job.value = await $fetch<DlJob>(`/api/download/${job.value.id}`)
  } catch {
    return
  }
  // Có bài mới tải xong → hiện ngay trong thư viện trên máy
  if (job.value.items.filter((i) => i.state === 'done').length > prevDone) lib.load(true)
  if (busy.value) timer = setTimeout(poll, 1500)
  else lib.load(true)
}

function label(i: DlItem) {
  return { wait: 'Chờ', run: 'Đang tải', done: 'Xong', err: 'Lỗi' }[i.state]
}
function short(link: string) {
  return link.replace(/^https?:\/\/(www\.|m\.)?/, '')
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') hide()
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit()
}
</script>

<template>
  <button class="ic" title="Thêm nhạc từ link" @click="show">
    <Icon name="link" :size="17" />
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
              <p>YouTube, TikTok, SoundCloud… Máy tải về rồi tự đưa lên doun.online.</p>
            </div>
            <button class="x" title="Đóng" @click="hide"><Icon name="close" :size="16" /></button>
          </header>

          <textarea
            ref="area"
            v-model="links"
            rows="4"
            placeholder="Mỗi dòng một link&#10;https://www.youtube.com/watch?v=…&#10;https://www.tiktok.com/@…/video/…"
          />

          <div class="row">
            <span class="hint">Ctrl + Enter để gửi</span>
            <button class="btn btn-primary" :disabled="busy || !count" @click="submit">
              <Icon name="plus" :size="15" />
              {{ busy ? 'Đang tải…' : count > 1 ? `Tải ${count} bài` : 'Tải về' }}
            </button>
          </div>

          <p v-if="error" class="msg bad">{{ error }}</p>

          <section v-if="job" class="job">
            <ul>
              <li v-for="(i, n) in job.items" :key="n" :class="i.state">
                <span class="pill">
                  <span v-if="i.state === 'run'" class="spin" />
                  {{ label(i) }}
                </span>
                <span class="t">
                  <b>{{ i.state === 'done' ? i.msg : short(i.link) }}</b>
                  <small v-if="i.state === 'err'">{{ i.msg }}</small>
                </span>
              </li>
            </ul>
            <p v-if="job.msg" class="msg" :class="{ run: job.state === 'push', ok: job.state === 'done', bad: job.state === 'err' }">
              <span v-if="job.state === 'push'" class="spin" /> {{ job.msg }}
            </p>
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
  padding: 10vh 16px 16px;
  background: color-mix(in srgb, var(--text) 28%, transparent);
  backdrop-filter: blur(3px);
}
.sheet {
  width: min(540px, 100%);
  max-height: 80vh;
  padding: 20px;
  display: flex;
  flex-direction: column;
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
textarea {
  width: 100%;
  min-height: 96px;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font: 12.5px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 10px 12px;
  outline: 0;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.hint {
  font-size: 12px;
  color: var(--text-3);
}
.btn:disabled {
  opacity: 0.6;
  pointer-events: none;
}
.job {
  border-top: 1px solid var(--line);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}
.job ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
  overflow: auto;
}
.job li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 10px;
  font-size: 13px;
}
.job li:hover {
  background: var(--surface-2);
}
.pill {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text-3);
}
.run .pill {
  background: var(--butter);
  color: var(--butter-deep);
}
.done .pill {
  background: var(--sage);
  color: var(--sage-deep);
}
.err .pill {
  background: var(--rose);
  color: var(--rose-deep);
}
.t {
  flex: 1;
  min-width: 0;
  display: grid;
}
.t b {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.t small {
  color: var(--rose-deep);
  font-size: 12px;
}
.msg {
  margin: 0;
  font-size: 13px;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
}
.msg.bad {
  background: var(--rose);
}
.msg.ok {
  background: var(--sage);
}
.msg.run {
  background: var(--butter);
}
.spin {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: rot 0.8s linear infinite;
  vertical-align: -1px;
}
@keyframes rot {
  to {
    transform: rotate(360deg);
  }
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
  .dot,
  .spin {
    animation: none;
  }
}
</style>
