import { useCallback, useRef, useState } from 'react'
import { splitIntoChunks } from './utils'
import type { Article } from './articles'

export interface Narrator {
  /** 현재 재생 대상 글 id (없으면 null) */
  articleId: string | null
  /** 현재 읽고 있는 문장 인덱스 */
  index: number
  /** 전체 문장 수 */
  total: number
  /** 세션 활성(재생 중 또는 일시정지) 여부 */
  active: boolean
  /** 일시정지 여부 */
  paused: boolean
  /** 방금 끝까지 재생 완료된 글 id (정지/중단이 아니라 자연 종료). 없으면 null */
  completedId: string | null
  play: (a: Article, startIndex?: number) => void
  toggle: () => void
  stop: () => void
  next: () => void
  prev: () => void
}

/**
 * Web Speech API 기반 낭독기.
 * 대본을 문장 배열로 쪼개 인덱스로 재생하므로, 문장 단위 이전/다음과
 * 현재 문장 하이라이트가 가능하다. (시간 단위 seek 은 Web Speech 로 불가)
 */
export function useNarrator(
  voices: SpeechSynthesisVoice[],
  voiceURI: string,
  rate: number,
): Narrator {
  const [articleId, setArticleId] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [total, setTotal] = useState(0)
  const [active, setActive] = useState(false)
  const [paused, setPaused] = useState(false)
  const [completedId, setCompletedId] = useState<string | null>(null)
  const chunksRef = useRef<string[]>([])
  const articleIdRef = useRef<string | null>(null) // 완료 시점에 어떤 글이었는지 참조
  const token = useRef(0) // 재생 세션 토큰: 증가시키면 이전 재생 콜백이 무효화됨

  const playFrom = useCallback(
    (i: number) => {
      const chunks = chunksRef.current
      if (!chunks.length) return
      const start = Math.max(0, Math.min(i, chunks.length - 1))
      window.speechSynthesis.cancel()
      const my = ++token.current
      setActive(true)
      setPaused(false)
      setCompletedId(null)

      const step = (j: number) => {
        if (my !== token.current) return
        if (j >= chunks.length) {
          setActive(false)
          setCompletedId(articleIdRef.current) // 자연 종료
          return
        }
        setIndex(j)
        const u = new SpeechSynthesisUtterance(chunks[j])
        const voice = voices.find((v) => v.voiceURI === voiceURI) ?? null
        if (voice) u.voice = voice
        u.lang = voice?.lang ?? 'ko-KR'
        u.rate = rate
        u.onend = () => step(j + 1)
        u.onerror = () => {
          if (my === token.current) setActive(false)
        }
        window.speechSynthesis.speak(u)
      }
      step(start)
    },
    [voices, voiceURI, rate],
  )

  const play = useCallback(
    (a: Article, startIndex = 0) => {
      chunksRef.current = splitIntoChunks(a.script)
      articleIdRef.current = a.id
      setArticleId(a.id)
      setTotal(chunksRef.current.length)
      playFrom(startIndex)
    },
    [playFrom],
  )

  const toggle = useCallback(() => {
    if (!active) return
    if (paused) {
      window.speechSynthesis.resume()
      setPaused(false)
    } else {
      window.speechSynthesis.pause()
      setPaused(true)
    }
  }, [active, paused])

  const stop = useCallback(() => {
    token.current++
    window.speechSynthesis.cancel()
    setActive(false)
    setPaused(false)
    setIndex(0)
    setCompletedId(null)
  }, [])

  const next = useCallback(() => playFrom(index + 1), [playFrom, index])
  const prev = useCallback(() => playFrom(index - 1), [playFrom, index])

  return { articleId, index, total, active, paused, completedId, play, toggle, stop, next, prev }
}
