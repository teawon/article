import { useCallback, useEffect, useRef, useState } from 'react'
import type { Article } from './articles'
import { splitIntoChunks } from './utils'

export interface AudioNarrator {
  articleId: string | null
  active: boolean
  paused: boolean
  loading: boolean
  currentTime: number
  duration: number
  completedId: string | null
  /** 서버 음성 실패로 기기 음성(유나)로 대체 재생 중인지 */
  fallback: boolean
  play: (a: Article) => void
  toggle: () => void
  stop: () => void
  seek: (delta: number) => void
  seekTo: (t: number) => void
}

/**
 * 엣지(마이크로소프트) 신경망 음성을 /api/tts 로 받아 <audio> 로 재생.
 * 실패(로컬 dev 등)하면 기기 음성(Web Speech)로 자동 대체.
 */
export function useAudioNarrator(voice: string, rate: number): AudioNarrator {
  const [articleId, setArticleId] = useState<string | null>(null)
  const [active, setActive] = useState(false)
  const [paused, setPaused] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [completedId, setCompletedId] = useState<string | null>(null)
  const [fallback, setFallback] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cacheRef = useRef<Map<string, string>>(new Map()) // `${voice}:${id}` -> objectURL
  const curId = useRef<string | null>(null)
  const reqToken = useRef(0)
  const speechToken = useRef(0)

  // <audio> 초기화
  useEffect(() => {
    const a = new Audio()
    audioRef.current = a
    const onTime = () => setCurrentTime(a.currentTime)
    const onMeta = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0)
    const onEnd = () => {
      setActive(false)
      setCompletedId(curId.current)
    }
    const onPlay = () => setPaused(false)
    const onPause = () => setPaused(true)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('durationchange', onMeta)
    a.addEventListener('ended', onEnd)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    return () => {
      a.pause()
      a.removeAttribute('src')
    }
  }, [])

  // 배속은 재생성 없이 즉시 반영
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate
  }, [rate])

  const cancelSpeech = () => {
    speechToken.current++
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  // 기기 음성 대체 재생 (문장 단위)
  const speakFallback = useCallback(
    (a: Article) => {
      if (!('speechSynthesis' in window)) return
      setFallback(true)
      setActive(true)
      setPaused(false)
      const my = ++speechToken.current
      const chunks = splitIntoChunks(a.script)
      const step = (i: number) => {
        if (my !== speechToken.current) return
        if (i >= chunks.length) {
          setActive(false)
          setCompletedId(a.id)
          return
        }
        const u = new SpeechSynthesisUtterance(chunks[i])
        u.lang = 'ko-KR'
        u.rate = rate
        u.onend = () => step(i + 1)
        window.speechSynthesis.speak(u)
      }
      step(0)
    },
    [rate],
  )

  const play = useCallback(
    async (a: Article) => {
      const audio = audioRef.current
      if (!audio) return
      cancelSpeech()
      audio.pause()
      const my = ++reqToken.current
      curId.current = a.id
      setArticleId(a.id)
      setCompletedId(null)
      setFallback(false)
      setCurrentTime(0)
      setDuration(0)

      const key = `${voice}:${a.id}`
      let url = cacheRef.current.get(key)
      if (!url) {
        setLoading(true)
        try {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: a.script, voice }),
          })
          if (!res.ok) throw new Error('tts ' + res.status)
          const blob = await res.blob()
          if (blob.type.includes('json') || blob.size < 1000) throw new Error('bad audio')
          url = URL.createObjectURL(blob)
          cacheRef.current.set(key, url)
        } catch {
          if (my !== reqToken.current) return
          setLoading(false)
          speakFallback(a) // 서버 음성 실패 → 기기 음성으로
          return
        }
        if (my !== reqToken.current) return
        setLoading(false)
      }

      audio.src = url
      audio.playbackRate = rate
      setActive(true)
      try {
        await audio.play()
      } catch {
        /* 사용자 제스처 없이 자동재생 차단 시 무시 */
      }
    },
    [voice, rate, speakFallback],
  )

  const toggle = useCallback(() => {
    if (fallback) {
      if (paused) {
        window.speechSynthesis.resume()
        setPaused(false)
      } else {
        window.speechSynthesis.pause()
        setPaused(true)
      }
      return
    }
    const audio = audioRef.current
    if (!audio || !active) return
    if (audio.paused) audio.play()
    else audio.pause()
  }, [fallback, paused, active])

  const stop = useCallback(() => {
    cancelSpeech()
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setActive(false)
    setPaused(false)
    setFallback(false)
    setCompletedId(null)
  }, [])

  const seek = useCallback((delta: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration)) return
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + delta, audio.duration))
  }, [])

  const seekTo = useCallback((t: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = t
  }, [])

  return {
    articleId,
    active,
    paused,
    loading,
    currentTime,
    duration,
    completedId,
    fallback,
    play,
    toggle,
    stop,
    seek,
    seekTo,
  }
}
