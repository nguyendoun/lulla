// Worker của Lulla trên Cloudflare — mọi request đi qua đây trước:
//  - /login, /logout : đăng nhập bằng mật khẩu (secret SITE_PASSWORD), cookie ký HMAC 30 ngày
//  - chưa đăng nhập  : trang → chuyển về /login; file/API → 401
//  - /media/*        : file nhạc tĩnh, có HTTP Range để tua
//  - /api/upload     : nhận 1 file nhạc (base64) → commit vào music/ trên GitHub → CI tự deploy
//  - /api/jobs       : trạng thái các lần deploy gần đây
// Secrets (wrangler secret put): SITE_PASSWORD, GITHUB_TOKEN (fine-grained, chỉ repo lulla: Contents RW, Actions read)
// Vars (wrangler.jsonc): GITHUB_REPO, DEPLOY_WORKFLOW

const COOKIE = 'lulla_session'
const SESSION_DAYS = 30
const MAX_BYTES = 25 * 1024 * 1024 // giới hạn 1 file của Cloudflare
// amr/3gp/3ga/caf: file ghi âm điện thoại, CI đổi sang mp3 lúc build
const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wav', 'webm', 'amr', '3gp', '3ga', 'caf']

export default {
  async fetch(req, env) {
    const url = new URL(req.url)

    if (url.pathname === '/login') return req.method === 'POST' ? doLogin(req, env, url) : loginPage(url)
    if (url.pathname === '/logout') return logout()
    if (url.pathname === '/favicon.ico') return env.ASSETS.fetch(req)

    if (!(await isLoggedIn(req, env))) {
      const wantsPage = req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html')
      if (wantsPage) {
        const next = url.pathname + url.search
        return redirect('/login' + (next !== '/' ? '?next=' + encodeURIComponent(next) : ''))
      }
      return json({ error: 'Chưa đăng nhập' }, 401)
    }

    if (url.pathname === '/api/upload') return upload(req, env, url)
    if (url.pathname === '/api/jobs') return listJobs(env)
    if (url.pathname.startsWith('/media/')) return serveMedia(req, env, url)
    return env.ASSETS.fetch(req)
  },
}

// ---------- Tiện ích ----------

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
function redirect(to, extra = {}) {
  return new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store', ...extra } })
}
const enc = new TextEncoder()
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}
// So sánh không lộ thời gian (băm trước để cùng độ dài)
async function safeEqual(a, b) {
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b))),
  ])
  const p = new Uint8Array(x)
  const q = new Uint8Array(y)
  let diff = 0
  for (let i = 0; i < p.length; i++) diff |= p[i] ^ q[i]
  return diff === 0
}

// ---------- Đăng nhập ----------

function getCookie(req, name) {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'))
  return m ? m[1] : null
}

async function isLoggedIn(req, env) {
  if (!env.SITE_PASSWORD) return false
  const v = getCookie(req, COOKIE)
  if (!v) return false
  const [exp, sig] = v.split('.')
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false
  // Khoá ký gắn với mật khẩu → đổi mật khẩu là mọi phiên cũ hết hạn
  return safeEqual(sig, await hmac(env.SITE_PASSWORD, 'session:' + exp))
}

// Chỉ cho quay về đường dẫn trong site
function safeNext(n) {
  return typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/login') ? n : '/'
}

async function doLogin(req, env, url) {
  const form = await req.formData().catch(() => null)
  const password = form?.get('password') || ''
  const next = safeNext(form?.get('next'))
  if (!env.SITE_PASSWORD || !(await safeEqual(password, env.SITE_PASSWORD))) {
    await new Promise((r) => setTimeout(r, 800)) // làm chậm dò mật khẩu
    return redirect('/login?e=1' + (next !== '/' ? '&next=' + encodeURIComponent(next) : ''))
  }
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400
  const value = exp + '.' + (await hmac(env.SITE_PASSWORD, 'session:' + exp))
  const secure = url.protocol === 'https:' ? '; Secure' : ''
  return redirect(next, {
    'Set-Cookie': `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`,
  })
}

function logout() {
  return redirect('/login', { 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` })
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function loginPage(url) {
  const error = url.searchParams.get('e') === '1'
  const next = safeNext(url.searchParams.get('next'))
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#f6ece0">
<title>Đăng nhập · Lulla</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>
:root{--bg:#f6ece0;--surface:#fbf5ee;--surface-2:#f1e4d4;--line:#eadac7;--text:#3b2a20;--text-2:#7a6455;--text-3:#a08b7b;
--sage:#b9c9b0;--peach:#f6c6ad;--butter:#f6dfa5;--rose:#f2b8b0;--rose-deep:#d0645a;--accent:#e8825c;--accent-ink:#fff7f1;
--shadow:0 1px 2px rgba(80,50,30,.04),0 18px 40px -18px rgba(80,50,30,.28);--ease:cubic-bezier(.22,1,.36,1)}
@media (prefers-color-scheme:dark){:root{--bg:#1d1916;--surface:#26211d;--surface-2:#2f2924;--line:#3a322c;--text:#f3e8dc;--text-2:#bba897;--text-3:#8a7a6c;
--sage:#3b4637;--peach:#4a3128;--butter:#463b22;--rose:#4a2c2a;--rose-deep:#f08b80;--accent:#f08e66;--accent-ink:#2a1a12;
--shadow:0 1px 2px rgba(0,0,0,.3),0 18px 40px -18px rgba(0,0,0,.7)}}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:var(--bg);color:var(--text);display:grid;place-items:center;padding:20px;overflow:hidden}
.blob{position:fixed;border-radius:50%;filter:blur(60px);opacity:.55;z-index:0}
.b1{width:340px;height:340px;background:var(--peach);top:-80px;left:-60px}
.b2{width:300px;height:300px;background:var(--sage);bottom:-90px;right:-40px}
.b3{width:200px;height:200px;background:var(--butter);bottom:20%;left:12%}
.card{position:relative;z-index:1;width:min(380px,100%);background:var(--surface);border-radius:26px;box-shadow:var(--shadow);padding:34px 28px 28px;text-align:center;animation:rise .6s var(--ease)}
@keyframes rise{from{opacity:0;transform:translateY(14px) scale(.98)}}
.vinyl{width:84px;height:84px;margin:0 auto 18px;border-radius:50%;background:radial-gradient(circle,var(--accent) 0 17%,#2b2420 18% 100%);
box-shadow:inset 0 0 0 9px #2b2420,inset 0 0 0 10px #4a3f38,inset 0 0 0 18px #2b2420,inset 0 0 0 19px #4a3f38,0 10px 24px -10px rgba(0,0,0,.5);animation:spin 6s linear infinite;position:relative}
.vinyl::after{content:'';position:absolute;inset:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:#2b2420}
@keyframes spin{to{transform:rotate(360deg)}}
h1{margin:0;font-size:24px;font-weight:800;letter-spacing:-.02em}
p.sub{margin:6px 0 24px;color:var(--text-3);font-size:14px}
label{display:block;text-align:left;font-size:12.5px;font-weight:700;color:var(--text-2);margin:0 0 7px 4px}
.field{position:relative}
input{width:100%;height:48px;border:1px solid var(--line);border-radius:14px;background:var(--bg);color:var(--text);font:inherit;font-size:15px;padding:0 48px 0 16px;outline:0;transition:border-color .2s,box-shadow .2s}
input:focus{border-color:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 20%,transparent)}
.eye{position:absolute;right:6px;top:6px;width:36px;height:36px;border:0;border-radius:10px;background:none;color:var(--text-3);cursor:pointer;display:grid;place-items:center}
.eye:hover{background:var(--surface-2);color:var(--text)}
button.go{margin-top:16px;width:100%;height:48px;border:0;border-radius:999px;background:var(--accent);color:var(--accent-ink);font:inherit;font-weight:700;font-size:15px;cursor:pointer;
box-shadow:0 10px 22px -10px var(--accent);transition:transform .3s cubic-bezier(.34,1.56,.64,1),filter .2s}
button.go:hover{transform:translateY(-1px);filter:brightness(1.04)}
button.go:active{transform:scale(.97)}
button.go[disabled]{opacity:.7;pointer-events:none}
.err{margin:0 0 16px;padding:10px 12px;border-radius:12px;background:var(--rose);color:var(--text);font-size:13.5px;animation:shake .4s}
@keyframes shake{20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
.foot{margin-top:18px;font-size:12px;color:var(--text-3)}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
<main class="card">
  <div class="vinyl" aria-hidden="true"></div>
  <h1>Lulla</h1>
  <p class="sub">Góc nghe nhạc riêng của bạn</p>
  ${error ? '<p class="err" role="alert">Sai mật khẩu, thử lại nhé.</p>' : ''}
  <form method="post" action="/login" onsubmit="this.querySelector('.go').disabled=true">
    <input type="hidden" name="next" value="${esc(next)}">
    <label for="pw">Mật khẩu</label>
    <div class="field">
      <input id="pw" name="password" type="password" autocomplete="current-password" required autofocus>
      <button class="eye" type="button" aria-label="Hiện mật khẩu" onclick="var i=document.getElementById('pw');i.type=i.type==='password'?'text':'password';i.focus()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
    </div>
    <button class="go" type="submit">Vào nghe nhạc</button>
  </form>
  <p class="foot">Đăng nhập được giữ trong ${SESSION_DAYS} ngày</p>
</main>
</body>
</html>`
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
    },
  })
}

// ---------- Tải nhạc lên ----------

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
