// Đổi sáng/tối bằng vòng tròn lan ra từ vị trí bấm (View Transitions API)
export function useTheme() {
  const dark = useState('dark', () => false)

  function apply(v: boolean) {
    dark.value = v
    document.documentElement.classList.toggle('dark', v)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', v ? '#1d1916' : '#f6ece0')
    try {
      localStorage.setItem('lulla:theme', v ? 'dark' : 'light')
    } catch {}
  }

  function init() {
    let saved: string | null = null
    try {
      saved = localStorage.getItem('lulla:theme')
    } catch {}
    apply(saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches)
  }

  function toggle(e?: MouseEvent) {
    const next = !dark.value
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!doc.startViewTransition || reduce) return apply(next)

    const x = e?.clientX ?? innerWidth - 60
    const y = e?.clientY ?? 40
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    const t = doc.startViewTransition(() => apply(next))
    t.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
      )
    })
  }

  return { dark, init, toggle }
}
