// Worker của Lulla trên Cloudflare:
//  - /media/*  : file nhạc tĩnh, có HTTP Range để tua
//  - /api/upload : nhận 1 file nhạc (base64) → commit vào music/ trên GitHub → CI tự deploy
//  - /api/jobs   : trạng thái các lần deploy gần đây
// Secrets (wrangler secret put): ADD_CODE, GITHUB_TOKEN (fine-grained, chỉ repo lulla: Contents RW, Actions read)
// Vars (wrangler.jsonc): GITHUB_REPO, DEPLOY_WORKFLOW

const MAX_BYTES = 25 * 1024 * 1024 // giới hạn 1 file của Cloudflare
const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wav', 'webm']

export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    if (url.pathname === '/api/upload') return upload(req, env, url)
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
const enc = new TextEncoder()
async function codeOk(given, env) {
  if (!env.ADD_CODE || typeof given !== 'string' || !given) return false
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

// Tên file an toàn: bỏ thư mục, ký tự lạ; giữ chữ có dấu
function cleanName(raw) {
  let name = String(raw || '').split(/[\\/]/).pop().normalize('NFC')
  name = name.replace(/[\u0000-\u001f"*:<>?|#%{}^~`$\\]/g, '').replace(/\s+/g, ' ').trim()
  const m = /^(.*)\.([A-Za-z0-9]+)$/.exec(name)
  if (!m || !AUDIO_EXT.includes(m[2].toLowerCase())) return null
  const base = m[1].replace(/^\.+/, '').slice(0, 150).trim()
  return base ? `${base}.${m[2].toLowerCase()}` : null
}

// Nhận base64 thô, ghép thẳng vào JSON gửi GitHub bằng stream (không giải mã → nhẹ CPU)
async function upload(req, env, url) {
  if (req.method !== 'POST') return json({ error: 'Chỉ nhận POST' }, 405)
  const origin = req.headers.get('origin')
  if (origin && origin !== url.origin) return json({ error: 'Sai nguồn gửi' }, 403)
  if (!(await codeOk(req.headers.get('x-add-code'), env))) return json({ error: 'Sai mã thêm nhạc' }, 401)
  if (!env.GITHUB_TOKEN) return json({ error: 'Máy chủ chưa cấu hình GITHUB_TOKEN' }, 500)

  const name = cleanName(decodeURIComponent(req.headers.get('x-filename') || ''))
  if (!name) return json({ error: `Chỉ nhận file nhạc: ${AUDIO_EXT.join(', ')}` }, 400)
  const len = Number(req.headers.get('content-length') || 0)
  if (!len || !req.body) return json({ error: 'File rỗng' }, 400)
  if (len > Math.ceil(MAX_BYTES / 3) * 4) return json({ error: 'File quá 25MB' }, 413)

  const path = 'music/' + name
  const apiPath = '/contents/' + path.split('/').map(encodeURIComponent).join('/')

  // Đã có bài trùng tên → báo luôn, không ghi đè
  const head = await gh(env, apiPath + '?ref=main')
  if (head.ok) return json({ error: 'Bài này đã có trong thư viện', name }, 409)

  const prefix = enc.encode(`{"message":${JSON.stringify('Tải nhạc lên: ' + name)},"branch":"main","content":"`)
  const suffix = enc.encode('"}')
  const total = prefix.length + len + suffix.length

  // Chỉ cho ký tự base64 đi qua; gặp ký tự khác thì huỷ
  const B64 = /^[A-Za-z0-9+/=]*$/
  const dec = new TextDecoder()
  const { readable, writable } = new FixedLengthStream(total)
  const pump = (async () => {
    const w = writable.getWriter()
    await w.write(prefix)
    const r = req.body.getReader()
    for (;;) {
      const { done, value } = await r.read()
      if (done) break
      if (!B64.test(dec.decode(value, { stream: true }))) throw new Error('Dữ liệu không phải base64')
      await w.write(value)
    }
    await w.write(suffix)
    await w.close()
  })()

  const [res] = await Promise.all([
    gh(env, apiPath, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: readable }),
    pump.catch((e) => writable.abort(e)),
  ])
  if (!res.ok) {
    const detail = await res.text()
    return json({ error: `GitHub từ chối (${res.status})`, detail: detail.slice(0, 300) }, 502)
  }
  return json({ ok: true, name })
}

async function listJobs(req, env) {
  if (!(await codeOk(req.headers.get('x-add-code'), env))) return json({ error: 'Sai mã thêm nhạc' }, 401)
  if (!env.GITHUB_TOKEN) return json([])
  const res = await gh(env, `/actions/workflows/${env.DEPLOY_WORKFLOW}/runs?branch=main&per_page=6`)
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
