/** 긴 텍스트는 문장 단위로 끊어 읽어야 브라우저(특히 Safari)가 중간에 멈추지 않는다. */
export function splitIntoChunks(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 문장들을 최대 글자 수 이하 그룹으로 묶는다.
 * 서버리스 TTS(1회 응답 4.5MB·60초 한계)를 넘지 않도록, 한 요청이
 * 너무 긴 오디오를 만들지 않게 나누는 용도. 한 문장이 상한을 넘으면
 * 그 문장은 단독 그룹이 된다.
 */
export function groupByChars(text: string, maxChars = 2800): string[] {
  const groups: string[] = []
  let cur = ''
  for (const s of splitIntoChunks(text)) {
    if (cur && cur.length + 1 + s.length > maxChars) {
      groups.push(cur)
      cur = s
    } else {
      cur = cur ? `${cur} ${s}` : s
    }
  }
  if (cur) groups.push(cur)
  return groups
}

/**
 * 대본 글자수로 낭독 예상 시간(초)을 추정한다.
 * EdgeTTS(ko, 48kbps) 실측 기준 대략 초당 8자.
 */
export function estimateNarrationSec(script: string): number {
  return Math.round((script?.length || 0) / 8)
}

/** 예상 시간(초) → "약 6분" / "약 1분" (목록·상세 표시용) */
export function formatEstimate(sec: number): string {
  return `약 ${Math.max(1, Math.round(sec / 60))}분`
}

/** ISO 날짜 → "2026.07.25" */
export function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
}
