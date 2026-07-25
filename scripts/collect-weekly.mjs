// 긱뉴스 주간호(weekly) 수집기 — 매주 월요일 발행되는 "엄선된 이슈 묶음"을 수집
// 실행: node scripts/collect-weekly.mjs [주차]
//   인자 없으면 최신 주간호. 특정 호는 "202629" 처럼 주차 지정.
//
// 주간호는 긱뉴스가 그 주의 큰 이슈를 이미 큐레이션한 것이라 별도 필터가 필요 없다.
// 각 토픽 링크의 #topic_contents 를 추출해 data/raw/<key>.json 으로 저장한다.

import {
  GEEKNEWS,
  makeKey,
  fetchTopicBody,
  loadSeen,
  saveSeen,
  writeRaw,
  pendingIds,
} from './lib.mjs'

const WEEKLY_BASE = 'https://news.hada.io/weekly'

// 최신 주간호 URL 찾기 (인자로 주차 지정 가능)
async function resolveIssueUrl(arg) {
  if (arg) return `${WEEKLY_BASE}/${arg}`
  const html = await (await fetch(WEEKLY_BASE)).text()
  const week = html.match(/\/weekly\/(\d{6})/)?.[1]
  if (!week) throw new Error('최신 주간호를 찾지 못함')
  return `${WEEKLY_BASE}/${week}`
}

// 주간호에서 (제목, 토픽링크) 목록 추출 — 순서 보존, 중복 제거
async function parseIssue(issueUrl) {
  const html = await (await fetch(issueUrl)).text()
  const issueTitle = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]+>/g, '').trim()
  const re =
    /href=['"](?:https?:\/\/news\.hada\.io)?\/topic\?id=(\d+)['"][^>]*>([\s\S]*?)<\/a>/g
  const seen = new Set()
  const items = []
  let m
  while ((m = re.exec(html))) {
    const sourceId = m[1]
    if (seen.has(sourceId)) continue
    const title = m[2].replace(/<[^>]+>/g, '').trim()
    if (!title) continue
    seen.add(sourceId)
    items.push({ sourceId, title, link: `https://news.hada.io/topic?id=${sourceId}` })
  }
  return { issueTitle, items }
}

async function main() {
  const args = process.argv.slice(2)
  const dry = args.includes('--dry')
  const week = args.find((a) => /^\d{6}$/.test(a))

  const issueUrl = await resolveIssueUrl(week)
  console.log(`① 주간호: ${issueUrl}`)
  const { issueTitle, items } = await parseIssue(issueUrl)
  console.log(`   "${issueTitle}" — 토픽 ${items.length}개\n`)

  if (dry) {
    console.log('[미리보기] 아래 토픽이 수집 대상입니다 (실제 수집 안 함):')
    items.forEach((it, i) => console.log(`   ${String(i + 1).padStart(2)}. ${it.title}`))
    return
  }

  const seen = await loadSeen()
  let added = 0
  for (const it of items) {
    const key = makeKey(GEEKNEWS.slug, { sourceId: it.sourceId })
    if (seen.has(key)) {
      console.log(`· 스킵 [${key}] 이미 등록됨`)
      continue
    }
    process.stdout.write(`② 본문 추출 [${key}] ${it.title.slice(0, 24)}... `)
    try {
      const { source, paragraphs, published } = await fetchTopicBody(it.link)
      if (!paragraphs.length) {
        console.log('건너뜀(본문 없음)')
        continue
      }
      await writeRaw(key, {
        id: key,
        sourceId: it.sourceId,
        title: it.title,
        source,
        provider: GEEKNEWS.name,
        link: it.link,
        published,
        weekly: issueUrl.split('/').pop(),
        paragraphs,
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
    console.log(`\n다음: article-narration 스킬로 대본을 생성하세요.`)
  } else {
    console.log(`\n보정 대기 없음.`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
