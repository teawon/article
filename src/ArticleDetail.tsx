import { useEffect, useMemo, useRef, useState } from 'react'
import type { Article } from './articles'
import type { Narrator } from './useNarrator'
import { formatDate, splitIntoChunks } from './utils'

interface Props {
  article: Article
  narrator: Narrator
  liked: boolean
  onToggleLike: () => void
  onBack: () => void
  onPrevArticle?: () => void
  onNextArticle?: () => void
  /** 다음 글로 넘어가며 자동 재생 (연속 청취). 없으면 마지막 글 */
  onAdvance?: () => void
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
  const sentences = useMemo(() => splitIntoChunks(article.script), [article.script])
  const isCurrent = narrator.articleId === article.id
  const activeIdx = isCurrent ? narrator.index : -1
  const highlightRef = useRef<HTMLParagraphElement | null>(null)

  // 다른 글로 넘어가면 스크롤을 맨 위로
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [article.id])

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeIdx])

  const onMain = () => {
    if (!isCurrent || !narrator.active) narrator.play(article)
    else narrator.toggle()
  }
  const mainIcon = !isCurrent || !narrator.active ? '▶' : narrator.paused ? '▶' : '⏸'

  // 낭독 완료 → 오버레이 + 자동 넘김
  const AUTO_SECONDS = 5
  const finished = narrator.completedId === article.id
  const [dismissed, setDismissed] = useState(false)
  const [countdown, setCountdown] = useState(AUTO_SECONDS)

  useEffect(() => {
    setDismissed(false) // 새 글로 넘어오면 오버레이 상태 초기화
  }, [article.id])

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
            title={liked ? '좋아요 취소' : '좋아요'}
          >
            {liked ? '♥' : '♡'}
          </button>
          <span className="provider-chip">{article.provider}</span>
        </div>
      </header>

      <h1 className="detail-title">{article.title}</h1>
      <div className="submeta">
        <a href={article.link} target="_blank" rel="noreferrer" className="src">
          {article.source}
        </a>
        {article.published && <span className="date">{formatDate(article.published)}</span>}
      </div>

      {isCurrent && narrator.total > 0 && (
        <p className="progress">
          {narrator.index + 1} / {narrator.total} 문장
        </p>
      )}

      {/* 전체 텍스트 + 현재 문장 하이라이트 */}
      <article className="fulltext">
        {sentences.map((s, i) => (
          <p
            key={i}
            ref={i === activeIdx ? highlightRef : null}
            className={i === activeIdx ? 'sentence reading' : 'sentence'}
            onClick={() => narrator.play(article, i)}
          >
            {s}
          </p>
        ))}
      </article>

      {/* 이전/다음 아티클 (전체 목록 순서) */}
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
            onClick={() => narrator.prev()}
            disabled={!isCurrent}
            aria-label="이전 문장"
          >
            ⏮
          </button>
          <button className="pb main" onClick={onMain} aria-label="재생/일시정지">
            {mainIcon}
          </button>
          <button
            className="pb"
            onClick={() => narrator.next()}
            disabled={!isCurrent}
            aria-label="다음 문장"
          >
            ⏭
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
