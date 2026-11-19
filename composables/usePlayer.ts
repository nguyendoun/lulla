import { coverUrl, type Track } from './useLibrary'

type Repeat = 'off' | 'all' | 'one'

// Một <audio> duy nhất cho cả app (giống một chiếc máy hát đặt giữa phòng)
let audio: HTMLAudioElement | null = null
let fadeRaf = 0
let tickRaf = 0
let listened = 0 // giây đã nghe của phiên hiện tại
let sessionStart = 0
let lastTick = 0
let initialized = false

const KEY = 'lulla:player'

export function usePlayer() {
  const lib = useLibrary()
  const stats = useStats()

  const queue = useState<string[]>('p-queue', () => [])
  const index = useState('p-index', () => -1)
  const playing = useState('p-playing', () => false)
  const time = useState('p-time', () => 0)
  const duration = useState('p-duration', () => 0)
  const volume = useState('p-volume', () => 0.8)
  const muted = useState('p-muted', () => false)
  const shuffle = useState('p-shuffle', () => false)
  const repeat = useState<Repeat>('p-repeat', () => 'all')
  const buffering = useState('p-buffering', () => false)

  const current = computed<Track | null>(() => {
    const id = queue.value[index.value]
    return (id && lib.byId.value.get(id)) || null
  })

  // ---------- Âm lượng mượt (fade in/out) ----------
  const targetVolume = () => (muted.value ? 0 : volume.value ** 2) // đường cong tai người

  function fadeTo(to: number, ms: number) {
    return new Promise<void>((resolve) => {
      if (!audio) return resolve()
      cancelAnimationFrame(fadeRaf)
      const from = audio.volume
      const t0 = performance.now()
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / ms)
        const e = 1 - Math.pow(1 - k, 3)
        audio!.volume = Math.max(0, Math.min(1, from + (to - from) * e))
        if (k < 1) fadeRaf = requestAnimationFrame(step)
        else resolve()
      }
      fadeRaf = requestAnimationFrame(step)
    })
  }

  // ---------- Đồng hồ: cập nhật bằng rAF cho thanh tiến trình chạy mượt ----------
  function tick(t: number) {
    if (!audio) return
    time.value = audio.currentTime
    if (playing.value && !audio.paused) {
      if (lastTick) listened += Math.min(0.5, (t - lastTick) / 1000)
      lastTick = t
    } else lastTick = 0
    tickRaf = requestAnimationFrame(tick)
  }

  function commitSession() {
    const t = current.value
    if (t && listened > 0) stats.commit(t.id, listened, t.duration || duration.value, sessionStart)
    listened = 0
    sessionStart = Date.now()
  }

  function save() {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          queue: queue.value,
          index: index.value,
          time: audio?.currentTime ?? 0,
          volume: volume.value,
          shuffle: shuffle.value,
          repeat: repeat.value,
        }),
      )
    } catch {}
  }

  function init() {
    if (initialized || import.meta.server) return
    initialized = true
    audio = new Audio()
    audio.preload = 'auto'

    audio.addEventListener('loadedmetadata', () => (duration.value = audio!.duration))
    audio.addEventListener('waiting', () => (buffering.value = true))
    audio.addEventListener('playing', () => (buffering.value = false))
    audio.addEventListener('ended', () => next(true))
    audio.addEventListener('pause', () => (playing.value = false))
    audio.addEventListener('play', () => (playing.value = true))

    // Khôi phục phiên trước
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null')
      if (s) {
        volume.value = s.volume ?? 0.8
        shuffle.value = !!s.shuffle
        repeat.value = s.repeat || 'all'
        if (s.queue?.length) {
          queue.value = s.queue
          index.value = s.index
          watch(
            () => lib.loaded.value,
            (ok) => {
              if (ok && current.value) {
                load(current.value, false)
                audio!.currentTime = s.time || 0
              }
            },
            { immediate: true },
          )
        }
      }
    } catch {}

    audio.volume = targetVolume()
    watch([volume, muted], () => {
      if (audio) audio.volume = targetVolume()
    })
    setInterval(save, 4000)
    window.addEventListener('beforeunload', () => {
      commitSession()
      save()
    })
    tickRaf = requestAnimationFrame(tick)
    setupMediaSession()
  }

  function load(t: Track, autoplay = true) {
    if (!audio) return
    audio.src = t.src ?? `/api/stream/${t.id}`
    duration.value = t.duration
    time.value = 0
    sessionStart = Date.now()
    listened = 0
    updateMediaSession(t)
    if (autoplay) play(true)
  }

  async function play(fromStart = false) {
    if (!audio || !current.value) return
    if (!audio.src) load(current.value, false)
    audio.volume = fromStart ? targetVolume() : 0
    try {
      await audio.play()
      if (!fromStart) fadeTo(targetVolume(), 260)
    } catch {
      playing.value = false
    }
  }

  async function pause() {
    if (!audio) return
    await fadeTo(0, 180)
    audio.pause()
    audio.volume = targetVolume()
    save()
  }

  function toggle() {
    if (!current.value) {
      if (lib.tracks.value.length) playList(lib.tracks.value.map((t) => t.id), 0)
      return
    }
    playing.value ? pause() : play()
  }

  /** Phát một danh sách, bắt đầu từ vị trí start */
  function playList(ids: string[], start = 0) {
    commitSession()
    let list = [...ids]
    let i = start
    if (shuffle.value) {
      const first = list[start]
      list = shuffled(list.filter((_, k) => k !== start))
      list.unshift(first)
      i = 0
    }
    queue.value = list
    index.value = i
    const t = current.value
    if (t) load(t)
  }

  function playTrack(id: string, context?: string[]) {
    const list = context ?? lib.tracks.value.map((t) => t.id)
    const i = list.indexOf(id)
    playList(list, Math.max(0, i))
  }

  function next(auto = false) {
    if (!queue.value.length) return
    commitSession()
    if (auto && repeat.value === 'one') {
      audio!.currentTime = 0
      play(true)
      return
    }
    let i = index.value + 1
    if (i >= queue.value.length) {
      if (repeat.value === 'off' && auto) {
        playing.value = false
        return
      }
      i = 0
    }
    index.value = i
    load(current.value!)
  }

  function prev() {
    if (!audio || !queue.value.length) return
    // Như máy nghe nhạc thật: đã nghe > 3 giây thì quay về đầu bài
    if (audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    commitSession()
    index.value = (index.value - 1 + queue.value.length) % queue.value.length
    load(current.value!)
  }

  function seek(sec: number) {
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(sec, duration.value || 0))
    time.value = audio.currentTime
  }

  function toggleShuffle() {
    shuffle.value = !shuffle.value
    const cur = queue.value[index.value]
    if (!cur) return
    if (shuffle.value) {
      const rest = shuffled(queue.value.filter((id) => id !== cur))
      queue.value = [cur, ...rest]
      index.value = 0
    } else {
      // Bỏ trộn: về lại thứ tự thư viện
      const order = lib.tracks.value.map((t) => t.id).filter((id) => queue.value.includes(id))
      queue.value = order
      index.value = order.indexOf(cur)
    }
  }

  function cycleRepeat() {
    repeat.value = repeat.value === 'off' ? 'all' : repeat.value === 'all' ? 'one' : 'off'
  }

  // ---------- Media Session: điều khiển bằng phím media / màn hình khóa ----------
  function setupMediaSession() {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    ms.setActionHandler('play', () => play())
    ms.setActionHandler('pause', () => pause())
    ms.setActionHandler('nexttrack', () => next())
    ms.setActionHandler('previoustrack', () => prev())
    ms.setActionHandler('seekto', (d) => d.seekTime != null && seek(d.seekTime))
  }
  function updateMediaSession(t: Track) {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: t.artist,
      album: t.album,
      artwork: t.hasCover ? [{ src: coverUrl(t)!, sizes: '512x512' }] : [],
    })
  }

  return {
    init,
    queue,
    index,
    current,
    playing,
    time,
    duration,
    volume,
    muted,
    shuffle,
    repeat,
    buffering,
    play,
    pause,
    toggle,
    playList,
    playTrack,
    next,
    prev,
    seek,
    toggleShuffle,
    cycleRepeat,
  }
}

function shuffled<T>(arr: T[]) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
