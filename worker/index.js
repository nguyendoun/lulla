// Worker của Lulla trên Cloudflare:
//  - /media/*  : file nhạc tĩnh, có HTTP Range để tua
//  - /api/add  : nhận link nhạc → chạy workflow "add-music" trên GitHub (cần mã ADD_CODE)
//  - /api/jobs : trạng thái các lần thêm nhạc gần đây
// Secrets (wrangler secret put): ADD_CODE, GITHUB_TOKEN (fine-grained, chỉ repo lulla, Actions read/write)
// Vars (wrangler.jsonc): GITHUB_REPO, ADD_WORKFLOW

const MAX_LINKS = 20

export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    if (url.pathname === '/api/add') return addMusic(req, env)
    if (url.pathname === '/api/jobs') return listJobs(req, env)
    if (url.pathname.startsWith('/media/')) return serveMedia(req, env, url)
    return env.ASSETS.fetch(req)
  },
}

// ---------- Thêm nhạc từ link ----------

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

// So sánh mã không lộ thời gian
async function codeOk(given, env) {
  if (!env.ADD_CODE || typeof given !== 'string' || !given) return false
  const enc = new TextEncoder()
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(env.ADD_CODE)),
  ])
  const x = new Uint8Array(a)
  const y = new Uint8Array(b)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

// Chỉ nhận link http(s) hợp lệ, không khoảng trắng / ký tự lạ
export function cleanLinks(text) {
  const out = []
  for (const raw of String(text || '').split(/[\s,]+/)) {
    if (!raw) continue
    let u
    try {
      u = new URL(raw)
    } catch {
      continue
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') continue
    const s = u.toString()
    if (s.length > 500 || /["'`$\\<>]/.test(s)) continue
    if (!out.includes(s)) out.push(s)
  }
  return out
}

function gh(env, path, init = {}) {
  return fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'lulla-worker',
      ...(init.headers || {}),
    },
  })
}

async function addMusic(req, env) {
  if (req.method !== 'POST') return json({ error: 'Chỉ nhận POST' }, 405)
  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Dữ liệu không hợp lệ' }, 400)
  }
  if (!(await codeOk(body.code, env))) return json({ error: 'Sai mã thêm nhạc' }, 401)
  if (!env.GITHUB_TOKEN) return json({ error: 'Máy chủ chưa cấu hình GITHUB_TOKEN' }, 500)

  const links = cleanLinks(body.links)
  if (!links.length) return json({ error: 'Không có link hợp lệ' }, 400)
  if (links.length > MAX_LINKS) return json({ error: `Tối đa ${MAX_LINKS} link mỗi lần` }, 400)

  const res = await gh(env, `/actions/workflows/${env.ADD_WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { links: links.join(' ') } }),
  })
  if (!res.ok) {
    const detail = await res.text()
    return json({ error: `GitHub từ chối (${res.status})`, detail: detail.slice(0, 300) }, 502)
  }
  return json({ ok: true, count: links.length, links })
}

async function listJobs(req, env) {
  const code = req.headers.get('x-add-code')
  if (!(await codeOk(code, env))) return json({ error: 'Sai mã thêm nhạc' }, 401)
  const res = await gh(env, `/actions/workflows/${env.ADD_WORKFLOW}/runs?per_page=8`)
  if (!res.ok) return json({ error: `GitHub lỗi (${res.status})` }, 502)
  const data = await res.json()
  return json(
    (data.workflow_runs || []).map((r) => ({
      id: r.id,
      title: r.display_title,
      status: r.status, // queued | in_progress | completed
      conclusion: r.conclusion, // success | failure | cancelled | null
      createdAt: r.created_at,
      url: r.html_url,
    })),
  )
}

// ---------- File nhạc có Range ----------

async function serveMedia(req, env, url) {
  const range = req.headers.get('range')
  if (!range) return env.ASSETS.fetch(req)

  const res = await env.ASSETS.fetch(new Request(url, { method: 'GET' }))
  if (res.status !== 200) return res
  const buf = await res.arrayBuffer()
  const size = buf.byteLength
  const m = /bytes=(\d*)-(\d*)/.exec(range)
  let start = m?.[1] ? parseInt(m[1], 10) : 0
  let end = m?.[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1
  if (m && !m[1] && m[2]) {
    start = Math.max(0, size - parseInt(m[2], 10))
    end = size - 1
  }
  const headers = new Headers(res.headers)
  headers.set('Accept-Ranges', 'bytes')
  if (!m || start >= size || start > end) {
    headers.set('Content-Range', `bytes */${size}`)
    return new Response(null, { status: 416, headers })
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
  headers.set('Content-Length', String(end - start + 1))
  return new Response(req.method === 'HEAD' ? null : buf.slice(start, end + 1), { status: 206, headers })
}
