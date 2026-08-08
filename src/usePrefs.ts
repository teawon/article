import { useCallback, useEffect, useState } from 'react'

// 좋아요 / 읽음 상태를 localStorage 에 보관한다. (id 집합)
const LIKED_KEY = 'article-audio:liked'
const READ_KEY = 'article-audio:read'
// 옵션: 서버 음성(고품질) 대신 브라우저 기기 음성으로만 재생
const BROWSER_TTS_KEY = 'article-audio:browserTts'

function loadBool(key: string): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(key) === '1'
}

function saveBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* 저장 실패는 무시 (프라이빗 모드 등) */
  }
}

function load(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? '[]'))
  } catch {
    return new Set()
  }
}

function save(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]))
  } catch {
    /* 저장 실패는 무시 (프라이빗 모드 등) */
  }
}

export interface Prefs {
  liked: Set<string>
  read: Set<string>
  browserTts: boolean
  toggleLike: (id: string) => void
  markRead: (id: string) => void
  toggleRead: (id: string) => void
  setBrowserTts: (on: boolean) => void
}

export function usePrefs(): Prefs {
  const [liked, setLiked] = useState<Set<string>>(() => load(LIKED_KEY))
  const [read, setRead] = useState<Set<string>>(() => load(READ_KEY))
  const [browserTts, setBrowserTtsState] = useState<boolean>(() => loadBool(BROWSER_TTS_KEY))

  useEffect(() => save(LIKED_KEY, liked), [liked])
  useEffect(() => save(READ_KEY, read), [read])

  const setBrowserTts = useCallback((on: boolean) => {
    setBrowserTtsState(on)
    saveBool(BROWSER_TTS_KEY, on)
  }, [])

  const toggleLike = useCallback((id: string) => {
    setLiked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const markRead = useCallback((id: string) => {
    setRead((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const toggleRead = useCallback((id: string) => {
    setRead((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  return { liked, read, browserTts, toggleLike, markRead, toggleRead, setBrowserTts }
}
