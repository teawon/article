// Vercel 서버리스 함수: 대본 텍스트 → 엣지(마이크로소프트) 신경망 음성 mp3
// 무료, API 키 불필요. POST { text, voice } → audio/mpeg
import { EdgeTTS } from '@andresaya/edge-tts'

export const config = { maxDuration: 60 }

const ALLOWED = new Set([
  'ko-KR-SunHiNeural',
  'ko-KR-InJoonNeural',
  'ko-KR-HyunsuMultilingualNeural',
])

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }
  try {
    const { text, voice } = req.body || {}
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'text required' })
      return
    }
    const chosen = ALLOWED.has(voice) ? voice : 'ko-KR-SunHiNeural'
    const tts = new EdgeTTS()
    await tts.synthesize(text, chosen, { rate: '0%', pitch: '0Hz', volume: '0%' })
    const buf = tts.toBuffer()
    res.setHeader('Content-Type', 'audio/mpeg')
    // 같은 글은 하루 캐시 (동일 요청 재생성 방지)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.status(200).send(buf)
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
}
