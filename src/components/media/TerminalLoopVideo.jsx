import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

const POSTER_SRC = '/hero-terminal-poster.webp'

export default function TerminalLoopVideo({
  alt = '',
  className,
  pauseDuringScroll = false,
  priority = false,
  style,
}) {
  const videoRef = useRef(null)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const video = videoRef.current
    if (!video || reduceMotion) return undefined

    let inView = true
    let scrolling = false
    let scrollResumeTimer = 0
    let playRetryTimer = 0
    let scrollPauseCount = 0
    const play = () => {
      video.play().catch(() => {
        window.clearTimeout(playRetryTimer)
        playRetryTimer = window.setTimeout(() => {
          if (inView && !document.hidden && !scrolling && video.paused) {
            video.play().catch(() => {})
          }
        }, 90)
      })
    }
    const syncPlayback = () => {
      if (inView && !document.hidden && !scrolling) play()
      else video.pause()
    }
    const onScroll = () => {
      if (!pauseDuringScroll || !inView) return
      if (!scrolling) {
        scrolling = true
        scrollPauseCount += 1
        video.dataset.scrollPaused = 'true'
        video.dataset.scrollPauseCount = String(scrollPauseCount)
        video.closest('.tn-hero')?.classList.add('is-scrolling')
        video.pause()
      }
      window.clearTimeout(scrollResumeTimer)
      scrollResumeTimer = window.setTimeout(() => {
        scrolling = false
        video.dataset.scrollPaused = 'false'
        video.closest('.tn-hero')?.classList.remove('is-scrolling')
        syncPlayback()
        window.clearTimeout(playRetryTimer)
        playRetryTimer = window.setTimeout(() => {
          if (inView && !document.hidden && !scrolling && video.paused) play()
        }, 90)
      }, 140)
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      syncPlayback()
    }, { rootMargin: '120px 0px' })

    observer.observe(video)
    document.addEventListener('visibilitychange', syncPlayback)
    if (pauseDuringScroll) window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearTimeout(scrollResumeTimer)
      window.clearTimeout(playRetryTimer)
      observer.disconnect()
      document.removeEventListener('visibilitychange', syncPlayback)
      window.removeEventListener('scroll', onScroll)
      video.closest('.tn-hero')?.classList.remove('is-scrolling')
      video.pause()
    }
  }, [pauseDuringScroll, reduceMotion])

  if (reduceMotion) {
    return (
      <img
        src={POSTER_SRC}
        alt={alt}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        style={style}
      />
    )
  }

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay={priority}
      muted
      loop
      playsInline
      preload={priority ? 'auto' : 'metadata'}
      poster={POSTER_SRC}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      style={style}
    >
      <source src="/hero-terminal.mp4" type="video/mp4" />
      <source src="/hero-terminal.webm" type="video/webm" />
    </video>
  )
}
