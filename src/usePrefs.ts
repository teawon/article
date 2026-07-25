import { useCallback, useEffect, useState } from 'react'

// 좋아요 / 읽음 상태를 localStorage 에 보관한다. (id 집합)
const LIKED_KEY = 'article-audio:liked'
const READ_KEY = 'article-audio:read'

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
  toggleLike: (id: string) => void
  markRead: (id: string) => void
  toggleRead: (id: string) => void
}

export function usePrefs(): Prefs {
  const [liked, setLiked] = useState<Set<string>>(() => load(LIKED_KEY))
  const [read, setRead] = useState<Set<string>>(() => load(READ_KEY))

  useEffect(() => save(LIKED_KEY, liked), [liked])
  useEffect(() => save(READ_KEY, read), [read])

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

  return { liked, read, toggleLike, markRead, toggleRead }
}
