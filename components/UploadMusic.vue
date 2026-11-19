<script setup lang="ts">
// Tải file nhạc lên (chỉ bản online): Worker commit vào repo → CI deploy → bài tự hiện
interface Item {
  key: string
  file: File
  state: 'wait' | 'up' | 'done' | 'skip' | 'err'
  msg: string
}
interface Job {
  id: number
  status: string
  conclusion: string | null
  createdAt: string
}

const EXT = ['mp3', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wav', 'webm', 'amr', '3gp', '3ga', 'caf']
const MAX = 25 * 1024 * 1024

const lib = useLibrary()
// Dùng chung để nút ở trang khác (Thư viện) mở được hộp này
const open = useState('upload-open', () => false)
const items = ref<Item[]>([])
const dragging = ref(false)
const running = ref(false)
const error = ref('')
const deploying = ref(false) // đang chờ web cập nhật
const picker = ref<HTMLInputElement | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null
let startedAt = 0

const pending = computed(() => items.value.filter((i) => i.state === 'wait').length)
const uploaded = computed(() => items.value.filter((i) => i.state === 'done').length)

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  stopRec(true)
})

// ---------- Ghi âm thẳng trên web ----------
const canRecord = ref(false)
const recording = ref(false)
const recSec = ref(0)
let mr: MediaRecorder | null = null
let micStream: MediaStream | null = null
let chunks: Blob[] = []
let recTimer: ReturnType<typeof setInterval> | null = null
const MAX_REC_SEC = 30 * 60 // 30 phút, file vẫn dưới 25MB

onMounted(() => {
  canRecord.value = !!(navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined')
})

async function startRec() {
  error.value = ''
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  } catch {
    error.value = 'Không mở được micro. Hãy cho phép trình duyệt dùng micro rồi thử lại.'
    return
  }
  // Chrome/Android ghi webm, Safari/iPhone ghi mp4 (m4a)
  const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t))
  mr = new MediaRecorder(micStream, type ? { mimeType: type, audioBitsPerSecond: 96000 } : undefined)
  chunks = []
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  mr.onstop = finishRec
  mr.start(1000)
  recording.value = true
  recSec.value = 0
  recTimer = setInterval(() => {
    recSec.value++
    if (recSec.value >= MAX_REC_SEC) stopRec()
  }, 1000)
}

function stopRec(discard = false) {
  if (recTimer) clearInterval(recTimer)
  recTimer = null
  if (discard && mr) mr.onstop = null
  if (mr && mr.state !== 'inactive') mr.stop()
  micStream?.getTracks().forEach((t) => t.stop())
  micStream = null
  recording.value = false
}

const pad = (n: number) => String(n).padStart(2, '0')
function finishRec() {
  const mime = mr?.mimeType || 'audio/webm'
  mr = null
  if (!chunks.length) return
  const ext = mime.includes('mp4') ? 'm4a' : 'webm'
  const d = new Date()
  const name = `Ghi âm ${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}h${pad(d.getMinutes())}.${ext}`
  addFiles([new File(chunks, name, { type: mime })])
  chunks = []
}
const recClock = computed(() => `${pad(Math.floor(recSec.value / 60))}:${pad(recSec.value % 60)}`)

function show() {
  open.value = true
  error.value = ''
}
function hide() {
  if (running.value) return
  if (recording.value) stopRec() // vẫn giữ bản đã ghi trong danh sách
  open.value = false
}

function addFiles(list: FileList | File[] | null) {
  error.value = ''
  for (const f of Array.from(list || [])) {
    const ext = f.name.split('.').pop()?.toLowerCase() || ''
    const it: Item = { key: f.name + f.size + Math.random(), file: f, state: 'wait', msg: '' }
    if (!EXT.includes(ext)) Object.assign(it, { state: 'skip', msg: 'Không phải file nhạc' })
    else if (f.size > MAX) Object.assign(it, { state: 'skip', msg: 'Quá 25MB' })
    else if (items.value.some((i) => i.file.name === f.name && i.file.size === f.size)) continue
    items.value.push(it)
  }
}
function onDrop(e: DragEvent) {
  dragging.value = false
  addFiles(e.dataTransfer?.files || null)
}
function remove(it: Item) {
  items.value = items.value.filter((i) => i !== it)
}

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

async function start() {
  error.value = ''
  if (!pending.value) return (error.value = 'Chọn ít nhất 1 file nhạc')
  running.value = true
  startedAt = Date.now()
  let okCount = 0
  // Lần lượt từng file: mỗi file 1 commit, tránh GitHub báo xung đột
  for (const it of items.value) {
    if (it.state !== 'wait') continue
    it.state = 'up'
    it.msg = 'Đang tải lên…'
    try {
      const body = await toBase64(it.file)
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
          'x-filename': encodeURIComponent(it.file.name),
        },
        body,
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        // hết phiên đăng nhập
        window.location.href = '/login?next=' + encodeURIComponent(location.pathname)
        return
      }
      if (res.ok) {
        it.state = 'done'
        it.msg = 'Đã lên'
        okCount++
      } else {
        it.state = res.status === 409 ? 'skip' : 'err'
        it.msg = data.error || `Lỗi ${res.status}`
      }
    } catch {
      it.state = 'err'
      it.msg = 'Mất kết nối'
    }
  }
  running.value = false
  if (okCount) {
    deploying.value = true
    watchDeploy()
  }
}

// Theo dõi CI cho tới khi bản deploy mới xong → nạp lại thư viện
async function watchDeploy() {
  if (timer) clearTimeout(timer)
  try {
    const jobs = await $fetch<Job[]>('/api/jobs')
    const mine = jobs.filter((j) => new Date(j.createdAt).getTime() >= startedAt - 60_000)
    const last = mine[0]
    if (last && last.status === 'completed' && !mine.some((j) => j.status !== 'completed')) {
      deploying.value = false
      if (last.conclusion === 'success') {
        await new Promise((r) => setTimeout(r, 4000))
        await lib.load(true)
        items.value = items.value.filter((i) => i.state !== 'done')
      } else error.value = 'Cập nhật web bị lỗi, xem tab Actions trên GitHub'
      return
    }
  } catch {}
  timer = setTimeout(watchDeploy, 8000)
}

function size(n: number) {
  return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'
}
</script>

<template>
  <button class="up-btn" title="Tải nhạc / ghi âm lên" @click="show">
    <Icon name="upload" :size="16" />
    <span class="up-label">Tải lên</span>
    <span v-if="running || deploying" class="dot" />
  </button>

  <Teleport to="body">
    <Transition name="pop">
      <div v-if="open" class="backdrop" @click.self="hide" @keydown.esc="hide">
        <div class="sheet card" role="dialog" aria-label="Tải nhạc lên">
          <header>
            <div class="badge"><Icon name="upload" :size="18" /></div>
            <div>
              <h3>Tải nhạc lên</h3>
              <p>Nhạc hoặc ghi âm điện thoại (mp3, m4a, amr, 3gp…), tối đa 25MB mỗi file</p>
            </div>
            <button class="x" title="Đóng" :disabled="running" @click="hide"><Icon name="close" :size="16" /></button>
          </header>

          <label
            class="drop"
            :class="{ on: dragging }"
            @dragover.prevent="dragging = true"
            @dragleave="dragging = false"
            @drop.prevent="onDrop"
          >
            <input ref="picker" type="file" multiple accept="audio/*,.mp3,.m4a,.aac,.flac,.ogg,.opus,.wav,.webm,.amr,.3gp,.3ga,.caf" @change="addFiles(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''" />
            <Icon name="music" :size="22" />
            <b>Kéo thả file vào đây</b>
            <span>hoặc bấm để chọn từ máy</span>
          </label>

          <div v-if="canRecord" class="rec" :class="{ on: recording }">
            <template v-if="!recording">
              <button class="btn btn-soft" :disabled="running" @click="startRec"><Icon name="mic" :size="15" /> Ghi âm</button>
              <span class="rec-hint">Ghi bằng micro rồi tải lên luôn</span>
            </template>
            <template v-else>
              <span class="rec-dot" />
              <b class="rec-time">{{ recClock }}</b>
              <span class="rec-hint">Đang ghi âm…</span>
              <button class="btn btn-primary" @click="stopRec()"><Icon name="stop" :size="13" /> Dừng</button>
            </template>
          </div>

          <ul v-if="items.length" class="list">
            <li v-for="it in items" :key="it.key" :class="it.state">
              <span class="ico">
                <Icon v-if="it.state === 'done'" name="check" :size="14" />
                <span v-else-if="it.state === 'up'" class="spin" />
                <Icon v-else name="music" :size="14" />
              </span>
              <span class="name">{{ it.file.name }}</span>
              <span class="meta">{{ it.msg || size(it.file.size) }}</span>
              <button v-if="it.state === 'wait' && !running" class="rm" title="Bỏ" @click="remove(it)">
                <Icon name="close" :size="13" />
              </button>
            </li>
          </ul>

          <div class="row">
            <button class="btn btn-primary" :disabled="running || recording || !pending" @click="start">
              <Icon name="upload" :size="15" />
              {{ running ? 'Đang tải…' : pending > 1 ? `Tải ${pending} bài` : 'Tải lên' }}
            </button>
          </div>

          <p v-if="error" class="msg bad">{{ error }}</p>
          <p v-else-if="deploying" class="msg run">
            <span class="spin" /> Đã lên {{ uploaded }} bài, web đang cập nhật (~2 phút). Đóng hộp này cũng được, xong bài sẽ tự hiện.
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.up-btn {
  position: relative;
  height: 38px;
  padding: 0 14px 0 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-weight: 700;
  font-size: 13px;
  background: var(--accent);
  color: var(--accent-ink);
  box-shadow: 0 6px 16px -8px var(--accent);
  transition: transform 0.3s var(--ease-spring);
}
.up-btn:hover {
  transform: translateY(-1px);
}
.up-btn:active {
  transform: scale(0.94);
}
@media (max-width: 520px) {
  /* điện thoại hẹp: chỉ icon, vẫn nổi bật nhờ nền cam */
  .up-btn {
    width: 38px;
    padding: 0;
    justify-content: center;
  }
  .up-label {
    display: none;
  }
}
.dot {
  position: absolute;
  top: 2px;
  right: 2px;
  box-shadow: 0 0 0 2px var(--bg);
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
  width: min(520px, 100%);
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
.drop {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 22px 12px;
  border: 2px dashed var(--line);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--text-3);
  cursor: pointer;
  text-align: center;
  transition:
    border-color 0.2s,
    background 0.2s,
    transform 0.3s var(--ease-spring);
}
.drop b {
  color: var(--text);
  font-size: 14px;
  margin-top: 4px;
}
.drop span {
  font-size: 12.5px;
}
.drop:hover,
.drop.on {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 7%, var(--bg));
}
.drop.on {
  transform: scale(1.01);
}
.drop input {
  display: none;
}
.rec {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 8px;
  border-radius: var(--radius);
  background: var(--surface-2);
  transition: background 0.25s;
}
.rec.on {
  background: var(--rose);
}
.rec-hint {
  flex: 1;
  font-size: 12.5px;
  color: var(--text-3);
}
.rec.on .rec-hint {
  color: var(--text-2);
}
.rec-time {
  font-variant-numeric: tabular-nums;
  font-size: 15px;
}
.rec-dot {
  width: 10px;
  height: 10px;
  margin-left: 6px;
  border-radius: 50%;
  background: var(--rose-deep);
  animation: pulse 1.2s ease-in-out infinite;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: auto;
  display: grid;
  gap: 2px;
  min-height: 0;
}
.list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 10px;
  font-size: 13px;
}
.list li:hover {
  background: var(--surface-2);
}
.ico {
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--surface-2);
  color: var(--text-3);
}
.done .ico {
  background: var(--sage);
  color: var(--sage-deep);
}
.err .ico,
.skip .ico {
  background: var(--rose);
  color: var(--rose-deep);
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  flex: none;
  font-size: 11.5px;
  color: var(--text-3);
}
.err .meta,
.skip .meta {
  color: var(--rose-deep);
}
.done .meta {
  color: var(--sage-deep);
  font-weight: 600;
}
.rm {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--text-3);
}
.rm:hover {
  background: var(--surface);
  color: var(--text);
}
.spin {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: rot 0.8s linear infinite;
  vertical-align: -2px;
}
@keyframes rot {
  to {
    transform: rotate(360deg);
  }
}
.row {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.row input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font: inherit;
  font-size: 13.5px;
  padding: 10px 12px;
  outline: 0;
}
.row input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
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
.msg.bad {
  background: var(--rose);
}
.msg.run {
  background: var(--butter);
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
  .rec-dot,
  .spin {
    animation: none;
  }
}
</style>
