// 수집 파이프라인 공용 로직 (RSS 수집기와 주간 수집기가 공유)

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(__dirname, '..')
export const RAW_DIR = join(ROOT, 'data', 'raw')
export const NARRATED_DIR = join(ROOT, 'data', 'narrated')
export const SEEN_PATH = join(ROOT, 'data', 'seen.json')

export const GEEKNEWS = { name: '긱뉴스', slug: 'geeknews' }

// 전역 키: "<provider-slug>__<소스ID 또는 URL해시>" (제목 기반 금지)
export function makeKey(slug, { sourceId, url }) {
  if (sourceId) return `${slug}__${sourceId}`
  const hash = createHash('sha1').update(normalizeUrl(url)).digest('hex').slice(0, 10)
  return `${slug}__${hash}`
}

export function normalizeUrl(raw) {
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

export function stripHtml(html) {
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

// 긱뉴스 토픽 페이지에서 #topic_contents 본문 + 출처 + 게시일 추출
export async function fetchTopicBody(topicUrl) {
  const res = await fetch(topicUrl)
  const html = await res.text()
  const titleBlock = html.match(/<div class='topictitle link'>([\s\S]*?)<\/div>/)?.[1] ?? ''
  const extUrl = titleBlock.match(/href='(https?:\/\/[^']+)'/)?.[1]
  const source = extUrl ? new URL(extUrl).hostname.replace(/^www\./, '') : 'news.hada.io'
  const section = html.match(/<section id='topic_contents'[^>]*>([\s\S]*?)<\/section>/)?.[1]
  const paragraphs = section ? stripHtml(section) : []
  const published = html.match(/datetime=['"]([^'"]+)['"]/)?.[1]
  return { source, paragraphs, published }
}

export async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf-8'))
  } catch {
    return fallback
  }
}

export async function idsInDir(dir) {
  try {
    const files = await readdir(dir)
    return new Set(files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')))
  } catch {
    return new Set()
  }
}

export async function loadSeen() {
  return new Set(await readJson(SEEN_PATH, []))
}
export async function saveSeen(seen) {
  await writeFile(SEEN_PATH, JSON.stringify([...seen].sort(), null, 2), 'utf-8')
}

export async function writeRaw(key, obj) {
  await mkdir(RAW_DIR, { recursive: true })
  await writeFile(join(RAW_DIR, `${key}.json`), JSON.stringify(obj, null, 2), 'utf-8')
}

// 보정 대기 = raw 에는 있으나 narrated 에는 없는 키
export async function pendingIds() {
  const raw = await idsInDir(RAW_DIR)
  const narrated = await idsInDir(NARRATED_DIR)
  return [...raw].filter((id) => !narrated.has(id))
}
