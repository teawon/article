import { useEffect, useMemo, useState } from 'react'
import type { Article } from './articles'
import type { AudioNarrator } from './useAudioNarrator'
import { formatDate, splitIntoChunks } from './utils'

interface Props {
  article: Article
  narrator: AudioNarrator
  liked: boolean
  onToggleLike: () => void
  onBack: () => void
  onPrevArticle?: () => void
  onNextArticle?: () => void
  onAdvance?: () => void
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function ArticleDetail({
  article,
  narrator,
  liked,
  onToggleLike,
  onBack,
  onPrevArticle,
  onNextArticle,
  onAdvance,
}: Props) {
  const paragraphs = useMemo(() => splitIntoChunks(article.script), [article.script])
  const isCurrent = narrator.articleId === article.id

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [article.id])

  const onMain = () => {
    if (!isCurrent || (!narrator.active && !narrator.loading)) narrator.play(article)
    else narrator.toggle()
  }
  const mainIcon = narrator.loading && isCurrent ? '…' : isCurrent && narrator.active && !narrator.paused ? '⏸' : '▶'

  // 낭독 완료 → 오버레이 + 자동 넘김
  const AUTO_SECONDS = 5
  const finished = narrator.completedId === article.id
  const [dismissed, setDismissed] = useState(false)
  const [countdown, setCountdown] = useState(AUTO_SECONDS)

  useEffect(() => setDismissed(false), [article.id])

  const showOverlay = finished && !dismissed
  useEffect(() => {
    if (!showOverlay || !onAdvance) return
    setCountdown(AUTO_SECONDS)
    const iv = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000)
    const to = setTimeout(() => onAdvance(), AUTO_SECONDS * 1000)
    return () => {
      clearInterval(iv)
      clearTimeout(to)
    }
  }, [showOverlay, onAdvance, article.id])

  const cur = isCurrent ? narrator.currentTime : 0
  const dur = isCurrent ? narrator.duration : 0

  return (
    <main className="wrap detail">
      <header className="detailbar">
        <button className="back" onClick={onBack} aria-label="목록으로">
          ‹ 목록
        </button>
        <div className="detailbar-right">
          <button
            className={liked ? 'iconbtn liked' : 'iconbtn'}
            onClick={onToggleLike}
            aria-label={liked ? '좋아요 취소' : '좋아요'}
          >
            {liked ? '♥' : '♡'}
          </button>
          <span className="provider-chip">{article.provider}</span>
        </div>
      </header>

      <h1 className="detail-title">{article.title}</h1>
      <div className="submeta">
        <span className="src">{article.source}</span>
        {article.published && <span className="date">{formatDate(article.published)}</span>}
      </div>
      <a className="origin" href={article.link} target="_blank" rel="noreferrer">
        긱뉴스에서 원문·댓글 보기 ↗
      </a>

      {isCurrent && narrator.fallback && (
        <p className="fallback-note">서버 음성을 못 불러와 기기 음성(유나)으로 재생 중이에요.</p>
      )}

      {/* 진행바 */}
      {isCurrent && !narrator.fallback && (
        <div className="seekrow">
          <span className="time">{fmt(cur)}</span>
          <input
            type="range"
            className="seekbar"
            min={0}
            max={dur || 0}
            step={0.1}
            value={cur}
            onChange={(e) => narrator.seekTo(Number(e.target.value))}
            disabled={!dur}
          />
          <span className="time">{fmt(dur)}</span>
        </div>
      )}

      {/* 전체 텍스트 (읽기용) */}
      <article className="fulltext">
        {paragraphs.map((s, i) => (
          <p key={i} className="sentence">
            {s}
          </p>
        ))}
      </article>

      {/* 이전/다음 아티클 */}
      <nav className="articlenav">
        <button onClick={onPrevArticle} disabled={!onPrevArticle}>
          ← 이전 글
        </button>
        <button onClick={onNextArticle} disabled={!onNextArticle}>
          다음 글 →
        </button>
      </nav>

      {/* 하단 고정 재생바 */}
      <div className="playbar">
        <div className="playbar-inner">
          <button
            className="pb"
            onClick={() => narrator.seek(-10)}
            disabled={!isCurrent || narrator.fallback}
            aria-label="10초 뒤로"
          >
            ⏪
          </button>
          <button className="pb main" onClick={onMain} aria-label="재생/일시정지">
            {mainIcon}
          </button>
          <button
            className="pb"
            onClick={() => narrator.seek(10)}
            disabled={!isCurrent || narrator.fallback}
            aria-label="10초 앞으로"
          >
            ⏩
          </button>
          <button
            className="pb"
            onClick={() => narrator.stop()}
            disabled={!isCurrent}
            aria-label="정지"
          >
            ■
          </button>
          <button className="pb ai" disabled title="다음 단계에서 연결 예정" aria-label="AI 질문">
            🤖
          </button>
        </div>
      </div>

      {/* 낭독 완료 오버레이 */}
      {showOverlay && (
        <div className="overlay" role="dialog" aria-label="낭독 완료">
          <div className="overlay-card">
            <p className="overlay-done">✓ 낭독 완료</p>
            {onAdvance ? (
              <>
                <button className="overlay-next" onClick={onAdvance}>
                  다음 글 듣기
                  <span className="overlay-count">{countdown}초 후 자동 재생</span>
                </button>
                <button className="overlay-stay" onClick={() => setDismissed(true)}>
                  이 글에 머무르기
                </button>
              </>
            ) : (
              <>
                <p className="overlay-last">마지막 글입니다.</p>
                <button className="overlay-next" onClick={onBack}>
                  목록으로
                </button>
                <button className="overlay-stay" onClick={() => setDismissed(true)}>
                  이 글에 머무르기
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
