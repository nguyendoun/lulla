<script setup lang="ts">
const lib = useLibrary()
const p = usePlayer()
const stats = useStats()
const route = useRoute()
const router = useRouter()
const q = useState('search', () => '')

const tab = computed({
  get: () => String(route.query.tab || 'songs'),
  set: (v) => router.replace({ query: { ...route.query, tab: v } }),
})
const genre = ref('Tất cả')
const sort = ref<'recent' | 'title' | 'artist' | 'plays'>('title')

// Bỏ dấu để gõ "tinh yeu" vẫn ra "Tình yêu"
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase()

const filtered = computed(() => {
  const needle = norm(q.value.trim())
  let list = lib.tracks.value.filter(
    (t) =>
      (genre.value === 'Tất cả' || t.genre === genre.value) &&
      (!needle || norm(`${t.title} ${t.artist} ${t.album}`).includes(needle)),
  )
  const pc = stats.playCount.value
  list = [...list]
  if (sort.value === 'recent') list.sort((a, b) => b.addedAt - a.addedAt)
  if (sort.value === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'vi'))
  if (sort.value === 'artist') list.sort((a, b) => a.artist.localeCompare(b.artist, 'vi'))
  if (sort.value === 'plays') list.sort((a, b) => (pc.get(b.id) || 0) - (pc.get(a.id) || 0))
  return list
})

const filteredAlbums = computed(() => {
  const needle = norm(q.value.trim())
  return lib.albums.value.filter(
    (a) =>
      (genre.value === 'Tất cả' || a.tracks.some((t) => t.genre === genre.value)) &&
      (!needle || norm(`${a.name} ${a.artist}`).includes(needle)),
  )
})
const filteredArtists = computed(() => {
  const needle = norm(q.value.trim())
  return lib.artists.value.filter((a) => !needle || norm(a.name).includes(needle))
})

function playAll() {
  const ids = filtered.value.map((t) => t.id)
  if (ids.length) p.playList(ids, 0)
}
function playArtist(name: string) {
  const ids = lib.tracks.value.filter((t) => t.artist === name).map((t) => t.id)
  p.playList(ids, 0)
}

const SORTS = [
  { k: 'title', label: 'Tên' },
  { k: 'artist', label: 'Nghệ sĩ' },
  { k: 'recent', label: 'Mới thêm' },
  { k: 'plays', label: 'Nghe nhiều' },
] as const
</script>

<template>
  <div class="lib">
    <header class="head rise">
      <div>
        <h1 class="h1">Thư viện</h1>
        <p class="sub">
          {{ lib.tracks.value.length }} bài · {{ lib.albums.value.length }} album · {{ fmtLong(lib.totalDuration.value) }} nhạc
        </p>
      </div>
      <button class="btn btn-primary" @click="playAll"><Icon name="play" :size="14" fill /> Phát tất cả</button>
    </header>

    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'songs' }" @click="tab = 'songs'">Bài hát</button>
      <button class="tab" :class="{ active: tab === 'albums' }" @click="tab = 'albums'">Album</button>
      <button class="tab" :class="{ active: tab === 'artists' }" @click="tab = 'artists'">Nghệ sĩ</button>
    </div>

    <div class="filters">
      <div class="chips">
        <button class="chip" :class="{ active: genre === 'Tất cả' }" @click="genre = 'Tất cả'">
          Tất cả <span class="count">{{ lib.tracks.value.length }}</span>
        </button>
        <button v-for="g in lib.genres.value" :key="g.name" class="chip" :class="{ active: genre === g.name }" @click="genre = g.name">
          <span class="dot" :style="{ background: lib.genreColor(g.name) }" />{{ g.name }}
          <span class="count">{{ g.count }}</span>
        </button>
      </div>
      <div v-if="tab === 'songs'" class="seg">
        <button v-for="s in SORTS" :key="s.k" :class="{ on: sort === s.k }" @click="sort = s.k">{{ s.label }}</button>
      </div>
    </div>

    <p v-if="q" class="searching">Kết quả cho “{{ q }}” <button @click="q = ''">Xoá</button></p>

    <Transition name="tabfade" mode="out-in">
      <TrackTable v-if="tab === 'songs'" key="s" :tracks="filtered" />
      <div v-else-if="tab === 'albums'" key="a" class="grid">
        <AlbumCard v-for="(a, i) in filteredAlbums" :key="a.key" :album="a" class="rise" :style="{ animationDelay: Math.min(i, 12) * 30 + 'ms' }" />
      </div>
      <div v-else key="ar" class="grid">
        <button
          v-for="(a, i) in filteredArtists"
          :key="a.name"
          class="artist rise"
          :style="{ animationDelay: Math.min(i, 12) * 30 + 'ms' }"
          @click="playArtist(a.name)"
        >
          <Cover :src="coverUrl(a.cover)" :seed="a.name" size="100%" :radius="999" />
          <b>{{ a.name }}</b>
          <small>{{ a.tracks.length }} bài</small>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.lib {
  max-width: 1280px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
}
.filters {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.seg {
  display: flex;
  background: var(--surface-2);
  border-radius: 999px;
  padding: 3px;
  height: fit-content;
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
.searching {
  color: var(--text-2);
  font-size: 13px;
  margin: -4px 0 12px;
}
.searching button {
  color: var(--accent);
  font-weight: 600;
  margin-left: 6px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 20px 16px;
}
.artist {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px;
  border-radius: var(--radius-lg);
  transition:
    background 0.25s,
    transform 0.35s var(--ease);
  text-align: center;
}
.artist:hover {
  background: var(--surface);
  transform: translateY(-3px);
}
.artist .cover {
  margin-bottom: 8px;
  box-shadow: var(--shadow);
}
.artist b {
  font-size: 13.5px;
}
.artist small {
  color: var(--text-2);
  font-size: 12px;
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
</style>
