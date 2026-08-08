import { useEffect, useMemo, useRef, useState } from 'react'
import type { Article } from './articles'
import type { AudioNarrator } from './useAudioNarrator'
import { estimateNarrationSec, formatDate, formatEstimate, splitIntoChunks } from './utils'

const stripChars = (s: string) => s.replace(/[^0-9A-Za-z가-힣]/g, '')

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
  const hasShort = !!article.scriptShort
  const [short, setShort] = useState(false)
  useEffect(() => setShort(false), [article.id])

  const activeScript = short && hasShort ? (article.scriptShort as string) : article.script
  const paragraphs = useMemo(() => splitIntoChunks(activeScript), [activeScript])
  const estLabel = useMemo(() => formatEstimate(estimateNarrationSec(activeScript)), [activeScript])
  const isCurrent = narrator.articleId === article.id
  const highlightRef = useRef<HTMLParagraphElement | null>(null)

  // 전체본/요약본 전환. 재생·로딩 중이면 그 버전으로 다시 재생.
  const switchVersion = (v: boolean) => {
    if (v === short) return
    setShort(v)
    if (isCurrent && (narrator.active || narrator.loading)) narrator.play(article, v)
  }

  // 단어 타이밍 → 문장별 시작 시각 (초)
  const sentenceStarts = useMemo(() => {
    const wb = narrator.boundaries
    if (!wb.length) return [] as number[]
    const cumEnd: number[] = []
    let acc = 0
    for (const w of wb) {
      acc += stripChars(w.text).length
      cumEnd.push(acc)
    }
    const starts: number[] = []
    let sentStart = 0
    for (const sent of paragraphs) {
      let idx = cumEnd.findIndex((e) => e > sentStart)
      if (idx < 0) idx = wb.length - 1
      starts.push(wb[idx]?.t ?? 0)
      sentStart += stripChars(sent).length
    }
    return starts
  }, [narrator.boundaries, paragraphs])

  // 현재 재생 시각이 속한 문장
  const activeIdx = useMemo(() => {
    if (!isCurrent || !sentenceStarts.length) return -1
    let idx = -1
    for (let i = 0; i < sentenceStarts.length; i++) {
      if (sentenceStarts[i] <= narrator.currentTime + 0.15) idx = i
      else break
    }
    return idx
  }, [isCurrent, sentenceStarts, narrator.currentTime])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [article.id])

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeIdx])

  const onMain = () => {
    if (!isCurrent || (!narrator.active && !narrator.loading)) narrator.play(article, short)
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
        <span className="est" title="낭독 예상 시간">🎧 {estLabel}</span>
      </div>
      {!!article.tags?.length && (
        <div className="badges">
          {article.tags.map((t) => (
            <span key={t} className="badge-tag">
              {t}
            </span>
          ))}
        </div>
      )}
      <a className="origin" href={article.link} target="_blank" rel="noreferrer">
        긱뉴스에서 원문·댓글 보기 ↗
      </a>

      {hasShort && (
        <div className="verstabs" role="tablist" aria-label="낭독 버전">
          <button
            role="tab"
            aria-selected={!short}
            className={short ? 'verstab' : 'verstab on'}
            onClick={() => switchVersion(false)}
          >
            전체본 · {formatEstimate(estimateNarrationSec(article.script))}
          </button>
          <button
            role="tab"
            aria-selected={short}
            className={short ? 'verstab on' : 'verstab'}
            onClick={() => switchVersion(true)}
          >
            요약본 · {formatEstimate(estimateNarrationSec(article.scriptShort as string))}
          </button>
        </div>
      )}

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

      {/* 전체 텍스트 + 현재 문장 하이라이트 (문장 클릭 시 그 지점부터 재생) */}
      <article className="fulltext">
        {paragraphs.map((s, i) => {
          const start = sentenceStarts[i]
          const clickable = isCurrent && start != null
          return (
            <p
              key={i}
              ref={i === activeIdx ? highlightRef : null}
              className={i === activeIdx ? 'sentence reading' : 'sentence'}
              onClick={() => {
                if (clickable) narrator.seekTo(start)
                else narrator.play(article, short)
              }}
            >
              {s}
            </p>
          )
        })}
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

      {/* 음성 준비 중 로딩 오버레이 */}
      {isCurrent && narrator.loading && (
        <div className="overlay" role="alert" aria-label="음성 준비 중">
          <div className="overlay-card loading-card">
            <div className="spinner" />
            <p className="loading-text">음성 준비 중…</p>
            <p className="loading-sub">잠깐만요, 자연스러운 음성을 만드는 중이에요</p>
          </div>
        </div>
      )}

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
