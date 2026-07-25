// 긱뉴스 수집 파이프라인 (추출까지만 — 낭독 보정은 article-narration 스킬이 담당)
// 실행: node scripts/collect.mjs [개수]
//
// 식별/중복 정책:
//   - 전역 키 = "<provider-slug>__<소스ID 또는 URL해시>"  (제목은 절대 기준으로 쓰지 않음)
//   - data/seen.json: 한 번이라도 수집한 키 장부(append-only). 여기 있으면 재수집 안 함
//     → retention 으로 오래된 파일을 지워도 다시 등록되지 않음("부활" 방지)
//   - 파일: data/raw/<key>.json (원문). 이후 스킬이 data/narrated/<key>.json 생성
//   - 보정 대기 = raw 에는 있으나 narrated 에는 없는 키

import { writeFile, readFile, readdir, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const RAW_DIR = join(ROOT, 'data', 'raw')
const NARRATED_DIR = join(ROOT, 'data', 'narrated')
const SEEN_PATH = join(ROOT, 'data', 'seen.json')
const LIMIT = Number(process.argv[2] ?? 5)

// ── 소스(provider) 정의: 늘어나면 여기에 어댑터를 추가 ────────────
const GEEKNEWS = {
  name: '긱뉴스',
  slug: 'geeknews',
  rss: 'https://news.hada.io/rss/news',
}

// 전역 키 생성 (제목 아님, 안정적 식별자만)
function makeKey(slug, { sourceId, url }) {
  if (sourceId) return `${slug}__${sourceId}`
  const hash = createHash('sha1').update(normalizeUrl(url)).digest('hex').slice(0, 10)
  return `${slug}__${hash}`
}

// URL 정규화: 추적 파라미터/프래그먼트/끝슬래시 제거 → 같은 글은 같은 키
function normalizeUrl(raw) {
  try {
    const u = new URL(raw)
    u.hash = ''
    for (const k of [...u.searchParams.keys()]) {
      if (/^utm_|^ref$|^fbclid$|^gclid$/i.test(k)) u.searchParams.delete(k)
    }
    return (u.origin + u.pathname).replace(/\/$/, '') + (u.search || '')
  } catch {
    return raw
  }
}

// ── HTML → 순수 텍스트(문단 배열) ─────────────────────────────
function stripHtml(html) {
  return html
    .replace(/<li[^>]*>/gi, '\n')
    .replace(/<\/(p|div|section|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

// ── 긱뉴스 어댑터 ─────────────────────────────────────────────
function parseGeeknewsFeed(xml) {
  const entries = []
  const re = /<entry>([\s\S]*?)<\/entry>/g
  let m
  while ((m = re.exec(xml))) {
    const block = m[1]
    const title = (block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
      block.match(/<title>([\s\S]*?)<\/title>/))?.[1]?.trim()
    const link = block.match(/<link[^>]*href='([^']+)'/)?.[1]
    const sourceId = link?.match(/id=(\d+)/)?.[1]
    const published = block.match(/<published>([^<]+)<\/published>/)?.[1]
    if (sourceId && title && link) entries.push({ sourceId, title, link, published })
  }
  return entries
}

async function fetchGeeknewsBody(topicUrl) {
  const res = await fetch(topicUrl)
  const html = await res.text()
  const titleBlock = html.match(/<div class='topictitle link'>([\s\S]*?)<\/div>/)?.[1] ?? ''
  const extUrl = titleBlock.match(/href='(https?:\/\/[^']+)'/)?.[1]
  const source = extUrl ? new URL(extUrl).hostname.replace(/^www\./, '') : 'news.hada.io'
  const section = html.match(/<section id='topic_contents'[^>]*>([\s\S]*?)<\/section>/)?.[1]
  const paragraphs = section ? stripHtml(section) : []
  return { source, paragraphs }
}

// ── 공통 유틸 ─────────────────────────────────────────────────
async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf-8'))
  } catch {
    return fallback
  }
}

async function idsInDir(dir) {
  try {
    const files = await readdir(dir)
    return new Set(files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')))
  } catch {
    return new Set()
  }
}

// ── 메인 ──────────────────────────────────────────────────────
async function main() {
  await mkdir(RAW_DIR, { recursive: true })
  const seen = new Set(await readJson(SEEN_PATH, []))

  console.log(`① RSS 수집: ${GEEKNEWS.rss}`)
  const xml = await (await fetch(GEEKNEWS.rss)).text()
  const entries = parseGeeknewsFeed(xml).slice(0, LIMIT)
  console.log(`   → ${entries.length}개 글 발견\n`)

  let added = 0
  for (const e of entries) {
    const key = makeKey(GEEKNEWS.slug, { sourceId: e.sourceId, url: e.link })
    if (seen.has(key)) {
      console.log(`· 스킵 [${key}] 이미 등록됨`)
      continue
    }
    process.stdout.write(`② 본문 추출 [${key}] ${e.title.slice(0, 24)}... `)
    try {
      const { source, paragraphs } = await fetchGeeknewsBody(e.link)
      if (!paragraphs.length) {
        console.log('건너뜀(본문 없음)')
        continue
      }
      const raw = {
        id: key,
        sourceId: e.sourceId,
        title: e.title,
        source,
        provider: GEEKNEWS.name,
        link: e.link,
        published: e.published,
        paragraphs,
      }
      await writeFile(join(RAW_DIR, `${key}.json`), JSON.stringify(raw, null, 2), 'utf-8')
      seen.add(key) // 장부에 등록 → 다시 수집 안 함
      added++
      console.log('OK')
    } catch (err) {
      console.log('실패:', err.message)
    }
  }

  await writeFile(SEEN_PATH, JSON.stringify([...seen].sort(), null, 2), 'utf-8')

  // 보정 대기 = raw 에는 있으나 narrated 에는 없는 것
  const rawIds = await idsInDir(RAW_DIR)
  const narratedIds = await idsInDir(NARRATED_DIR)
  const pending = [...rawIds].filter((id) => !narratedIds.has(id))

  console.log(`\n③ 신규 ${added}개 수집. seen 장부 ${seen.size}개.`)
  if (pending.length) {
    console.log(`\n보정 대기 ${pending.length}개:`)
    pending.forEach((id) => console.log(`   - ${id}`))
    console.log(`\n다음: "스킬로 보정해줘" 라고 요청하세요 (article-narration).`)
  } else {
    console.log(`\n보정 대기 없음 (raw 전부 narrated 존재).`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
