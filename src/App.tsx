import { useEffect, useMemo, useRef, useState } from 'react'
import { articles, type Article } from './articles'

/** 긴 텍스트는 문장 단위로 끊어 읽어야 브라우저(특히 Safari)가 중간에 멈추지 않는다. */
function splitIntoChunks(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** ISO 날짜 → "2026.07.25" */
function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
}

export default function App() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURI] = useState<string>('')
  const [rate, setRate] = useState(1)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tab, setTab] = useState('전체')

  const runToken = useRef(0)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  // 탭 목록 = 전체 + provider 종류
  const tabs = useMemo(() => {
    const providers = Array.from(new Set(articles.map((a) => a.provider)))
    return ['전체', ...providers]
  }, [])

  const visible = useMemo(
    () => (tab === '전체' ? articles : articles.filter((a) => a.provider === tab)),
    [tab],
  )

  // 음성 로딩 (기본값: 유나 우선)
  useEffect(() => {
    if (!supported) return
    const load = () => {
      const all = window.speechSynthesis.getVoices()
      const korean = all.filter((v) => v.lang.toLowerCase().startsWith('ko'))
      const list = korean.length ? korean : all
      setVoices(list)
      setVoiceURI((prev) => {
        if (prev) return prev
        const yuna = list.find((v) => /yuna|유나/i.test(v.name))
        return (yuna ?? list[0])?.voiceURI ?? ''
      })
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [supported])

  const stop = () => {
    runToken.current++
    window.speechSynthesis.cancel()
    setPlayingId(null)
    setPaused(false)
  }

  const play = (article: Article) => {
    window.speechSynthesis.cancel()
    const token = ++runToken.current
    const voice = voices.find((v) => v.voiceURI === voiceURI) ?? null
    const chunks = splitIntoChunks(article.script)
    setPlayingId(article.id)
    setPaused(false)

    const speakChunk = (i: number) => {
      if (token !== runToken.current) return
      if (i >= chunks.length) {
        setPlayingId(null)
        return
      }
      const u = new SpeechSynthesisUtterance(chunks[i])
      if (voice) u.voice = voice
      u.lang = voice?.lang ?? 'ko-KR'
      u.rate = rate
      u.onend = () => speakChunk(i + 1)
      u.onerror = () => {
        if (token === runToken.current) setPlayingId(null)
      }
      window.speechSynthesis.speak(u)
    }
    speakChunk(0)
  }

  // 카드 클릭: 재생 / 일시정지 / 재개 토글
  const onCardClick = (article: Article) => {
    if (playingId !== article.id) {
      play(article)
    } else if (paused) {
      window.speechSynthesis.resume()
      setPaused(false)
    } else {
      window.speechSynthesis.pause()
      setPaused(true)
    }
  }

  if (!supported) {
    return (
      <main className="wrap">
        <h1>긱뉴스 오디오</h1>
        <p className="warn">
          이 브라우저는 음성 합성(Web Speech API)을 지원하지 않아요. 크롬이나 Safari에서 열어 주세요.
        </p>
      </main>
    )
  }

  return (
    <main className="wrap">
      <header className="topbar">
        <h1>아티클 오디오</h1>
        <button
          className="gear"
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label="재생 설정"
          aria-expanded={settingsOpen}
        >
          ⚙︎
        </button>
      </header>

      {settingsOpen && (
        <section className="settings">
          <label>
            음성
            <select value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)}>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>
          <label>
            속도 <strong>{rate.toFixed(1)}x</strong>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          </label>
        </section>
      )}

      <nav className="tabs">
        {tabs.map((t) => (
          <button
            key={t}
            className={t === tab ? 'tab active' : 'tab'}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      <ul className="list">
        {visible.map((a) => {
          const active = playingId === a.id
          const status = !active ? '▶' : paused ? '▶' : '⏸'
          return (
            <li
              key={a.id}
              className={active ? 'card active' : 'card'}
              onClick={() => onCardClick(a)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onCardClick(a)
                }
              }}
            >
              <div className="meta">
                <h2>{a.title}</h2>
                <div className="submeta">
                  <span className="src">{a.source}</span>
                  {a.published && <span className="date">{formatDate(a.published)}</span>}
                </div>
              </div>
              <div className="playstate">
                <span className="icon">{status}</span>
                {active && (
                  <button
                    className="stop"
                    onClick={(e) => {
                      e.stopPropagation()
                      stop()
                    }}
                    aria-label="정지"
                  >
                    ■
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <footer>
        <p className="note">
          카드를 누르면 재생됩니다. 화면을 켜 둔 상태에서만 재생돼요 — 화면을 끄면(특히 iOS)
          멈출 수 있습니다.
        </p>
      </footer>
    </main>
  )
}
