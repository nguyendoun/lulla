// Xuất bản tĩnh cho Cloudflare Pages: chép nhạc + ảnh bìa + tracks.json vào .output/public
// Dùng: MUSIC_DIR=~/Music node scripts/export-static.mjs  (sau khi đã chạy nuxt generate)
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { parseFile } from 'music-metadata'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const AUDIO_EXT = new Set(['.mp3', '.flac', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.webm', '.amr', '.3gp', '.3ga', '.caf', '.qta', '.mp4', '.mov'])
// Ghi âm điện thoại / trình duyệt: nhiều trình duyệt không phát được → đổi sang mp3 bằng ffmpeg
// .qta = ghi âm nhiều lớp của iPhone (iOS 18)
const CONVERT = new Set(['.amr', '.3gp', '.3ga', '.caf', '.qta', '.mp4', '.mov', '.webm'])
const MAX_SIZE = 25 * 1024 * 1024 // giới hạn 1 file của Cloudflare Pages
const root = path.resolve(process.env.MUSIC_DIR || './music')
const out = path.resolve('.output/public')

const idFor = (rel) => createHash('sha1').update(rel).digest('hex').slice(0, 16)

async function walk(dir, list = []) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await walk(full, list)
    else if (AUDIO_EXT.has(path.extname(e.name).toLowerCase())) list.push(full)
  }
  return list
}

function guess(file) {
  const base = path.basename(file, path.extname(file))
  const m = base.match(/^(.+?)\s+-\s+(.+)$/)
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { artist: '', title: base }
}

await fs.rm(path.join(out, 'media'), { recursive: true, force: true })
await fs.rm(path.join(out, 'covers'), { recursive: true, force: true })
await fs.mkdir(path.join(out, 'media'), { recursive: true })
await fs.mkdir(path.join(out, 'covers'), { recursive: true })
await fs.mkdir(path.join(out, 'data'), { recursive: true })

const tracks = []
const skipped = []
for (const full of await walk(root)) {
  const stat = await fs.stat(full)
  const rel = path.relative(root, full)
  if (stat.size > MAX_SIZE) { skipped.push(rel); continue }
  const id = idFor(rel)
  const ext = path.extname(full).toLowerCase()
  const g = guess(full)
  const folder = path.basename(path.dirname(full))
  let t = {
    id, title: g.title, artist: g.artist || 'Không rõ nghệ sĩ', album: 'Single', year: null,
    genre: 'Khác', duration: 0, trackNo: null, hasCover: false, addedAt: stat.mtimeMs,
  }
  let alac = false
  try {
    const meta = await parseFile(full, { duration: true })
    // m4a Lossless của iPhone (ALAC): Chrome không phát được → đổi sang mp3
    alac = /alac/i.test(meta.format.codec || '')
    const c = meta.common
    t = {
      ...t,
      title: c.title || g.title,
      artist: c.artist || c.albumartist || g.artist || 'Không rõ nghệ sĩ',
      album: c.album || (folder !== path.basename(root) ? folder : 'Single'),
      year: c.year ?? null,
      genre: c.genre?.[0] || 'Khác',
      duration: meta.format.duration ?? 0,
      trackNo: c.track?.no ?? null,
    }
    const pic = c.picture?.[0]
    if (pic) {
      const pext = /png/.test(pic.format || '') ? '.png' : '.jpg'
      await fs.writeFile(path.join(out, 'covers', id + pext), pic.data)
      t.hasCover = true
      t.cover = `/covers/${id}${pext}`
    }
  } catch {}
  if (CONVERT.has(ext) || alac) {
    const dest = path.join(out, 'media', id + '.mp3')
    try {
      await run('ffmpeg', ['-v', 'error', '-y', '-i', full, '-vn', '-b:a', '128k', dest])
    } catch (e) {
      skipped.push(`${rel} (không đổi được sang mp3)`)
      continue
    }
    if (!t.duration) {
      try {
        t.duration = (await parseFile(dest, { duration: true })).format.duration ?? 0
      } catch {}
    }
    if (t.genre === 'Khác') t.genre = 'Ghi âm'
    t.src = `/media/${id}.mp3`
  } else {
    await fs.copyFile(full, path.join(out, 'media', id + ext))
    t.src = `/media/${id}${ext}`
  }
  tracks.push(t)
}
tracks.sort((a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album) ||
  (a.trackNo ?? 0) - (b.trackNo ?? 0) || a.title.localeCompare(b.title))
await fs.writeFile(path.join(out, 'data', 'tracks.json'), JSON.stringify(tracks))
// Bỏ 404.html để Pages tự trả index.html cho mọi đường dẫn (SPA: /stats, /library…)
await fs.rm(path.join(out, '404.html'), { force: true })
console.log(`Xuất ${tracks.length} bài` + (skipped.length ? `, bỏ qua: ${skipped.join(', ')}` : ''))
