import { useEffect, useMemo, useState } from 'react'
import { articles } from './articles'
import { useNarrator } from './useNarrator'
import { formatDate } from './utils'
import ArticleDetail from './ArticleDetail'

export default function App() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURI] = useState<string>('')
  const [rate, setRate] = useState(1)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tab, setTab] = useState('전체')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const narrator = useNarrator(voices, voiceURI, rate)

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

  if (!supported) {
    return (
      <main className="wrap">
        <h1>아티클 오디오</h1>
        <p className="warn">
          이 브라우저는 음성 합성(Web Speech API)을 지원하지 않아요. 크롬이나 Safari에서 열어 주세요.
        </p>
      </main>
    )
  }

  // 상세 화면
  const selIdx = selectedId ? visible.findIndex((a) => a.id === selectedId) : -1
  if (selIdx >= 0) {
    const selected = visible[selIdx]
    const goTo = (target?: { id: string }) => {
      if (!target) return
      narrator.stop()
      setSelectedId(target.id)
    }
    return (
      <ArticleDetail
        article={selected}
        narrator={narrator}
        onBack={() => setSelectedId(null)}
        onPrevArticle={selIdx > 0 ? () => goTo(visible[selIdx - 1]) : undefined}
        onNextArticle={selIdx < visible.length - 1 ? () => goTo(visible[selIdx + 1]) : undefined}
      />
    )
  }

  // 목록 화면
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
          <button key={t} className={t === tab ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      <ul className="list">
        {visible.map((a) => {
          const playing = narrator.articleId === a.id && narrator.active
          return (
            <li
              key={a.id}
              className={playing ? 'card active' : 'card'}
              onClick={() => setSelectedId(a.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelectedId(a.id)
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
              <span className="chevron">{playing ? '♪' : '›'}</span>
            </li>
          )
        })}
      </ul>

      <footer>
        <p className="note">
          카드를 누르면 상세 화면으로 이동해 전체 텍스트를 보며 들을 수 있어요. 화면을 끄면(특히
          iOS) 재생이 멈출 수 있습니다.
        </p>
      </footer>
    </main>
  )
}
