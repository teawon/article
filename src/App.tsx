import { useEffect, useMemo, useState } from 'react'
import { articles } from './articles'
import { useNarrator } from './useNarrator'
import { usePrefs } from './usePrefs'
import { formatDate } from './utils'
import ArticleDetail from './ArticleDetail'

type StatusFilter = '전체' | '안읽음' | '좋아요'

export default function App() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceURI, setVoiceURI] = useState<string>('')
  const [rate, setRate] = useState(1)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tab, setTab] = useState('전체')
  const [status, setStatus] = useState<StatusFilter>('안읽음')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // 상세 진입 시점의 목록 순서 스냅샷 (읽음 처리로 필터가 바뀌어도 이전/다음 이동이 흔들리지 않도록)
  const [navIds, setNavIds] = useState<string[]>([])

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const narrator = useNarrator(voices, voiceURI, rate)
  const prefs = usePrefs()

  const tabs = useMemo(() => {
    const providers = Array.from(new Set(articles.map((a) => a.provider)))
    return ['전체', ...providers]
  }, [])

  const visible = useMemo(() => {
    return articles.filter((a) => {
      if (tab !== '전체' && a.provider !== tab) return false
      if (status === '안읽음' && prefs.read.has(a.id)) return false
      if (status === '좋아요' && !prefs.liked.has(a.id)) return false
      return true
    })
  }, [tab, status, prefs.read, prefs.liked])

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

  // 상세 열기 (읽음 처리). 목록에서 진입할 땐 현재 보이는 순서를 스냅샷으로 저장.
  const open = (id: string) => {
    prefs.markRead(id)
    setSelectedId(id)
  }
  const openFromList = (id: string) => {
    setNavIds(visible.map((a) => a.id))
    open(id)
  }

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

  // 상세 화면 — 필터가 아니라 진입 시점 스냅샷(navIds)과 전체 목록을 기준으로 조회
  const selected = selectedId ? articles.find((a) => a.id === selectedId) : undefined
  if (selected) {
    const navIdx = navIds.indexOf(selected.id)
    const goTo = (targetId?: string) => {
      if (!targetId) return
      narrator.stop()
      open(targetId)
    }
    return (
      <ArticleDetail
        article={selected}
        narrator={narrator}
        liked={prefs.liked.has(selected.id)}
        onToggleLike={() => prefs.toggleLike(selected.id)}
        onBack={() => setSelectedId(null)}
        onPrevArticle={navIdx > 0 ? () => goTo(navIds[navIdx - 1]) : undefined}
        onNextArticle={
          navIdx >= 0 && navIdx < navIds.length - 1 ? () => goTo(navIds[navIdx + 1]) : undefined
        }
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

      <nav className="statusfilter">
        {(['전체', '안읽음', '좋아요'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            className={s === status ? 'sf active' : 'sf'}
            onClick={() => setStatus(s)}
          >
            {s === '좋아요' ? '♥ 좋아요' : s}
          </button>
        ))}
      </nav>

      <ul className="list">
        {visible.map((a) => {
          const playing = narrator.articleId === a.id && narrator.active
          const isRead = prefs.read.has(a.id)
          const isLiked = prefs.liked.has(a.id)
          return (
            <li
              key={a.id}
              className={`card${isRead ? ' read' : ''}${playing ? ' active' : ''}`}
              onClick={() => openFromList(a.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openFromList(a.id)
                }
              }}
            >
              <div className="meta">
                <h2>
                  {isRead && <span className="readtag">읽음</span>}
                  {a.title}
                </h2>
                <div className="submeta">
                  <span className="src">{a.source}</span>
                  {a.published && <span className="date">{formatDate(a.published)}</span>}
                </div>
              </div>
              <div className="cardactions" onClick={(e) => e.stopPropagation()}>
                <button
                  className={isLiked ? 'iconbtn liked' : 'iconbtn'}
                  onClick={() => prefs.toggleLike(a.id)}
                  aria-label={isLiked ? '좋아요 취소' : '좋아요'}
                  title={isLiked ? '좋아요 취소' : '좋아요'}
                >
                  {isLiked ? '♥' : '♡'}
                </button>
                <button
                  className="iconbtn"
                  onClick={() => prefs.toggleRead(a.id)}
                  aria-label={isRead ? '안 읽음으로 표시' : '읽음으로 표시'}
                  title={isRead ? '안 읽음으로 표시' : '읽음으로 표시'}
                >
                  {isRead ? '↺' : '✓'}
                </button>
              </div>
              <span className="chevron">{playing ? '♪' : '›'}</span>
            </li>
          )
        })}
        {visible.length === 0 && <li className="empty">표시할 글이 없어요.</li>}
      </ul>

      <footer>
        <p className="note">
          카드를 누르면 상세 화면으로 이동하며 읽음으로 표시돼요. ♥ 는 좋아요, ✓ / ↺ 로 읽음 상태를
          바꿀 수 있어요. 상태는 이 브라우저에 저장됩니다.
        </p>
      </footer>
    </main>
  )
}
