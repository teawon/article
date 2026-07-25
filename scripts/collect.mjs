// 긱뉴스 수집 파이프라인 (추출까지만 — 낭독 보정은 article-narration 스킬이 담당)
// 실행: node scripts/collect.mjs [개수]
// 결과: data/raw/<id>.json 생성 (글 하나당 파일 하나, 보정 전 원문)
//   이후 article-narration 스킬이 data/narrated/<id>.json 을 만든다.

import { writeFile, readdir, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const RAW_DIR = join(ROOT, 'data', 'raw')
const NARRATED_DIR = join(ROOT, 'data', 'narrated')
const RSS_URL = 'https://news.hada.io/rss/news'
const LIMIT = Number(process.argv[2] ?? 5)

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

// ── ① RSS 파싱 ────────────────────────────────────────────────
function parseFeed(xml) {
  const entries = []
  const re = /<entry>([\s\S]*?)<\/entry>/g
  let m
  while ((m = re.exec(xml))) {
    const block = m[1]
    const title = (block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
      block.match(/<title>([\s\S]*?)<\/title>/))?.[1]?.trim()
    const link = block.match(/<link[^>]*href='([^']+)'/)?.[1]
    const id = link?.match(/id=(\d+)/)?.[1]
    const published = block.match(/<published>([^<]+)<\/published>/)?.[1]
    if (id && title && link) entries.push({ id, title, link, published })
  }
  return entries
}

// ── ② 본문 확보: #topic_contents 만 추출 ──────────────────────
async function fetchBody(topicUrl) {
  const res = await fetch(topicUrl)
  const html = await res.text()
  const titleBlock = html.match(/<div class='topictitle link'>([\s\S]*?)<\/div>/)?.[1] ?? ''
  const extUrl = titleBlock.match(/href='(https?:\/\/[^']+)'/)?.[1]
  const source = extUrl ? new URL(extUrl).hostname.replace(/^www\./, '') : 'news.hada.io'
  const section = html.match(/<section id='topic_contents'[^>]*>([\s\S]*?)<\/section>/)?.[1]
  const paragraphs = section ? stripHtml(section) : []
  return { source, paragraphs }
}

async function existingIds(dir) {
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
  const alreadyNarrated = await existingIds(NARRATED_DIR)

  console.log(`① RSS 수집: ${RSS_URL}`)
  const xml = await (await fetch(RSS_URL)).text()
  const entries = parseFeed(xml).slice(0, LIMIT)
  console.log(`   → ${entries.length}개 글 발견\n`)

  const pending = []
  for (const e of entries) {
    process.stdout.write(`② 본문 추출 [${e.id}] ${e.title.slice(0, 28)}... `)
    try {
      const { source, paragraphs } = await fetchBody(e.link)
      if (!paragraphs.length) {
        console.log('건너뜀(본문 없음)')
        continue
      }
      const raw = { id: e.id, title: e.title, source, link: e.link, published: e.published, paragraphs }
      await writeFile(join(RAW_DIR, `${e.id}.json`), JSON.stringify(raw, null, 2), 'utf-8')
      const done = alreadyNarrated.has(e.id)
      console.log(done ? 'OK (이미 보정됨)' : 'OK (보정 대기)')
      if (!done) pending.push(e)
    } catch (err) {
      console.log('실패:', err.message)
    }
  }

  console.log(`\n③ data/raw/ 저장 완료.`)
  if (pending.length) {
    console.log(`\n보정이 필요한 글 ${pending.length}개:`)
    pending.forEach((e) => console.log(`   - [${e.id}] ${e.title}`))
    console.log(`\n다음: "스킬로 보정해줘" 라고 요청하세요 (article-narration).`)
  } else {
    console.log(`\n새로 보정할 글이 없습니다. (전부 data/narrated/ 에 존재)`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
