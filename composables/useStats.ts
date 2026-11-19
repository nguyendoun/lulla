// Lưu lịch sử nghe + bài yêu thích trong localStorage (dữ liệu chỉ ở máy bạn)
export interface Session {
  id: string // track id
  at: number // thời điểm bắt đầu nghe (ms)
  sec: number // số giây thực sự đã nghe
  counted: boolean // đủ điều kiện tính là 1 lượt nghe
}

const KEY_SESSIONS = 'lulla:sessions'
const KEY_LOVED = 'lulla:loved'
const KEY_GOAL = 'lulla:goal'

function read<T>(key: string, fallback: T): T {
  if (import.meta.server) return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* hết dung lượng hoặc chế độ riêng tư */
  }
}

const DAY = 86_400_000

function startOfDay(t: number) {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function useStats() {
  const sessions = useState<Session[]>('sessions', () => read(KEY_SESSIONS, []))
  const loved = useState<string[]>('loved', () => read(KEY_LOVED, []))
  const goalMin = useState<number>('goal', () => read(KEY_GOAL, 45))

  function commit(id: string, sec: number, duration: number, at: number) {
    if (sec < 3) return
    const counted = sec >= Math.min(30, duration * 0.5)
    sessions.value = [...sessions.value, { id, at, sec: Math.round(sec), counted }].slice(-5000)
    write(KEY_SESSIONS, sessions.value)
  }

  const lovedSet = computed(() => new Set(loved.value))
  function toggleLove(id: string) {
    loved.value = lovedSet.value.has(id) ? loved.value.filter((x) => x !== id) : [...loved.value, id]
    write(KEY_LOVED, loved.value)
  }
  function setGoal(min: number) {
    goalMin.value = min
    write(KEY_GOAL, min)
  }

  // ---------- Số liệu tổng hợp ----------
  const now = () => Date.now()

  function inRange(from: number, to = now()) {
    return sessions.value.filter((s) => s.at >= from && s.at < to)
  }
  const sumSec = (list: Session[]) => list.reduce((a, s) => a + s.sec, 0)
  const countPlays = (list: Session[]) => list.filter((s) => s.counted).length

  const playsTotal = computed(() => countPlays(sessions.value))
  const hoursTotal = computed(() => sumSec(sessions.value) / 3600)

  const plays30 = computed(() => countPlays(inRange(now() - 30 * DAY)))
  const playsPrev30 = computed(() => countPlays(inRange(now() - 60 * DAY, now() - 30 * DAY)))
  const hours30 = computed(() => sumSec(inRange(now() - 30 * DAY)) / 3600)
  const hoursPrev30 = computed(() => sumSec(inRange(now() - 60 * DAY, now() - 30 * DAY)) / 3600)

  const todayMin = computed(() => sumSec(inRange(startOfDay(now()))) / 60)

  /** Phút nghe mỗi ngày trong N ngày gần nhất (cũ → mới) */
  function dailyMinutes(days: number) {
    const today = startOfDay(now())
    return Array.from({ length: days }, (_, i) => {
      const from = today - (days - 1 - i) * DAY
      return { date: new Date(from), min: sumSec(inRange(from, from + DAY)) / 60 }
    })
  }

  /** Phút nghe mỗi tuần trong N tuần gần nhất */
  function weeklyMinutes(weeks: number) {
    const today = startOfDay(now()) + DAY
    return Array.from({ length: weeks }, (_, i) => {
      const to = today - (weeks - 1 - i) * 7 * DAY
      const from = to - 7 * DAY
      return { date: new Date(from), min: sumSec(inRange(from, to)) / 60 }
    })
  }

  /** Số phút nghe theo giờ trong ngày (0–23) */
  const byHour = computed(() => {
    const arr = Array(24).fill(0)
    for (const s of sessions.value) arr[new Date(s.at).getHours()] += s.sec / 60
    return arr as number[]
  })

  /** Chuỗi ngày nghe liên tiếp (tính đến hôm nay hoặc hôm qua) */
  const streak = computed(() => {
    const days = new Set(sessions.value.map((s) => startOfDay(s.at)))
    let d = startOfDay(now())
    if (!days.has(d)) d -= DAY
    let n = 0
    while (days.has(d)) {
      n++
      d -= DAY
    }
    return n
  })

  const bestStreak = computed(() => {
    const days = [...new Set(sessions.value.map((s) => startOfDay(s.at)))].sort((a, b) => a - b)
    let best = 0
    let cur = 0
    for (let i = 0; i < days.length; i++) {
      cur = i && Math.round((days[i] - days[i - 1]) / DAY) === 1 ? cur + 1 : 1
      best = Math.max(best, cur)
    }
    return best
  })

  /** Đếm lượt nghe theo track id */
  const playCount = computed(() => {
    const m = new Map<string, number>()
    for (const s of sessions.value) if (s.counted) m.set(s.id, (m.get(s.id) || 0) + 1)
    return m
  })

  const recentIds = computed(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (let i = sessions.value.length - 1; i >= 0 && out.length < 12; i--) {
      const id = sessions.value[i].id
      if (!seen.has(id)) {
        seen.add(id)
        out.push(id)
      }
    }
    return out
  })

  return {
    sessions,
    loved,
    lovedSet,
    toggleLove,
    goalMin,
    setGoal,
    commit,
    playsTotal,
    hoursTotal,
    plays30,
    playsPrev30,
    hours30,
    hoursPrev30,
    todayMin,
    dailyMinutes,
    weeklyMinutes,
    byHour,
    streak,
    bestStreak,
    playCount,
    recentIds,
  }
}

export function pctChange(cur: number, prev: number) {
  if (!prev) return cur ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}
