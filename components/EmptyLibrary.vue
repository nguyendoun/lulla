<script setup lang="ts">
const lib = useLibrary()
</script>

<template>
  <div class="empty card rise">
    <div class="ic"><Icon name="disc" :size="34" /></div>
    <h2>Thư viện đang trống</h2>
    <p>
      Chép nhạc của bạn (mp3, flac, m4a, ogg, opus, wav) vào thư mục <code>music/</code> trong dự án,
      hoặc chạy với <code>MUSIC_DIR=/đường/dẫn/tới/nhạc</code>. Thư mục con sẽ được đọc như album.
    </p>
    <button class="btn btn-primary" @click="lib.load(true)"><Icon name="refresh" :size="15" /> Quét lại</button>
  </div>
</template>

<style scoped>
.empty {
  text-align: center;
  padding: 48px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.ic {
  width: 70px;
  height: 70px;
  border-radius: 22px;
  display: grid;
  place-items: center;
  background: var(--peach);
  color: var(--peach-deep);
}
h2 {
  margin: 8px 0 0;
}
p {
  max-width: 460px;
  color: var(--text-2);
  line-height: 1.6;
}
code {
  background: var(--surface-2);
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 12.5px;
}
</style>
