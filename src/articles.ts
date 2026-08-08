export interface Article {
  id: string
  title: string
  /** 외부 원본 도메인 (예: github.com) */
  source: string
  /** 수집처 = 상단 탭 기준 (예: 긱뉴스) */
  provider: string
  link: string
  /** 원본 게시일 (ISO 8601) */
  published?: string
  /** 주제 태그 (AI, 프론트엔드, 도구 등). article-narration 스킬이 분류. */
  tags?: string[]
  /** 낭독 대본. article-narration 스킬이 운전용으로 재작성. */
  script: string
  /** 요약 낭독 대본 (긴 글에만). 있으면 상세페이지에 '요약본' 탭이 뜬다. */
  scriptShort?: string
}

// 데이터 파이프라인:
//   1) node scripts/collect.mjs   → data/raw/<id>.json (원문 수집)
//   2) article-narration 스킬      → data/narrated/<id>.json (운전용 대본)
// 웹앱은 보정 결과(data/narrated)만 읽는다. 원문(무거움)은 로드하지 않는다.
const modules = import.meta.glob<{ default: Article }>('../data/narrated/*.json', {
  eager: true,
})

export const articles: Article[] = Object.values(modules)
  .map((m) => m.default)
  // 최신순 정렬 (published 내림차순)
  .sort((a, b) => (b.published ?? '').localeCompare(a.published ?? ''))
