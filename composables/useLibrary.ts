export interface Track {
  id: string
  title: string
  artist: string
  album: string
  year: number | null
  genre: string
  duration: number
  trackNo: number | null
  hasCover: boolean
  addedAt: number
}

export interface Album {
  key: string
  name: string
  artist: string
  year: number | null
  cover: string | null
  tracks: Track[]
}

// Bảng màu pastel cho thể loại (xoay vòng)
const GENRE_PALETTE = [
  'var(--peach-deep)',
  'var(--sage-deep)',
  'var(--butter-deep)',
  'var(--slate-deep)',
  'var(--rose-deep)',
]

export function useLibrary() {
  const tracks = useState<Track[]>('tracks', () => [])
  const loaded = useState('tracks-loaded', () => false)
  const loading = useState('tracks-loading', () => false)

  async function load(refresh = false) {
    if (loading.value) return
    loading.value = true
    try {
      tracks.value = await $fetch<Track[]>('/api/tracks', { query: refresh ? { refresh: 1 } : {} })
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  const byId = computed(() => new Map(tracks.value.map((t) => [t.id, t])))

  const albums = computed<Album[]>(() => {
    const map = new Map<string, Album>()
    for (const t of tracks.value) {
      const key = `${t.album}__${t.artist}`
      let a = map.get(key)
      if (!a) {
        a = { key, name: t.album, artist: t.artist, year: t.year, cover: null, tracks: [] }
        map.set(key, a)
      }
      a.tracks.push(t)
      if (!a.cover && t.hasCover) a.cover = coverUrl(t)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  })

  const artists = computed(() => {
    const map = new Map<string, Track[]>()
    for (const t of tracks.value) {
      if (!map.has(t.artist)) map.set(t.artist, [])
      map.get(t.artist)!.push(t)
    }
    return [...map.entries()]
      .map(([name, list]) => ({ name, tracks: list, cover: list.find((t) => t.hasCover) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  const genres = computed(() => {
    const map = new Map<string, number>()
    for (const t of tracks.value) map.set(t.genre, (map.get(t.genre) || 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
  })

  const totalDuration = computed(() => tracks.value.reduce((s, t) => s + t.duration, 0))

  function genreColor(name: string) {
    const i = genres.value.findIndex((g) => g.name === name)
    return GENRE_PALETTE[(i < 0 ? 0 : i) % GENRE_PALETTE.length]
  }

  return { tracks, loaded, loading, load, byId, albums, artists, genres, totalDuration, genreColor }
}

export function coverUrl(t: Pick<Track, 'id' | 'hasCover'> | null | undefined) {
  return t?.hasCover ? `/api/cover/${t.id}` : null
}

export function fmtTime(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function fmtLong(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  return h ? `${h} giờ ${m} phút` : `${m} phút`
}
