// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  ssr: false, // app nghe nhạc cá nhân → SPA cho mượt, không cần SEO
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    // Đổi bằng biến môi trường: MUSIC_DIR=/duong/dan/nhac npm run dev
    musicDir: process.env.MUSIC_DIR || './music',
  },
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'Lulla · cozy player',
      htmlAttrs: { lang: 'vi' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#f6ece0' },
      ],
      // Đặt theme trước khi vẽ trang để không bị nháy sáng
      script: [
        {
          innerHTML:
            "try{var t=localStorage.getItem('lulla:theme');if(t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')}catch(e){}",
        },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
        },
      ],
    },
  },
})
