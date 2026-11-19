# Lulla · cozy music player

Trình phát nhạc cá nhân phong cách "cozy" (Nuxt 3). Bạn bỏ nhạc vào một thư mục, app tự đọc tag, ảnh bìa,
gom album/nghệ sĩ/thể loại, và ghi lại thống kê nghe ngay trên trình duyệt.

## Chạy

```bash
npm install
# chép nhạc vào ./music  (thư mục con = album nếu file thiếu tag)
npm run dev                         # http://localhost:3000

# hoặc trỏ thẳng tới thư mục nhạc sẵn có
MUSIC_DIR="/Users/ban/Music" npm run dev
```

Bản build:

```bash
npm run build
MUSIC_DIR="/duong/dan/nhac" PORT=3000 node .output/server/index.mjs
```

Hỗ trợ: mp3, flac, m4a/aac, ogg, opus, wav, webm. File không có tag dạng `Nghệ sĩ - Tên bài.mp3` sẽ được tách tự động.

## Có gì bên trong

| Phần | File |
| --- | --- |
| Quét thư mục, đọc metadata (cache theo mtime) | `server/utils/library.ts` |
| Stream nhạc có HTTP Range (tua tức thì) | `server/api/stream/[id].get.ts` |
| Ảnh bìa nhúng trong file | `server/api/cover/[id].get.ts` |
| Máy phát: hàng đợi, trộn, lặp, fade âm lượng, Media Session | `composables/usePlayer.ts` |
| Thống kê + yêu thích (localStorage) | `composables/useStats.ts` |
| Đổi theme bằng vòng tròn lan ra (View Transitions) | `composables/useTheme.ts` |
| Đĩa than quay tăng/giảm tốc dần | `components/Vinyl.vue` |
| Màu, bo góc, easing dùng chung | `assets/css/main.css` |

## Vì sao nó mượt

- Một `<audio>` duy nhất cho cả app; thanh tiến trình cập nhật bằng `requestAnimationFrame` thay vì `timeupdate` (~4 lần/giây).
- Play/pause có fade âm lượng 180–260 ms, không bị "bụp".
- Mọi chuyển động dùng chung 2 đường cong: `--ease` (dừng êm) và `--ease-spring` (nảy nhẹ cho nút bấm).
- Chỉ animate `transform`/`opacity` (GPU), tôn trọng `prefers-reduced-motion`.
- Danh sách dài hiển thị dần theo cuộn (IntersectionObserver).

## Phím tắt

`Space` phát/dừng · `←/→` tua 5s · `Shift+←/→` đổi bài · `Ctrl/⌘+K` tìm kiếm (gõ không dấu vẫn tìm được).

## Ghi chú

- Server chỉ phục vụ file trong `MUSIC_DIR` qua id băm, không nhận đường dẫn từ client.
- App không có đăng nhập: chạy trên máy mình hoặc mạng LAN. Nếu đưa lên internet, đặt sau reverse proxy có xác thực (basic auth, Cloudflare Access…).
- Font Plus Jakarta Sans tải từ Google Fonts; offline sẽ tự dùng font hệ thống.
