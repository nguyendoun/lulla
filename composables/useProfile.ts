export function useProfile() {
  const name = useState('profile-name', () => {
    if (import.meta.server) return 'Bạn'
    try {
      return localStorage.getItem('lulla:name') || 'Bạn'
    } catch {
      return 'Bạn'
    }
  })
  const initials = computed(() =>
    name.value
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join(''),
  )
  function setName(v: string) {
    name.value = v.trim() || 'Bạn'
    try {
      localStorage.setItem('lulla:name', name.value)
    } catch {}
  }
  return { name, initials, setName }
}
