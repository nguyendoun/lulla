<script setup lang="ts">
const lib = useLibrary()
const stats = useStats()
const p = usePlayer()
const tracks = computed(() => stats.loved.value.map((id) => lib.byId.value.get(id)).filter(Boolean).reverse() as any[])
</script>

<template>
  <div class="loved">
    <header class="hero rise">
      <div class="heart"><Icon name="heart" :size="40" fill /></div>
      <div>
        <small>DANH SÁCH</small>
        <h1 class="h1">Bài yêu thích</h1>
        <p class="sub">{{ tracks.length }} bài · {{ fmtLong(tracks.reduce((s, t) => s + t.duration, 0)) }}</p>
        <button class="btn btn-primary" :disabled="!tracks.length" @click="p.playList(tracks.map((t) => t.id), 0)">
          <Icon name="play" :size="14" fill /> Phát
        </button>
      </div>
    </header>
    <TrackTable v-if="tracks.length" :tracks="tracks" />
    <p v-else class="empty card">Bấm vào biểu tượng ♥ ở bất kỳ bài nào để thêm vào đây.</p>
  </div>
</template>

<style scoped>
.loved {
  max-width: 1280px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.hero {
  display: flex;
  gap: 24px;
  align-items: flex-end;
  padding: 28px;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--rose), var(--peach));
}
.heart {
  width: 150px;
  height: 150px;
  border-radius: 24px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--rose-deep), var(--peach-deep));
  color: #fff;
  box-shadow: 0 20px 40px -18px var(--rose-deep);
  flex-shrink: 0;
}
small {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-2);
}
.btn {
  margin-top: 14px;
}
.empty {
  text-align: center;
  color: var(--text-2);
  padding: 40px;
}
@media (max-width: 600px) {
  .heart {
    width: 90px;
    height: 90px;
  }
}
</style>
