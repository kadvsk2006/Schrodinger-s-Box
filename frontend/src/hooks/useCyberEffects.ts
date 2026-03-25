/**
 * useCyberEffects — Global cyber interactions:
 *   1. Keyboard glitch: any keypress briefly glitches nearest heading
 *   2. Scroll-reveal: IntersectionObserver fades in [data-reveal] elements
 *   3. Parallax: background layers move at different speeds on scroll
 */
import { useEffect } from 'react'

export function useCyberEffects() {
  // ── 1. KEYBOARD GLITCH ──────────────────────────────────────────
  useEffect(() => {
    let glitchTimeout: ReturnType<typeof setTimeout> | null = null

    const handleKeyDown = () => {
      // Find the first visible heading in viewport
      const headings = document.querySelectorAll<HTMLElement>('h1, h2, h3, .glitch-target')
      for (const h of headings) {
        const rect = h.getBoundingClientRect()
        if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
          h.classList.add('cyber-glitch-active')
          if (glitchTimeout) clearTimeout(glitchTimeout)
          glitchTimeout = setTimeout(() => h.classList.remove('cyber-glitch-active'), 180)
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (glitchTimeout) clearTimeout(glitchTimeout)
    }
  }, [])

  // ── 2. SCROLL-REVEAL (IntersectionObserver) ─────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement
            const delay = el.dataset.revealDelay || '0'
            el.style.transitionDelay = `${delay}ms`
            el.classList.add('revealed')
            observer.unobserve(el) // fire once
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )

    // Observe all [data-reveal] elements in DOM
    const applyToAll = () => {
      document.querySelectorAll('[data-reveal]').forEach((el) => {
        if (!el.classList.contains('revealed')) {
          observer.observe(el)
        }
      })
    }

    applyToAll()

    // Re-run on dynamic content changes
    const mutationObs = new MutationObserver(applyToAll)
    mutationObs.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mutationObs.disconnect()
    }
  }, [])

  // ── 3. PARALLAX DEPTH ───────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY

      // Crypto-particle shapes move at different parallax speeds
      const p1 = document.querySelector<HTMLElement>('.crypto-parallax-slow')
      const p2 = document.querySelector<HTMLElement>('.crypto-parallax-mid')
      const p3 = document.querySelector<HTMLElement>('.crypto-parallax-fast')

      if (p1) p1.style.transform = `translateY(${y * 0.08}px)`
      if (p2) p2.style.transform = `translateY(${y * 0.14}px)`
      if (p3) p3.style.transform = `translateY(${y * 0.22}px)`
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
}
