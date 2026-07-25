import { useEffect, useMemo, useRef } from 'react'
import type { Article } from './articles'
import type { Narrator } from './useNarrator'
import { formatDate, splitIntoChunks } from './utils'

interface Props {
  article: Article
  narrator: Narrator
  onBack: () => void
  onPrevArticle?: () => void
  onNextArticle?: () => void
}

export default function ArticleDetail({
  article,
  narrator,
  onBack,
  onPrevArticle,
  onNextArticle,
}: Props) {
  const sentences = useMemo(() => splitIntoChunks(article.script), [article.script])
  const isCurrent = narrator.articleId === article.id
  const activeIdx = isCurrent ? narrator.index : -1
  const highlightRef = useRef<HTMLParagraphElement | null>(null)

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeIdx])

  const onMain = () => {
    if (!isCurrent || !narrator.active) narrator.play(article)
    else narrator.toggle()
  }
  const mainIcon = !isCurrent || !narrator.active ? '▶' : narrator.paused ? '▶' : '⏸'

  return (
    <main className="wrap detail">
      <header className="detailbar">
        <button className="back" onClick={onBack} aria-label="목록으로">
          ‹ 목록
        </button>
        <span className="provider-chip">{article.provider}</span>
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
    </main>
  )
}
