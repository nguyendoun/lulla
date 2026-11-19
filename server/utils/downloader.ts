// Tải nhạc từ link (YouTube, TikTok, SoundCloud…) bằng yt-dlp ngay trên máy,
// rồi commit + push thư mục nhạc lên GitHub để CI deploy lên doun.online.
// Chỉ dùng ở bản chạy local (npm run dev), bản online là trang tĩnh.
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export interface DlItem {
  link: string
  state: 'wait' | 'run' | 'done' | 'err'
  files: string[]
  msg: string
}
export interface DlJob {
  id: string
  createdAt: number
  state: 'run' | 'push' | 'done' | 'err'
  items: DlItem[]
  msg: string
}

const jobs = new Map<string, DlJob>()
let queue: Promise<void> = Promise.resolve() // chạy lần lượt, tránh 2 lần commit đè nhau

const LINK_RE = /^https?:\/\/[A-Za-z0-9._~:/?#@!&+=%,;-]+$/

export function cleanLinks(text: string) {
  const out: string[] = []
  for (const s of String(text || '').split(/[\s,]+/)) if (LINK_RE.test(s) && s.length < 500 && !out.includes(s)) out.push(s)
  return out
}

export function getJob(id: string) {
  return jobs.get(id)
}

export function startJob(links: string[]) {
  const job: DlJob = {
    id: randomUUID(),
    createdAt: Date.now(),
    state: 'run',
    items: links.map((link) => ({ link, state: 'wait', files: [], msg: '' })),
    msg: '',
  }
  jobs.set(job.id, job)
  // dọn job cũ
  for (const [id, j] of jobs) if (Date.now() - j.createdAt > 6 * 3600_000) jobs.delete(id)
  queue = queue.then(() => runJob(job)).catch(() => {})
  return job
}

function run(cmd: string, args: string[], cwd: string, timeoutMs = 10 * 60_000) {
  return new Promise<{ code: number; out: string }>((resolve) => {
    // spawn không qua shell → link không thể chèn lệnh
    const p = spawn(cmd, args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
    let out = ''
    const add = (d: Buffer) => {
      out += d.toString()
      if (out.length > 200_000) out = out.slice(-100_000)
    }
    p.stdout.on('data', add)
    p.stderr.on('data', add)
    const t = setTimeout(() => p.kill('SIGKILL'), timeoutMs)
    p.on('error', (e) => {
      clearTimeout(t)
      resolve({ code: -1, out: String(e) })
    })
    p.on('close', (code) => {
      clearTimeout(t)
      resolve({ code: code ?? -1, out })
    })
  })
}

async function listAudio(dir: string) {
  try {
    return new Set((await fs.readdir(dir)).filter((f) => !f.startsWith('.')))
  } catch {
    return new Set<string>()
  }
}

function lastError(out: string) {
  const lines = out.split('\n').filter((l) => /ERROR|error:/i.test(l))
  const l = (lines.pop() || out.trim().split('\n').pop() || 'Lỗi không rõ').replace(/^ERROR:\s*(\[[^\]]+\]\s*)?/, '')
  if (/not a bot|Sign in/i.test(l)) return 'YouTube đòi đăng nhập, thử lại sau'
  if (/Unsupported URL/i.test(l)) return 'Link này không hỗ trợ'
  if (/duration/i.test(l) && /filter|skip/i.test(l)) return 'Bài dài quá 20 phút, đã bỏ qua'
  return l.slice(0, 160)
}

async function runJob(job: DlJob) {
  const dir = musicRoot()
  await fs.mkdir(dir, { recursive: true })

  for (const it of job.items) {
    it.state = 'run'
    it.msg = 'Đang tải…'
    const before = await listAudio(dir)
    const r = await run(
      'yt-dlp',
      [
        '--no-playlist',
        '--ignore-config',
        '--no-progress',
        '--match-filter',
        'duration < 1200',
        '-x',
        '--audio-format',
        'mp3',
        '--audio-quality',
        '128K',
        '--embed-metadata',
        '--embed-thumbnail',
        '--convert-thumbnails',
        'jpg',
        '--download-archive',
        '.downloaded.txt',
        '--trim-filenames',
        '150',
        '-o',
        '%(artist,uploader,channel)s - %(track,title)s.%(ext)s',
        '--',
        it.link,
      ],
      dir,
    )
    const after = await listAudio(dir)
    it.files = [...after].filter((f) => !before.has(f) && /\.(mp3|m4a|opus|ogg|flac|wav|webm)$/i.test(f))
    // Cloudflare giới hạn 25MB mỗi file
    for (const f of [...it.files]) {
      const st = await fs.stat(path.join(dir, f))
      if (st.size > 25 * 1024 * 1024) {
        await fs.rm(path.join(dir, f))
        it.files = it.files.filter((x) => x !== f)
        it.msg = 'File quá 25MB, đã bỏ'
      }
    }
    if (it.files.length) {
      it.state = 'done'
      it.msg = it.files.map((f) => f.replace(/\.[^.]+$/, '')).join(', ')
    } else if (r.code === 0 && /already been recorded in the archive/i.test(r.out)) {
      it.state = 'err'
      it.msg = 'Bài này đã có rồi'
    } else {
      it.state = 'err'
      it.msg = it.msg && it.msg !== 'Đang tải…' ? it.msg : lastError(r.out)
    }
  }

  await getLibrary(true)
  const added = job.items.flatMap((i) => i.files)
  if (!added.length) {
    job.state = 'err'
    job.msg = 'Không tải được bài nào'
    return
  }

  // Đẩy lên GitHub → CI deploy doun.online
  job.state = 'push'
  job.msg = 'Đang đẩy lên doun.online…'
  const top = await run('git', ['rev-parse', '--show-toplevel'], dir)
  if (top.code !== 0) {
    job.state = 'done'
    job.msg = `Đã thêm ${added.length} bài trên máy (thư mục nhạc không nằm trong git, không đẩy lên web)`
    return
  }
  const root = top.out.trim()
  const rel = path.relative(root, dir) || '.'
  const steps: [string, string[]][] = [
    ['git', ['add', '--', rel]],
    ['git', ['commit', '-m', `Thêm nhạc từ link: ${added.join(', ')}`.slice(0, 300), '--', rel]],
    ['git', ['pull', '--rebase', '--autostash', 'origin', 'main']],
    ['git', ['push', 'origin', 'HEAD:main']],
  ]
  for (const [cmd, args] of steps) {
    const r = await run(cmd, args, root, 3 * 60_000)
    if (r.code !== 0) {
      job.state = 'err'
      job.msg = `Đã thêm ${added.length} bài trên máy nhưng đẩy lên web lỗi (${args[0]}): ${r.out.trim().split('\n').pop()?.slice(0, 160)}`
      return
    }
  }
  job.state = 'done'
  job.msg = `Đã thêm ${added.length} bài. doun.online sẽ có sau ~2 phút.`
}
