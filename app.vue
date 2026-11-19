<script setup lang="ts">
const lib = useLibrary()
const player = usePlayer()
const theme = useTheme()

onMounted(() => {
  theme.init()
  player.init()
  lib.load()

  // Phím tắt: Space phát/dừng, ←/→ tua 5s, Shift+←/→ chuyển bài
  window.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (e.code === 'Space') {
      e.preventDefault()
      player.toggle()
    } else if (e.key === 'ArrowRight') {
      e.shiftKey ? player.next() : player.seek(player.time.value + 5)
    } else if (e.key === 'ArrowLeft') {
      e.shiftKey ? player.prev() : player.seek(player.time.value - 5)
    }
  })
})
</script>

<template>
  <div class="shell">
    <AppSidebar />
    <main class="app-main">
      <AppTopbar />
      <div class="content">
        <NuxtPage />
      </div>
    </main>
    <PlayerBar />
  </div>
</template>

<style>
.shell {
  display: grid;
  grid-template-columns: var(--sidebar-w) 1fr;
  height: 100vh;
  padding: 12px;
  gap: 12px;
}
.app-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 20px calc(var(--player-h) + 36px);
  scroll-behavior: smooth;
}
@media (max-width: 860px) {
  .shell {
    grid-template-columns: 1fr;
    padding: 8px;
  }
  .content {
    padding: 8px 6px calc(var(--player-h) + 90px);
  }
}
</style>
