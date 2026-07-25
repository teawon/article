/** 긴 텍스트는 문장 단위로 끊어 읽어야 브라우저(특히 Safari)가 중간에 멈추지 않는다. */
export function splitIntoChunks(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** ISO 날짜 → "2026.07.25" */
export function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
}
