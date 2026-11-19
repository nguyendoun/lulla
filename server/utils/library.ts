import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { parseFile } from 'music-metadata'

export interface Track {
  id: string
  file: string // đường dẫn tương đối trong thư mục nhạc
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

const AUDIO_EXT = new Set(['.mp3', '.flac', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.webm'])

export const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
}

// Cache theo file + mtime: lần quét sau chỉ đọc lại file mới/đã sửa
const cache = new Map<string, { mtime: number; track: Track }>()
let lastScan = 0
let scanning: Promise<Track[]> | null = null
let tracks: Track[] = []

export function musicRoot() {
  // MUSIC_DIR đọc lúc chạy → đổi thư mục không cần build lại
  const { musicDir } = useRuntimeConfig()
  return path.resolve(process.env.MUSIC_DIR || musicDir)
}

export function idFor(rel: string) {
  return createHash('sha1').update(rel).digest('hex').slice(0, 16)
}

async function walk(dir: string, out: string[] = []) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await walk(full, out)
    else if (AUDIO_EXT.has(path.extname(e.name).toLowerCase())) out.push(full)
  }
  return out
}

function guessFromFilename(file: string) {
  // "Artist - Title.mp3" → tách ra nếu file không có tag
  const base = path.basename(file, path.extname(file))
  const m = base.match(/^(.+?)\s+-\s+(.+)$/)
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { artist: '', title: base }
}

async function readTrack(full: string, root: string, mtime: number): Promise<Track> {
  const rel = path.relative(root, full)
  const guess = guessFromFilename(full)
  const folder = path.basename(path.dirname(full))
  try {
    const meta = await parseFile(full, { duration: true })
    const c = meta.common
    return {
      id: idFor(rel),
      file: rel,
      title: c.title || guess.title,
      artist: c.artist || c.albumartist || guess.artist || 'Không rõ nghệ sĩ',
      album: c.album || (folder !== path.basename(root) ? folder : 'Single'),
      year: c.year ?? null,
      genre: c.genre?.[0] || 'Khác',
      duration: meta.format.duration ?? 0,
      trackNo: c.track?.no ?? null,
      hasCover: !!c.picture?.length,
      addedAt: mtime,
    }
  } catch {
    return {
      id: idFor(rel),
      file: rel,
      title: guess.title,
      artist: guess.artist || 'Không rõ nghệ sĩ',
      album: 'Single',
      year: null,
      genre: 'Khác',
      duration: 0,
      trackNo: null,
      hasCover: false,
      addedAt: mtime,
    }
  }
}

async function scan(): Promise<Track[]> {
  const root = musicRoot()
  const files = await walk(root)
  const result: Track[] = []
  // Đọc song song theo lô nhỏ để không mở quá nhiều file cùng lúc
  const BATCH = 16
  for (let i = 0; i < files.length; i += BATCH) {
    const chunk = files.slice(i, i + BATCH)
    const done = await Promise.all(
      chunk.map(async (full) => {
        const stat = await fs.stat(full)
        const hit = cache.get(full)
        if (hit && hit.mtime === stat.mtimeMs) return hit.track
        const track = await readTrack(full, root, stat.mtimeMs)
        cache.set(full, { mtime: stat.mtimeMs, track })
        return track
      }),
    )
    result.push(...done)
  }
  result.sort(
    (a, b) =>
      a.artist.localeCompare(b.artist) ||
      a.album.localeCompare(b.album) ||
      (a.trackNo ?? 0) - (b.trackNo ?? 0) ||
      a.title.localeCompare(b.title),
  )
  return result
}

/** Lấy thư viện; quét lại tối đa mỗi 10 giây (hoặc khi force) */
export async function getLibrary(force = false): Promise<Track[]> {
  if (!force && Date.now() - lastScan < 10_000 && tracks.length) return tracks
  if (!scanning) {
    scanning = scan()
      .then((t) => {
        tracks = t
        lastScan = Date.now()
        return t
      })
      .finally(() => {
        scanning = null
      })
  }
  return scanning
}

export async function findTrack(id: string) {
  const lib = await getLibrary()
  return lib.find((t) => t.id === id)
}
