<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const theme = useTheme()
const lib = useLibrary()
const profile = useProfile()
const q = useState('search', () => '')
const input = ref<HTMLInputElement | null>(null)

const TITLES: Record<string, string> = {
  '/': 'Trang chủ',
  '/library': 'Thư viện',
  '/loved': 'Yêu thích',
  '/stats': 'Thống kê',
  '/settings': 'Cài đặt',
}
const crumbs = computed(() => {
  const base = '/' + (route.path.split('/')[1] || '')
  const out = ['Lulla', TITLES[base] || '']
  if (base === '/library') out.push({ songs: 'Bài hát', albums: 'Album', artists: 'Nghệ sĩ' }[String(route.query.tab || 'songs')] || '')
  return out.filter(Boolean)
})

function onSearch() {
  if (route.path !== '/library') router.push({ path: '/library', query: { tab: 'songs' } })
}

const isMac = ref(false)
onMounted(() => {
  isMac.value = /Mac|iPhone|iPad/.test(navigator.platform)
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      input.value?.focus()
      input.value?.select()
    }
    if (e.key === 'Escape' && document.activeElement === input.value) input.value?.blur()
  })
})

const mobileNav = [
  { to: '/', icon: 'home' },
  { to: '/library', icon: 'library' },
  { to: '/loved', icon: 'heart' },
  { to: '/stats', icon: 'stats' },
  { to: '/settings', icon: 'settings' },
]
</script>

<template>
  <header class="top">
    <div class="crumbs">
      <template v-for="(c, i) in crumbs" :key="i">
        <span v-if="i" class="sep">›</span>
        <span :class="{ last: i === crumbs.length - 1 }">{{ c }}</span>
      </template>
    </div>

    <label class="search">
      <Icon name="search" :size="16" />
      <input ref="input" v-model="q" placeholder="Tìm bài hát, nghệ sĩ, album…" @input="onSearch" />
      <kbd>{{ isMac ? '⌘' : 'Ctrl' }} K</kbd>
    </label>

    <div class="actions">
      <button class="ic" title="Quét lại thư mục nhạc" :class="{ spin: lib.loading.value }" @click="lib.load(true)">
        <Icon name="refresh" :size="17" />
      </button>
      <button class="ic" :title="theme.dark.value ? 'Chế độ sáng' : 'Chế độ tối'" @click="theme.toggle($event)">
        <Transition name="swap" mode="out-in">
          <Icon :key="String(theme.dark.value)" :name="theme.dark.value ? 'sun' : 'moon'" :size="17" />
        </Transition>
      </button>
      <NuxtLink to="/settings" class="avatar">{{ profile.initials.value }}</NuxtLink>
    </div>

    <nav class="mnav">
      <NuxtLink v-for="n in mobileNav" :key="n.to" :to="n.to" :class="{ on: n.to === '/' ? route.path === '/' : route.path.startsWith(n.to) }">
        <Icon :name="n.icon" :size="19" />
      </NuxtLink>
    </nav>
  </header>
</template>

<style scoped>
.top {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 20px 12px;
  flex-wrap: wrap;
}
.crumbs {
  display: flex;
  gap: 8px;
  font-size: 12.5px;
  color: var(--text-3);
  font-weight: 600;
}
.crumbs .last {
  color: var(--text-2);
}
.search {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  width: min(340px, 100%);
  height: 40px;
  padding: 0 8px 0 14px;
  border-radius: 999px;
  background: var(--surface);
  box-shadow: var(--shadow);
  color: var(--text-3);
  transition:
    box-shadow 0.25s var(--ease),
    width 0.35s var(--ease);
}
.search:focus-within {
  width: min(420px, 100%);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent),
    var(--shadow);
}
.search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: none;
  color: var(--text);
}
.search input::placeholder {
  color: var(--text-3);
}
kbd {
  font: 600 11px inherit;
  padding: 3px 7px;
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text-2);
}
.actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.ic {
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
.ic.spin :deep(svg) {
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 12px;
  background: var(--butter);
  color: var(--butter-deep);
  box-shadow: 0 0 0 2px var(--surface);
}
.swap-enter-active,
.swap-leave-active {
  transition: all 0.25s var(--ease);
}
.swap-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.6);
}
.swap-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.6);
}
.mnav {
  display: none;
}
@media (max-width: 860px) {
  .top {
    padding: 6px 6px 10px;
  }
  .crumbs {
    display: none;
  }
  .search,
  .search:focus-within {
    margin-left: 0;
    flex: 1 1 0;
    min-width: 0;
    width: auto;
  }
  kbd {
    display: none;
  }
  .mnav {
    display: flex;
    justify-content: space-around;
    width: 100%;
    background: var(--sage);
    border-radius: 16px;
    padding: 6px;
  }
  .mnav a {
    padding: 8px 14px;
    border-radius: 12px;
    color: var(--text-2);
    transition: background 0.2s;
  }
  .mnav a.on {
    background: var(--surface);
    color: var(--text);
  }
}
</style>
