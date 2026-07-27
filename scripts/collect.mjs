// 긱뉴스 RSS 수집기 — 최신 글 N개(주제 무관). 주간호 수집은 collect-weekly.mjs 사용.
// 실행: node scripts/collect.mjs [개수]

import { GEEKNEWS, makeKey, fetchTopicBody, loadSeen, saveSeen, writeRaw, pendingIds } from './lib.mjs'

const RSS_URL = 'https://news.hada.io/rss/news'
const LIMIT = Number(process.argv[2] ?? 5)

function parseFeed(xml) {
  const entries = []
  const re = /<entry>([\s\S]*?)<\/entry>/g
  let m
  while ((m = re.exec(xml))) {
    const block = m[1]
    const title = (block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
      block.match(/<title>([\s\S]*?)<\/title>/))?.[1]?.trim()
    const link = block.match(/<link[^>]*href='([^']+)'/)?.[1]
    const sourceId = link?.match(/id=(\d+)/)?.[1]
    if (sourceId && title && link) entries.push({ sourceId, title, link })
  }
  return entries
}

async function main() {
  console.log(`① RSS 수집: ${RSS_URL}`)
  const xml = await (await fetch(RSS_URL)).text()
  const entries = parseFeed(xml).slice(0, LIMIT)
  console.log(`   → ${entries.length}개 글 발견\n`)

  const seen = await loadSeen()
  let added = 0
  for (const e of entries) {
    const key = makeKey(GEEKNEWS.slug, { sourceId: e.sourceId })
    if (seen.has(key)) {
      console.log(`· 스킵 [${key}] 이미 등록됨`)
      continue
    }
    process.stdout.write(`② 본문 추출 [${key}] ${e.title.slice(0, 24)}... `)
    try {
      const { source, paragraphs, published, comments } = await fetchTopicBody(e.link)
      if (!paragraphs.length) {
        console.log('건너뜀(본문 없음)')
        continue
      }
      await writeRaw(key, {
        id: key,
        sourceId: e.sourceId,
        title: e.title,
        source,
        provider: GEEKNEWS.name,
        link: e.link,
        published,
        paragraphs,
        comments,
      })
      seen.add(key)
      added++
      console.log('OK')
    } catch (err) {
      console.log('실패:', err.message)
    }
  }
  await saveSeen(seen)

  const pending = await pendingIds()
  console.log(`\n③ 신규 ${added}개 수집. seen 장부 ${seen.size}개.`)
  if (pending.length) {
    console.log(`\n보정 대기 ${pending.length}개:`)
    pending.forEach((id) => console.log(`   - ${id}`))
    console.log(`\n다음: "스킬로 보정해줘" 라고 요청하세요 (article-narration).`)
  } else {
    console.log(`\n보정 대기 없음.`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
