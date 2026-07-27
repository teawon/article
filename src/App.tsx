import { useMemo, useState } from 'react'
import { articles } from './articles'
import { useAudioNarrator } from './useAudioNarrator'
import { usePrefs } from './usePrefs'
import { formatDate } from './utils'
import ArticleDetail from './ArticleDetail'

type StatusFilter = '전체' | '안읽음' | '좋아요'

const VOICES = [
  { id: 'ko-KR-SunHiNeural', name: '선희 (여성)' },
  { id: 'ko-KR-InJoonNeural', name: '인준 (남성)' },
  { id: 'ko-KR-HyunsuMultilingualNeural', name: '현수 (멀티)' },
]

export default function App() {
  const [voice, setVoice] = useState(VOICES[0].id)
  const [rate, setRate] = useState(1)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tab, setTab] = useState('전체')
  const [status, setStatus] = useState<StatusFilter>('안읽음')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [navIds, setNavIds] = useState<string[]>([])

  const narrator = useAudioNarrator(voice, rate)
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

  const open = (id: string) => {
    prefs.markRead(id)
    setSelectedId(id)
  }
  const openFromList = (id: string) => {
    setNavIds(visible.map((a) => a.id))
    open(id)
  }
  const openAndPlay = (id: string) => {
    const a = articles.find((x) => x.id === id)
    if (!a) return
    prefs.markRead(id)
    setSelectedId(id)
    narrator.play(a)
  }

  // 상세 화면 — 필터가 아니라 진입 시점 스냅샷(navIds)과 전체 목록 기준으로 조회
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
        onAdvance={
          navIdx >= 0 && navIdx < navIds.length - 1
            ? () => openAndPlay(navIds[navIdx + 1])
            : undefined
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
            <select value={voice} onChange={(e) => setVoice(e.target.value)}>
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
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
          <button key={s} className={s === status ? 'sf active' : 'sf'} onClick={() => setStatus(s)}>
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
                >
                  {isLiked ? '♥' : '♡'}
                </button>
                <button
                  className="iconbtn"
                  onClick={() => prefs.toggleRead(a.id)}
                  aria-label={isRead ? '안 읽음으로 표시' : '읽음으로 표시'}
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
          카드를 누르면 상세 화면으로 이동해요. 음성은 마이크로소프트 신경망 음성(무료)으로 재생되며,
          서버 연결이 안 되는 환경에서는 기기 음성으로 대체됩니다.
        </p>
      </footer>
    </main>
  )
}
